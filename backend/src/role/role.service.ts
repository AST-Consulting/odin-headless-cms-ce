import { forwardRef, Logger, NotFoundException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Role, TRoleDocument } from './entities/role.schema';
import { AuditTrailService } from 'src/core/audit-trail/audit-trail.service';
import { ElasticService } from 'src/core/elastic/elastic.service';
import { roleDTO, updateRoleDTO } from './dto/role.dto';
import { buildUserMetadata } from 'src/core/utils/utils';
import { ACTIONS, ModuleName, STATUS } from 'src/core/constants/enums.constants';
import { getFilters } from 'src/core/utils/getFilters';
import { APIFeatures, escapeRegex } from 'src/core/utils/apiFeatures.utils';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { RoleQueryDto } from './dto/role-query.dto';
import { IUserSub } from 'src/user/entities/user-sub.interface';
import { OrganizationService } from 'src/organization/organization.service';
import { PropertyService } from 'src/property/property.service';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel(Role.name) private _roleModel: Model<Role>,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _elasticService: ElasticService,
    @Inject(forwardRef(() => OrganizationService))
    private readonly _organizationService: OrganizationService,
    @Inject(forwardRef(() => PropertyService))
    private readonly _propertyService: PropertyService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) { }

  async createRole(roleDTO: roleDTO, user: TCurrentUserType): Promise<TRoleDocument> {
    const name = roleDTO.name.trim().toUpperCase();
    const organizationId = user.organizationId;

    // Build the query to check for duplicate roles
    // Scoped by organization and, if provided, the property ID
    const duplicateQuery: any = {
      name,
      'organization.id': organizationId,
      status: { $ne: STATUS.DELETED },
    };

    if (roleDTO.propertyId) {
      duplicateQuery['properties.id'] = roleDTO.propertyId;
    } else {
      // If no propertyId, check for roles that also don't have a propertyId (global org roles)
      duplicateQuery.properties = { $size: 0 };
    }

    const existingRole = await this._roleModel.findOne(duplicateQuery);
    if (existingRole) {
      throw new ConflictException(
        `Role with name "${name}" already exists for this ${roleDTO.propertyId ? 'property' : 'organization'}`
      );
    }

    // Populate organization data (mandatory context)
    const organization = await this._organizationService.findOne(user.organizationId);
    const organizationData = {
      id: organization._id.toString(),
      name: organization.organization_name,
      slug: organization.slug,
    };

    // Optional: Populate property data if propertyId is provided
    let propertyData = null;
    if (roleDTO.propertyId) {
      const property = await this._propertyService.getById(roleDTO.propertyId);
      propertyData = {
        id: property._id.toString(),
        name: property.name,
        domain: property.domain,
      };
    }

    const userSub: IUserSub = {
      id: user.sub,
      email: user.email,
      name: user.name,
    };

    const newRole = new this._roleModel({
      name,
      permissions: roleDTO.permissions,
      organization: [organizationData],
      properties: propertyData ? [propertyData] : [],
      user: userSub,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    });

    const role = await newRole.save();
    this._logger.log(`Role created successfully: ${role._id}`, this.constructor.name);

    // Create audit trail entry for creating role
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.ROLE,
      user,
      objectId: role.id,
      existingData: null,
      newData: role,
    });

    return role;
  }

  private async _indexRoleInElasticsearch(createdRole: TRoleDocument): Promise<void> {
    // Prepare the role document for indexing in Elasticsearch
    const elasticRoleDocument = {
      name: createdRole.name,
      status: createdRole.status,
      permissions: createdRole.permissions,
      createdBy: createdRole.createdBy,
      updatedBy: createdRole.updatedBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Index the document in Elasticsearch with error handling
    try {
      await this._elasticService.indexDocument(
        ModuleName.ROLE, // Module type for the slug
        createdRole.id, // Unique ID for the role document
        elasticRoleDocument // The document to be indexed
      );
      console.log('Role successfully indexed in Elasticsearch.');
    } catch (error) {
      console.error('Error indexing Role in Elasticsearch:', error);
    }
  }

  async getRoles(
    query: RoleQueryDto,
    user: TCurrentUserType
  ): Promise<{ data: TRoleDocument[]; total: number }> {
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }
    if (query.propertyId) {
      query['properties.id'] = query.propertyId;
      delete query.propertyId;
    }

    const filters = getFilters(query);
    const isSuperAdmin = user.userType === 'superadmin';

    // Apply security filters if not a superadmin
    if (!isSuperAdmin) {
      // 1. Restrict to user's organization
      filters['organization.id'] = user.organizationId;
    } else {
      // For SuperAdmins, show all roles regardless of property selected
      delete filters['properties.id'];
    }

    const total = await this._roleModel.countDocuments(filters);

    const features = new APIFeatures(this._roleModel, query)
      .search()
      .sort()
      .limitFields()
      .paginate();

    const doc = await features.getQuery().find(filters).exec();
    return {
      data: doc,
      total,
    };
  }

  async getRoleByName(name: string): Promise<TRoleDocument> {
    // Escape regex metacharacters to prevent injection attacks
    const escapedName = escapeRegex(name);
    const role = await this._roleModel.findOne({
      name: { $regex: `^${escapedName}$`, $options: 'i' },
    });
    // if (!role || role.status == STATUS.DELETED) throw new NotFoundException(MESSAGE.ROLE.NOT_FOUND);
    return role;
  }

  async getRoleIdAndName(
    query: RoleQueryDto,
    user: TCurrentUserType
  ): Promise<any> {
    // Check if user is admin
    // if (user.userType !== 'admin') {
    //   throw new NotFoundException('Access denied. Admin privileges required.');
    // }

    // Get roles filtered by organizationId and active status
    // Normalize query
    if (query.propertyId) {
      query['properties.id'] = query.propertyId;
      delete query.propertyId;
    }

    const filterObj = getFilters(query);
    const isSuperAdmin = user.userType === 'superadmin';

    // Apply security filters if not a superadmin
    if (!isSuperAdmin) {
      // 1. Restrict to user's organization
      filterObj['organization.id'] = user.organizationId;
    } else {
      // For SuperAdmins, show all roles regardless of property selected
      delete filterObj['properties.id'];
    }

    // Get roles filtered by context and active status
    const roles = await this._roleModel.find(
      filterObj,
      { _id: 1, name: 1 } // Only select id and name fields
    );

    // Transform to the expected format
    const data = roles.map((role) => ({
      id: role._id.toString(),
      name: role.name,
    }));

    return {
      data,
      total: data.length,
    };
  }

  async getRoleByNames(names: string[]): Promise<TRoleDocument[]> {
    const roles = await this._roleModel.find({
      name: { $in: names },
      status: { $ne: STATUS.DELETED },
    });

    return roles;
  }

  async findByIds(ids: string[]): Promise<TRoleDocument[]> {
    const roles = await this._roleModel.find({
      _id: { $in: ids },
      status: { $ne: STATUS.DELETED },
    });

    return roles;
  }

  async getRoleById(id: string): Promise<TRoleDocument> {
    const role = await this._roleModel.findById(id);
    if (!role || role.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.ROLE.NOT_FOUND);
    }
    return role;
  }

  async updateRole(
    id: string,
    roleDTO: updateRoleDTO,
    user: TCurrentUserType
  ): Promise<TRoleDocument> {
    const isSuperAdmin = user.userType === 'superadmin';

    // Check if role exists
    const role = await this._roleModel.findOne({
      _id: id,
      status: { $ne: STATUS.DELETED },
      // Scoping check for non-superadmins (using organization array field)
      ...(!isSuperAdmin ? { 'organization.id': user.organizationId } : {})
    });

    if (!role) {
      throw new NotFoundException(MESSAGE.ROLE.NOT_FOUND);
    }

    // Normalize name if provided
    if (roleDTO.name) {
      roleDTO.name = roleDTO.name.trim().toUpperCase();

      // Check for duplicate name if name is being changed
      const existingRoleWithName = await this._roleModel.findOne({
        _id: { $ne: id },
        name: roleDTO.name,
        'properties.id': { $in: role.properties.map(p => p.id) },
        status: { $ne: STATUS.DELETED }
      });

      if (existingRoleWithName) {
        throw new ConflictException(`Role with name "${roleDTO.name}" already exists`);
      }
    }

    const updatedRole = await this._roleModel.findByIdAndUpdate(
      id,
      {
        ...roleDTO,
        updatedBy: buildUserMetadata(user),
      },
      { new: true, runValidators: true }
    );
    if (!updatedRole) {
      throw new NotFoundException(MESSAGE.ROLE.NOT_FOUND);
    }
    this._logger.log(`Role updated successfully: ${id}`, this.constructor.name);

    // Create audit trail entry for updating FAQ
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.ROLE,
      user,
      objectId: updatedRole.id,
      existingData: role,
      newData: updatedRole,
    });

    await this._updateIndexedRoleInElasticsearch(updatedRole);
    return role;
  }
  private async _updateIndexedRoleInElasticsearch(updatedRole: TRoleDocument): Promise<void> {
    // Prepare the payload for updating the Role document in Elasticsearch
    const indexPayload = {
      name: updatedRole.name,
      status: updatedRole.status,
      permissions: updatedRole.permissions,
      updatedBy: updatedRole.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      // Update the document in Elasticsearch
      await this._elasticService.updateDocument(
        ModuleName.ROLE, // Elasticsearch index for roles
        updatedRole.id, // Unique ID for the Role document
        indexPayload // Document to be updated
      );
      console.log('Role successfully updated in Elasticsearch.');
    } catch (error) {
      console.error('Error updating Role in Elasticsearch:', error);
    }
  }

  async deleteRole(id: string, user: TCurrentUserType): Promise<TRoleDocument> {
    const isSuperAdmin = user.userType === 'superadmin';
    const role = await this._roleModel.findOne({
      _id: id,
      ...(!isSuperAdmin ? { 'organization.id': user.organizationId } : {})
    });
    if (!role) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if (role.status === STATUS.DELETED || role.status === STATUS.TO_BE_DELETED) {
      throw new NotFoundException(MESSAGE.FAQ.NOT_FOUND);
    }
    const deletedRole = await this._roleModel.findByIdAndDelete(id);
    // await this._elasticService.deleteDocument(ModuleName.ROLE, id);
    //Create audit trail entry for faq deletion
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.ROLE,
      user,
      objectId: role.id,
      existingData: role,
      newData: deletedRole,
    });

    return deletedRole;
  }
}
