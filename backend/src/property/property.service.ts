import { ForbiddenException, forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Property, TPropertyDocument } from './schema/property.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserService } from 'src/user/user.service';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { MESSAGE } from 'src/core/constants/generalMessages.constants';
import { TUserDocument } from 'src/user/entities/user.schema';
import { IUserSub } from 'src/user/entities/user-sub.interface';
import { ObjectId } from 'mongodb';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { getFilters } from 'src/core/utils/getFilters';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { QueryPropertyDto } from './dto/query-property.dto';
import { ElasticService } from 'src/core/elastic/elastic.service';
import { ACTIONS, ModuleName, STATUS } from 'src/core/constants/enums.constants';
import { ElasticAPIFeatures } from 'src/core/utils/elasticApiFeatures.utils';
import { PropertyDto } from './dto/create-property.dto';
import { AuditTrailService } from 'src/core/audit-trail/audit-trail.service';
import { EmailService } from 'src/utilities/communication-provider/email/email.service';
import { JwtService } from '@nestjs/jwt';
import { ApiConfigService } from 'src/core/config/config.service';
import { getPropertyEmailVerificationMail } from 'src/utilities/email-templates';
import { buildUserMetadata } from 'src/core/utils/utils';
import { OrganizationService } from '@organization/organization.service';
import { domain } from 'zod/v4/core/regexes.cjs';
import { GenerateContentResponsePromptFeedback } from '@google/genai';
import { SeoSettingsService } from 'src/seo-settings/seo-settings.service';

@Injectable()
export class PropertyService {
  constructor(
    @InjectModel(Property.name)
    private readonly _propertyModel: Model<TPropertyDocument>,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly _logger: Logger,
    private readonly _userService: UserService,
    private readonly _elasticService: ElasticService,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _emailService: EmailService,
    private readonly _jwtService: JwtService,
    private readonly _configService: ApiConfigService,
    private readonly _organizationService: OrganizationService,
    private readonly _seoSettingsService: SeoSettingsService,
    @Inject(forwardRef(() => AuthService))
    private readonly _authService: AuthService
  ) { }

  context = this.constructor.name;
  async create(createPropertyDto: PropertyDto, user): Promise<TPropertyDocument> {
    // Normalize the domain: lowercase and remove trailing slash

    const normalizedDomain = createPropertyDto.domain.toLowerCase().replace(/\/$/, '');
    createPropertyDto.domain = normalizedDomain;

    // Extract name from domain
    let name = '';
    try {
      const url = new URL(normalizedDomain);
      name = url.hostname.split('.')[0];
    } catch (error) {
      // Fallback: extract from domain string if not a valid URL
      name = normalizedDomain.replace(/^https?:\/\//, '').split('.')[0];
    }

    // Check if user exists
    const currentUser: TUserDocument = await this._userService.findOne(user.sub);
    const userSub: IUserSub = {
      id: currentUser.id, // Ensure ID is added
      name: currentUser.name,
      email: currentUser.email,
    };

    // Prioritize the organizationId from the DTO (selected in UI) over the token one
    const targetOrgId = (createPropertyDto as any).organizationId || user.organizationId;
    const organization = await this._organizationService.findOne(targetOrgId);

    const organizationData = {
      id: organization?._id.toString(),
      name: organization.organization_name,
      slug: organization.organization_name,
      domain: organization.domain,
    };

    const propertyToCreate = {
      ...createPropertyDto,
      name: name,
      user: userSub,
      organization: organizationData,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    };

    const property = await this._propertyModel.create(propertyToCreate);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.PROPERTY,
      user,
      objectId: property.id,
      existingData: null,
      newData: property,
    });

    // Resolve caller's context to clone into the property membership
    const { roles, permissions } = await this._authService.getContextPermissions(user.sub, targetOrgId);

    // Update user's properties array with explicit roles/permissions for this property
    await this._userService.addPropertyToUser(user.sub, property, roles, permissions);

    // Create default SEO files (robots.txt, ads.txt, llms.txt) for the property
    this._seoSettingsService.createDefaults(
      { id: property._id.toString(), name: property.name, domain: property.domain },
      property.organization
    );

    // await this._indexBlogConfigInElasticsearch(property);

