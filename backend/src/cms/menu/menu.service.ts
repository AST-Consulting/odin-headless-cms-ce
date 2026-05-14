import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { getFilters } from '@core/utils/getFilters';
import { APIFeatures } from '@core/utils/apiFeatures.utils';
import { ModuleName, STATUS, ACTIONS } from '@core/constants/enums.constants';
import { MESSAGE } from '@core/constants/generalMessages.constants';
import { buildUserMetadata } from '@core/utils/utils';
import { SlugService } from '@cms/slug/slug.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';
import { CreateMenuDto } from './dto/menu.create.dto';
import { Menu, TMenuDocument } from './schema/menu.schema';
import { UpdateMenuDto } from './dto/menu.update.dto';
import { QueryMenuDto } from './dto/menu.query.dto';
import { ElasticService } from '@core/elastic/elastic.service';
import { OnDeleteCascadeService } from '@core/on-delete-cascade/on-delete-cascade.service';
import { ElasticAPIFeatures } from '@core/utils/elasticApiFeatures.utils';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';
import { PropertyService } from '@property/property.service';
import { OrganizationService } from '@organization/organization.service';

@Injectable()
export class MenuService {
  constructor(
    @InjectModel(Menu.name)
    private readonly _menuModel: Model<TMenuDocument>,
    private readonly _slugService: SlugService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
    private readonly _auditTrailService: AuditTrailService,
    private readonly _elasticService: ElasticService,
    private readonly _onDeleteCascadeService: OnDeleteCascadeService,
    private readonly _propertyService: PropertyService,
    private readonly _organizationService: OrganizationService
  ) { }