    return property;
  }

  // Function to handle Elasticsearch indexing
  private async _indexBlogConfigInElasticsearch(blogConfig: TPropertyDocument) {
    const elasticBlogConfigDocument = {
      user: blogConfig.user,
      domain: blogConfig.domain,
      status: blogConfig.status,
      platform: blogConfig.platform,
      industry: blogConfig.industry,
      articleType: blogConfig.articleType,
      // Include other relevant fields from the Property schema
    };

    // Indexing the blog post document in Elasticsearch with error handling
    try {
      await this._elasticService.indexDocument(
        ModuleName.BLOG_CONFIG,
        blogConfig.id,
        elasticBlogConfigDocument
      );
    } catch (error) {
      console.error('Error indexing blog config in Elasticsearch:', error);
    }
  }

  async getById(id: string) {
    const property = await this._propertyModel.findById(id);
    if (!property) throw new NotFoundException(MESSAGE.BLOG_CONFIG.NOT_FOUND);
    return property;
  }

  async findOne(id: string, user?: TCurrentUserType): Promise<TPropertyDocument> {
    // Check if user has access to the specified property
    // const userProperties = await this._userPropertyService.getByUserId(user.sub);
    // const allowedPropertyIds = userProperties.flatMap((up) => up.propertyId);

    // // If propertyId is provided, check if it's allowed
    // if (id && !allowedPropertyIds.includes(id)) {
    //   throw new ForbiddenException('You do not have access to this property');
    // }
    const property = await this.getById(id);
    return property;
  }

  // async getAll(userId: string): Promise<TPropertyDocument[]> {
  //   // Get user's accessible property IDs from UserProperty service
  //   const userProperties = await this._userPropertyService.getByUserId(userId);
  //   const allowedPropertyIds = userProperties.flatMap((up) => up.propertyId);
  //   return await this._propertyModel.find({
  //     _id: { $in: allowedPropertyIds },
  //   });
  // }

  async findByDomain(domain: string, user: TCurrentUserType): Promise<TPropertyDocument | null> {
    // nornalise the domain to lowercase and remove end slash if exists
    domain = domain.toLowerCase().replace(/\/$/, '');
    const property = await this._propertyModel.findOne({ domain: domain });
    if (!property) {
      throw new NotFoundException(MESSAGE.BLOG_CONFIG.NOT_FOUND);
    }
    const isOwner = property.user?.id === user.sub;
    const hasAccess = (user as any)?.propertyAccess?.includes(property._id.toString());
    if (!isOwner && !hasAccess) {
      throw new NotFoundException(MESSAGE.BLOG_CONFIG.NOT_FOUND);
    }
    return property;
  }

  /**
   * Public method to get property by domain (for robots.txt, sitemaps, etc.)
   * Does not require authentication
   */
  async getByDomain(domain: string): Promise<TPropertyDocument | null> {
    // Normalize the domain to lowercase and remove end slash if exists
    const normalizedDomain = domain
      .toLowerCase()
      .replace(/\/$/, '')
      .replace(/^https?:\/\//, '');

    const property = await this._propertyModel.findOne({
      domain: { $regex: new RegExp(normalizedDomain, 'i') },
      status: STATUS.ACTIVE,
    });

    return property;
  }

  async findAll(
    query: QueryPropertyDto,
    user: TCurrentUserType
  ): Promise<{ data: TPropertyDocument[]; total: number }> {
    // 1. Fetch user to get explicit collections
    const dbUser = await this._userService.findById(user.sub);
    if (!dbUser) return { data: [], total: 0 };

    // 2. Extract allowed Property IDs
    const propertyIds = dbUser.properties?.map((p) => {
      try { return new ObjectId(p.id); } catch (e) { return null; }
    }).filter(Boolean) || [];

    console.log('propertyIds', propertyIds);

    // 3. Prepare filters
    const filters = getFilters(query);
    const targetOrgId = query.organizationId;
    const combinedFilters: any = { ...filters };
    delete combinedFilters.organizationId;

    // 4. Force strict isolation by user's assigned properties
    if (propertyIds.length === 0) {
      return { data: [], total: 0 };
    }

    // DEBUG: Look up the site directly to verify its organization structure
    const firstProperty = await this._propertyModel.findById(propertyIds[0]).exec();
    if (firstProperty) {
      console.log(`[PropertyDebug] Site Found: ${firstProperty.domain}`);
      console.log(`[PropertyDebug] Site Org Object:`, JSON.stringify(firstProperty.organization));
    } else {
      console.log(`[PropertyDebug] Site ${propertyIds[0]} NOT FOUND in database!`);
    }

    combinedFilters._id = { $in: propertyIds };

    // 5. Intersect with organization if requested
    if (targetOrgId) {
      const orgIdStr = targetOrgId.toString();
      let orgIdObj: any = null;
      try { orgIdObj = new ObjectId(orgIdStr); } catch (e) { }

      combinedFilters.$or = [
        { 'organization.id': orgIdStr },
        { 'organization._id': orgIdStr },
        { 'organization.id': orgIdObj },
        { 'organization._id': orgIdObj }
      ].filter(f => f['organization.id'] || f['organization._id']);
    }

    // 6. Execute
    const total = await this._propertyModel.countDocuments(combinedFilters);
    const data = await this._propertyModel
      .find(combinedFilters)
      .sort(query.sort || { createdAt: -1 })
      .limit(Number(query.limit) || 100)
      .skip(((Number(query.page) || 1) - 1) * (Number(query.limit) || 100))
      .exec();

    console.log(`[PropertyService] User ${user.email} mapping: found ${data.length} sites for ${propertyIds.length} assigned IDs.`);

    return { data, total };
  }

  async findAllFromElastic(
    query: QueryPropertyDto,
    user: TCurrentUserType
  ): Promise<{
    data: Partial<Property>[];
    total: number | any;
  }> {
    try {
      // Convert the query parameters to match ElasticAPIFeatures format
      const elasticQuery = {
        page: query.page || 1,
        pageSize: query.limit || 20,
        q: query.searchTerm,
        fields: query.fields,
        // We'll post-filter by accessible property IDs below
        ...query,
      };
      const features = (
        await new ElasticAPIFeatures(
          ModuleName.PROPERTY,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .search()
        .sort()
        .limitFields();

      const isSuperAdmin = user.userType === 'superadmin';

      let allowedPropertyIds: string[] = [];
      if (!isSuperAdmin) {
        const dbUser = await this._userService.findById(user.sub);
        allowedPropertyIds = dbUser.properties?.map((p) => p.id).filter(Boolean) || [];
      }

      const esQuery = features.getQuery();
      const result = await this._elasticService.search(ModuleName.PROPERTY, esQuery);

      const blogConfigs = result.hits.hits
        .filter((hit) => {
          const source = hit._source as any;
          const propertyId = hit._id;

          // 1. Basic Organization filtering
          const matchesOrganization =
            source?.organization?.id === user.organizationId ||
            source?.organizationId === user.organizationId;

          if (!matchesOrganization) return false;

          // 2. Strict Property filtering for non-superadmins
          if (!isSuperAdmin) {
            return allowedPropertyIds.includes(propertyId);
          }

          return true;
        })
        .map((hit) => ({
          _id: hit._id,
          ...(hit._source as Partial<Property>),
        }));

      return {
        data: blogConfigs,
        total:
          typeof result.hits.total === 'object'
            ? // Adjust total to filtered count when using object form
            { ...(result.hits.total as any), value: blogConfigs.length }
            : blogConfigs.length,
      };
    } catch (error) {
      console.error('Error in fetching blog configs:', error);
      throw error;
    }
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto, user: TCurrentUserType) {
    const objectId = new ObjectId(id);

    // First check if the property exists
    const existingConfig = await this._propertyModel.findOne({ _id: objectId });

    if (!existingConfig) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Check if user has access to the specified property
    // const userProperties = await this._userPropertyService.getByUserId(user.sub);
    // const allowedPropertyIds = userProperties.flatMap((up) => up.propertyId);

    // If propertyId is provided, check if it's allowed
    // if (id && !allowedPropertyIds.includes(id)) {
    //   throw new ForbiddenException('You do not have access to this property');
    // }

    // Update the property document directly
    const result = await this._propertyModel.findOneAndUpdate(
      { _id: objectId },
      { $set: updatePropertyDto, updatedBy: buildUserMetadata(user) },
      { new: true }
    );

    if (result.credential && result.targetAudience && result.targetAudience.length > 0) {
      // If credential and target audience are present, set isComplete to true
      result.isComplete = true;
      await result.save();
    }

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.PROPERTY,
      user,
      objectId: result.id,
      existingData: existingConfig,
      newData: result,
    });

    // Update the Elasticsearch index
    // await this._updateIndexBlogConfigInElasticsearch(result);

    this._logger.log(`Property with ID ${id} updated successfully`, this.constructor.name);

    return result;
  }

  private async _updateIndexBlogConfigInElasticsearch(blogConfig: TPropertyDocument) {
    const elasticBlogConfigDocument = {
      user: blogConfig.user,
      domain: blogConfig.domain,
      status: blogConfig.status,
      platform: blogConfig.platform,
      industry: blogConfig.industry,
      articleType: blogConfig.articleType,
    };

    // Indexing the blog post document in Elasticsearch with error handling
    try {
      await this._elasticService.updateDocument(
        ModuleName.BLOG_CONFIG,
        blogConfig.id,
        elasticBlogConfigDocument
      );
    } catch (error) {
      console.error('Error indexing blog config in Elasticsearch:', error);
    }
  }

  async delete(id: string, user: TCurrentUserType) {
    const objectId = new ObjectId(id);

    // Check if the property exists first
    const existingConfig = await this._propertyModel.findOne({ _id: objectId });

    if (!existingConfig) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Check if user has access to the specified property
    // const userProperties = await this._userPropertyService.getByUserId(user.sub);
    // const allowedPropertyIds = userProperties.flatMap((up) => up.propertyId);

    // If propertyId is provided, check if it's allowed
    // if (id && !allowedPropertyIds.includes(id)) {
    //   throw new ForbiddenException('You do not have access to this property');
    // }

    const result = await this._propertyModel.findOneAndDelete({ _id: objectId });

    this._logger.log(`Property with ID ${id} deleted successfully`, this.constructor.name);

    return result;
  }

  async findAllForAdmin(
    query: QueryPropertyDto
  ): Promise<{ data: TPropertyDocument[]; total: number }> {
    const filters = getFilters(query);
    // Use a clean query object for APIFeatures to avoid duplicate/conflicting filters
    const cleanQuery = { ...query };
    delete cleanQuery.organizationId;

    const features = new APIFeatures(this._propertyModel as any, cleanQuery)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();

    const data = await features.getQuery().exec();
    const total = await this._propertyModel.countDocuments(filters); // Recalculate total based on original filters

    return { data, total };
  }

  async findAllFromElasticForAdmin(query: QueryPropertyDto): Promise<{
    data: Partial<Property>[];
    total: number | any;
  }> {
    try {
      const elasticQuery = {
        page: query.page || 1,
        pageSize: query.limit || 20,
        q: query.searchTerm,
        fields: query.fields,
        ...query,
      };
      const features = (
        await new ElasticAPIFeatures(
          ModuleName.PROPERTY,
          elasticQuery,
          this._elasticService
        ).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();
      const result = await this._elasticService.search(ModuleName.PROPERTY, esQuery);
      const blogConfigs = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as Partial<Property>),
      }));

      return {
        data: blogConfigs,
        total: result.hits.total,
      };
    } catch (error) {
      console.error('Error in fetching blog configs:', error);
      throw error;
    }
  }

  async getByIdForAdmin(id: string) {
    const property = await this._propertyModel.findOne({ _id: id });
    if (!property) throw new NotFoundException(MESSAGE.BLOG_CONFIG.NOT_FOUND);
    return property;
  }

  /**
   * Send email verification for property posting emails
   */
  private async sendPropertyEmailVerification(email: string, propertyId?: string): Promise<void> {
    try {
      // Generate verification token
      const verificationToken = await this.generateVerificationToken(email, propertyId);

      // Create verification link
      const verificationLink = `${process.env.FRONTEND_URL || process.env.BASE_URL}/verify-property-email?token=${verificationToken}`;

      // Get email template
      const emailTemplate = getPropertyEmailVerificationMail(
        email,
        verificationLink,
        this._configService.brandName || 'Our Platform'
      );
      //Send verification email
      await this._emailService.sendMail('Property Email Verification Required', emailTemplate, {
        name: email,
        email: email,
      });

      this._logger.log(`Property email verification sent to: ${email}`, this.constructor.name);
    } catch (error) {
      this._logger.error(
        `Failed to send property email verification to ${email}: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      // Don't throw error to prevent property creation from failing
    }
  }

  /**
   * Generate verification token for property email verification
   */
  private async generateVerificationToken(email: string, propertyId?: string): Promise<string> {
    const payload = {
      email,
      propertyId,
      type: 'property-email-verification',
      timestamp: Date.now(),
    };

    return this._jwtService.sign(payload);
  }

  /**
   * Verify property email verification token
   */
  async verifyPropertyEmail(token: string): Promise<{ success: boolean; email: string }> {
    try {
      const payload = this._jwtService.verify(token);
      if (payload.type !== 'property-email-verification') {
        throw new Error('Invalid token type');
      }

      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - payload.timestamp;
      const maxAge = 48 * 60 * 60 * 1000; // 24 hours in milliseconds

      if (tokenAge > maxAge) {
        throw new Error('Token expired');
      }

      const email = payload.email;
      const propertyId = payload.propertyId;

      if (!propertyId) {
        throw new Error('Property ID not found in token');
      }

      // Update verification status only for the specific property and email
      const result = await this._propertyModel.updateOne(
        {
          _id: propertyId,
          'postignEmail.email': email,
        },
        {
          $set: { 'postignEmail.$.verified': true },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Property or email not found');
      }

      this._logger.log(`Property email verified successfully: ${email}`, this.constructor.name);

      return { success: true, email };
    } catch (error) {
      this._logger.error(
        `Property email verification failed: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      throw new Error('Invalid or expired verification token');
    }
  }

  /**
   * Resend verification email for a specific posting email
   */
  async resendPropertyEmailVerification(
    email: string,
    propertyId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the property that contains this email

      await this.sendPropertyEmailVerification(email, propertyId);
      return {
        success: true,
        message: 'Verification email sent successfully',
      };
    } catch (error) {
      this._logger.error(
        `Failed to resend property email verification to ${email}: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      return {
        success: false,
        message: 'Failed to send verification email',
      };
    }
  }

  async getAllPropertiesForReport(): Promise<TPropertyDocument[]> {
    return await this._propertyModel
      .find({
        status: STATUS.ACTIVE,
      })
      .exec();
  }
}