  async create(createMenuDto: CreateMenuDto, user: any): Promise<TMenuDocument> {
    try {
      const { title } = createMenuDto;

      const property = await this._propertyService.getById(createMenuDto.propertyId);
      const organization = await this._organizationService.findOne(user.organizationId);

      // Generate unique slug or use provided slug
      const slug = await this._slugService.generateUniqueSlug(
        title,
        ModuleName.MENU,
        user,
        null,
        createMenuDto.propertyId,
        createMenuDto.slug // Pass the provided slug if exists
      );

      const propertyData = {
        id: property._id.toString(),
        name: property.name,
        domain: property.domain,
      };
      const organizationData = {
        id: organization._id.toString(),
        name: organization.organization_name,
        slug: organization.organization_name,
        domain: organization.domain,
      };

      const createdMenu: TMenuDocument = new this._menuModel({
        ...createMenuDto,
        slug: slug,
        property: propertyData,
        organization: organizationData,
        createdBy: buildUserMetadata(user),
        updatedBy: buildUserMetadata(user),
      });

      await createdMenu.save();

      this._logger.log(`Menu created successfully: ${createdMenu.title}`, this.constructor.name);

      // Create audit trail
      await this._auditTrailService.logAuditTrail({
        action: ACTIONS.CREATE,
        collectionName: ModuleName.MENU,
        user,
        objectId: createdMenu.id,
        existingData: null,
        newData: createdMenu,
      });

      // Index the menu in Elasticsearch
      // await this._indexMenuInElasticsearch(createdMenu);

      return createdMenu;
    } catch (error) {
      this._logger.error(
        `Error creating menu: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      throw error;
    }
  }

  // Function to handle indexing the menu in Elasticsearch
  private async _indexMenuInElasticsearch(newMenu: any): Promise<void> {
    const indexPayload = {
      id: newMenu.id,
      title: newMenu.title,
      slug: newMenu.slug,
      rank: newMenu.rank,
      status: newMenu.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: newMenu.createdBy,
      updatedBy: newMenu.updatedBy,
      organization: newMenu.organization,
      property: newMenu.property,
      items: newMenu.items.map((item) => this._toIndexableItem(item)),
    };

    try {
      // Index the document in Elasticsearch
      await this._elasticService.indexDocument(
        ModuleName.MENU, // Use the correct module type
        newMenu.id, // Use the ID from the created menu
        indexPayload
      );
      this._logger.log(`Menu indexed successfully: ${newMenu.title}`, this.constructor.name);
    } catch (error) {
      // Handle any errors during indexing
      this._logger.error(
        `Error indexing menu in Elasticsearch: ${error.message}`,
        this.constructor.name
      );
      // Optionally rethrow or handle according to your application's needs
    }
  }

  async findAll(query: QueryMenuDto): Promise<{ total: number; data: TMenuDocument[]; lastId?: string | null }> {
    if (!query.status) {
      query.status = STATUS.ACTIVE;
    }
    //copying query object to avoid mutation
    const queryForMenus = { ...query };

    // console.log('Query for menus:', queryForMenus);

    //Filter by propertyId
    if (queryForMenus.propertyId) {
      queryForMenus['property.id'] = queryForMenus.propertyId;
      delete queryForMenus.propertyId;
    }

    const filters = getFilters(queryForMenus);
    const total = await this._menuModel.countDocuments(filters);

    const features = new APIFeatures(this._menuModel, queryForMenus)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const menus = await features.getQuery().exec();

    return { total, data: menus, lastId: menus.length > 0 ? menus[menus.length - 1]._id.toString() : null };
  }

  async findOne(id: string): Promise<TMenuDocument> {
    const menu = await this._menuModel.findById(id).exec();

    // check if menu is deleted
    if (!menu || menu.status === STATUS.DELETED) {
      throw new NotFoundException(MESSAGE.MENU.NOT_FOUND);
    }
    menu.items.sort((a, b) => a.rank - b.rank);
    return menu;
  }

  async update(id: string, updateMenuDto: UpdateMenuDto, user: any): Promise<TMenuDocument> {
    const existingMenu = await this.findOne(id);
    const updateData = {
      ...updateMenuDto,
      updatedBy: buildUserMetadata(user),
    };
    const updatedMenu = await this._menuModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    this._logger.log(`Menu updated successfully: ${updatedMenu.title}`, this.constructor.name);

    await this._onDeleteCascadeService.cascadeUpdate({
      id: id,
      moduleName: ModuleName.MENU,
    });
    // Create audit trail for update
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.MENU,
      user,
      objectId: updatedMenu.id,
      existingData: existingMenu,
      newData: updatedMenu,
    });

    // Update the indexed document in Elasticsearch
    // await this._updateIndexedMenuInElasticsearch(updatedMenu);

    return updatedMenu;
  }

  // Function to handle updating the menu in Elasticsearch
  private async _updateIndexedMenuInElasticsearch(updatedMenu: any): Promise<void> {
    const indexPayload = {
      id: updatedMenu.id,
      title: updatedMenu.title,
      slug: updatedMenu.slug,
      rank: updatedMenu.rank,
      status: updatedMenu.status,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedMenu.updatedBy,
      items: updatedMenu.items.map((item) => this._toIndexableItem(item)),
    };

    try {
      // Update the document in Elasticsearch
      await this._elasticService.updateDocument(
        ModuleName.MENU, // Use the correct module type
        updatedMenu.id, // Use the ID from the updated menu
        indexPayload
      );
      this._logger.log(`Menu indexed successfully: ${updatedMenu.title}`, this.constructor.name);
    } catch (error) {
      // Handle errors during the update process
      this._logger.error(
        `Error updating menu in Elasticsearch: ${error.message}`,
        this.constructor.name
      );
    }
  }

  async remove(id: string, user: any): Promise<TMenuDocument> {
    const menu = await this.findOne(id);
    if (menu.status === STATUS.DELETED || menu.status === STATUS.TO_BE_DELETED) {
      throw new NotFoundException(MESSAGE.MENU.NOT_FOUND);
    }

    const deletedMenu = await this._menuModel
      .findByIdAndUpdate(
        id,
        { status: STATUS.DELETED, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    this._logger.log('Menu deleted successfully', this.constructor.name);

    await this._onDeleteCascadeService.cascadeDelete({
      id: id,
      moduleName: ModuleName.MENU,
    });
    // Create audit trail for delete
    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.MENU,
      user,
      objectId: menu.id,
      existingData: menu,
      newData: deletedMenu,
    });

    // Delete the menu from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.MENU, menu.id);

    return deletedMenu;
  }

  /**
   * Fetch menu with linked submenus based on the top-level menu slug.
   * @param slug - Slug of the top-level menu.
   * @returns Menu with resolved submenu data.
   */
  async getMenuWithSubMenu(slug: string, query: QueryMenuDto): Promise<any> {
    // Fetch the menu by slug
    const menu = await this._menuModel
      .findOne({ slug: slug, status: STATUS.ACTIVE })
      .select('-createdBy -updatedBy -createdAt -updatedAt')
      .exec();
    if (query['items.status']) {
      menu.items = menu.items.filter((item) => item.status === query['items.status']);
    }

    if (!menu) {
      throw new Error('Menu not found');
    }

    // Convert the menu to a plain object to avoid Mongoose-specific properties
    const menuObject = menu.toObject();

    // Recursively resolve submenus for the menu's items
    menuObject.items = await this._resolveAndSortSubmenus(menuObject.items);

    return menuObject;
  }

  /**
   * Recursively resolve and sort submenus for an array of menu items.
   * @param items - Array of menu items to resolve and sort submenus for.
   * @returns Array of menu items with resolved and sorted submenus.
   */
  private async _resolveAndSortSubmenus(items: any[]): Promise<any[]> {
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.subMenuSlug) {
          // Fetch the submenu using the `subMenuSlug`
          const subMenu = await this._menuModel
            .findOne({ slug: item.subMenuSlug, status: STATUS.ACTIVE })
            .select('-createdBy -updatedBy -createdAt -updatedAt')
            .exec();

          if (subMenu) {
            // Convert the submenu to a plain object
            const subMenuObject = subMenu.toObject();

            // Recursively resolve and sort submenus for the submenu's items
            subMenuObject.items = await this._resolveAndSortSubmenus(subMenuObject.items);

            // Sort the submenu's items by rank
            subMenuObject.items = this._sortItemsByRank(subMenuObject.items);

            // Attach the resolved and sorted submenu to the item
            item.subMenu = subMenuObject;
          } else {
            // If submenu not found, attach null
            item.subMenu = null;
          }
        }

        if (Array.isArray(item.children) && item.children.length > 0) {
          item.children = await this._resolveAndSortSubmenus(item.children);
        }

        return item;
      })
    );

    // Sort the current level items by rank
    return this._sortItemsByRank(resolvedItems);
  }

  /**
   * Sort an array of menu items by their rank in ascending order.
   * @param items - Array of menu items to sort.
   * @returns Sorted array of menu items.
   */
  private _sortItemsByRank(items: any[]): any[] {
    return items.sort((a, b) => a.rank - b.rank);
  }

  private _toIndexableItem(item: any): any {
    const shaped: any = {
      titles: item.titles,
      link: item.link,
      status: item.status,
      rank: item.rank,
      subMenuSlug: item.subMenuSlug,
      label: item.label,
      type: item.type,
      titleHn: item.titleHn,
      object: item.object,
      object_id: item.object_id,
      _id: item._id,
    };
    if (Array.isArray(item.children) && item.children.length > 0) {
      shaped.children = item.children.map((child: any) => this._toIndexableItem(child));
    }
    return shaped;
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////

  async findAllFromElastic(query: QueryMenuDto): Promise<{
    data: Partial<TMenuDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
      const queryForMenus = { ...query };

      // Filter by propertyId - map to property.id for Elasticsearch
      if (queryForMenus.propertyId) {
        queryForMenus['property.id'] = queryForMenus.propertyId;
        delete queryForMenus.propertyId;
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      const elasticQuery = {
        page: query.page || 1,
        pageSize: query.limit || 100,
        q: query.searchTerm,
        fields: query.fields,
        ...queryForMenus, // Include all other query parameters directly
      };
      const features = (
        await new ElasticAPIFeatures(ModuleName.MENU, elasticQuery, this._elasticService).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();

      // Default sort: title asc, with Hindi (Devanagari) titles last
      if (!query.sort) {
        esQuery.sort = [
          {
            _script: {
              type: 'number',
              script: {
                lang: 'painless',
                source:
                  "(doc.containsKey('title.keyword') && doc['title.keyword'].size() > 0 && (int)doc['title.keyword'].value.charAt(0) >= 0x0900 && (int)doc['title.keyword'].value.charAt(0) <= 0x097F) ? 1 : 0",
              },
              order: 'asc',
            },
          },
          { 'title.keyword': { order: 'asc' } },
        ];
      }

      const result = await this._elasticService.search(ModuleName.MENU, esQuery);

      const menus = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TMenuDocument),
      }));

      return {
        data: menus,
        total: result.hits.total,
        lastId: menus.length > 0 ? menus[menus.length - 1]._id.toString() : null,
      };
    } catch (error) {
      console.error('Error in fetching menus From ElasticSearch and fallback to MongoDB:', error);
      const menus = await this.findAll(query);
      return {
        data: menus.data,
        total: menus.total,
        lastId: menus.lastId,
      };
    }
  }

  /**
   * Public method used by the admin controller to find a menu by a keyword field.
   * '_id' is mapped to the indexed 'id' keyword field. No status filter is applied.
   */
  async findOneFromElastic(field: string, value: string): Promise<any | null> {
    const esField = field === '_id' ? 'id' : field;
    const esQuery = {
      size: 1,
      query: { term: { [esField]: value } },
    };
    try {
      const result = await this._elasticService.search(ModuleName.MENU, esQuery);
      const hit = result.hits.hits[0];
      if (!hit) return null;
      return { _id: hit._id, ...(hit._source as any) };
    } catch (error) {
      this._logger.error(
        `Error in findOneFromElastic, falling back to MongoDB: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      const query = { [field]: value };
      return this._menuModel.findOne(query).exec();
    }
  }

  /**
   * Find a single active menu by an arbitrary keyword field using Elasticsearch.
   * Submenus are always resolved by slug internally.
   * Excludes audit/timestamp fields from the result.
   */
  private async _findMenuFromElastic(field: string, value: string | number): Promise<any | null> {
    const esQuery = {
      size: 1,
      query: {
        bool: {
          must: [{ term: { [field]: value } }, { term: { status: STATUS.ACTIVE } }],
        },
      },
      _source: {
        excludes: ['createdBy', 'updatedBy', 'createdAt', 'updatedAt'],
      },
    };

    const result = await this._elasticService.search(ModuleName.MENU, esQuery);
    const hit = result.hits.hits[0];
    if (!hit) return null;
    return { _id: hit._id, ...(hit._source as any) };
  }

  async getMenuWithSubMenuFromElastic(
    field: string,
    value: string | number,
    query: QueryMenuDto
  ): Promise<any> {
    try {
      const menu = await this._findMenuFromElastic(field, value);

      if (!menu) {
        throw new NotFoundException(MESSAGE.MENU.NOT_FOUND);
      }

      if (query['items.status']) {
        menu.items = menu.items.filter((item: any) => item.status === query['items.status']);
      }

      menu.items = await this._resolveAndSortSubmenusFromElastic(menu.items);

      return menu;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this._logger.error(
        `Error fetching menu with submenus from Elasticsearch, falling back to MongoDB: ${error.message}`,
        error.stack,
        this.constructor.name
      );
      // Fallback to MongoDB using slug if available, else re-throw
      if (field === 'slug' && typeof value === 'string') {
        return this.getMenuWithSubMenu(value, query);
      }
      throw error;
    }
  }

  /**
   * Recursively resolve and sort submenus for an array of menu items using Elasticsearch.
   */
  private async _resolveAndSortSubmenusFromElastic(items: any[]): Promise<any[]> {
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (item.subMenuSlug) {
          const subMenu = await this._findMenuFromElastic('slug', item.subMenuSlug);

          if (subMenu) {
            subMenu.items = await this._resolveAndSortSubmenusFromElastic(subMenu.items);
            subMenu.items = this._sortItemsByRank(subMenu.items);
            item.subMenu = subMenu;
          } else {
            item.subMenu = null;
          }
        }

        if (Array.isArray(item.children) && item.children.length > 0) {
          item.children = await this._resolveAndSortSubmenusFromElastic(item.children);
        }

        return item;
      })
    );

    return this._sortItemsByRank(resolvedItems);
  }
}
