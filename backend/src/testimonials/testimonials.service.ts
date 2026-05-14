import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { Testimonial, TTestimonialDocument } from './schemas/testimonial.schema';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { QueryTestimonialDto } from './dto/query-testimonial.dto';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { getFilters } from 'src/core/utils/getFilters';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { ElasticAPIFeatures } from 'src/core/utils/elasticApiFeatures.utils';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { OrganizationService } from '@organization/organization.service';
import { PropertyService } from '@property/property.service';
import { ElasticService } from '@core/elastic/elastic.service';
import { ACTIONS, ModuleName } from '@core/constants/enums.constants';
import { buildUserMetadata } from '@core/utils/utils';
import { SearchTotalHits } from 'node_modules/@elastic/elasticsearch/lib/api/types';
import { AuditTrailService } from '@core/audit-trail/audit-trail.service';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectModel(Testimonial.name) private testimonialModel: Model<TTestimonialDocument>,
    private readonly _propertyService: PropertyService,
    private readonly _organizationService: OrganizationService,
    private readonly _elasticService: ElasticService,
    private readonly _auditTrailService: AuditTrailService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly _logger: Logger
  ) { }


  async create(
    createTestimonialDto: CreateTestimonialDto,
    user: TCurrentUserType
  ): Promise<Testimonial> {
    const property = await this._propertyService.getById(createTestimonialDto.propertyId);
    const organization = await this._organizationService.findOne(user.organizationId);

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

    const slug = `${createTestimonialDto.authorName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const testimonialData = {
      ...createTestimonialDto,
      slug,
      organization: organizationData,
      property: propertyData,
      createdBy: buildUserMetadata(user),
      updatedBy: buildUserMetadata(user),
    };

    const createdTestimonial = new this.testimonialModel(testimonialData);
    await createdTestimonial.save();

    await this._indexTestimonialInElasticSearch(createdTestimonial);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.CREATE,
      collectionName: ModuleName.TESTIMONIAL,
      user,
      objectId: createdTestimonial._id as unknown as Types.ObjectId,
      existingData: null,
      newData: createdTestimonial,
    });
    return createdTestimonial;
  }

  private async _indexTestimonialInElasticSearch(
    testimonial: TTestimonialDocument
  ): Promise<void> {
    const elasticTestimonialDocument = {
      testimonialText: testimonial.testimonialText,
      authorName: testimonial.authorName,
      authorDesignation: testimonial.authorDesignation,
      authorCompany: testimonial.authorCompany,
      status: testimonial.status,
      rating: testimonial.rating,
      date: testimonial.date,
      media: testimonial.media,
      slug: testimonial.slug,
      rank: testimonial.rank,
      isFeatured: testimonial.isFeatured,
      videoURL: testimonial.videoURL,
      organization: testimonial.organization,
      property: testimonial.property,
      createdBy: testimonial.createdBy,
      updatedBy: testimonial.updatedBy,
      createdAt: testimonial.createdAt,
      updatedAt: testimonial.updatedAt,
    };

    try {
      await this._elasticService.indexDocument(
        ModuleName.TESTIMONIAL,
        testimonial._id.toString(),
        elasticTestimonialDocument
      );
    } catch (error) {
      console.error('Error indexing testimonial in elasticsearch:', error);
    }
  }

  private async _updateIndexedTestimonialInElasticSearch(
    updatedTestimonial: TTestimonialDocument
  ): Promise<void> {
    const indexPayload = {
      testimonialText: updatedTestimonial.testimonialText,
      authorName: updatedTestimonial.authorName,
      authorDesignation: updatedTestimonial.authorDesignation,
      authorCompany: updatedTestimonial.authorCompany,
      status: updatedTestimonial.status,
      rating: updatedTestimonial.rating,
      date: updatedTestimonial.date,
      media: updatedTestimonial.media,
      slug: updatedTestimonial.slug,
      rank: updatedTestimonial.rank,
      isFeatured: updatedTestimonial.isFeatured,
      videoURL: updatedTestimonial.videoURL,
      updatedBy: updatedTestimonial.updatedBy,
      updatedAt: new Date().toISOString(),
    };

    try {
      await this._elasticService.updateDocument(
        ModuleName.TESTIMONIAL,
        updatedTestimonial._id.toString(),
        indexPayload
      );
    } catch (error) {
      console.error('Error updating testimonial in Elasticsearch:', error);
    }
  }

  async findAll(
    query: QueryTestimonialDto,
    user: TCurrentUserType
  ): Promise<{ data: TTestimonialDocument[]; total: number; lastId?: string | null }> {
    // Build base filters from query for counting
    const queryForTestimonials = { ...query };

    //filter by propertyId if provided
    if (queryForTestimonials.propertyId) {
      queryForTestimonials['property.id'] = queryForTestimonials.propertyId;
      delete queryForTestimonials.propertyId;
    }

    const filters = getFilters(queryForTestimonials);
    const total = await this.testimonialModel.countDocuments(filters);
    // Build query with APIFeatures
    const testimonialsQuery = new APIFeatures(this.testimonialModel as any, queryForTestimonials)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const testimonials = await testimonialsQuery.getQuery().exec();

    this._logger.log(
      `[Testimonials.findAll] Returning ${testimonials.length} testimonials out of ${total} total for user ${user.email}`,
      this.constructor.name
    );

    return {
      data: testimonials,
      total: total,
      lastId: testimonials.length > 0 ? testimonials[testimonials.length - 1]._id.toString() : null,
    };
  }

  ////////////////////////////////////////////////////////
  // v2 APIS  - Fetching data from elasticsearch
  ////////////////////////////////////////////////////////
  async findAllFromElasticSearch(
    query: QueryTestimonialDto,
    user: TCurrentUserType
  ): Promise<{
    data: Partial<TTestimonialDocument>[];
    total: number | SearchTotalHits;
    lastId?: string | null;
  }> {
    try {
      const queryForTestimonials = { ...query };

      // Filter by propertyId - map to property.id for Elasticsearch
      if (queryForTestimonials.propertyId) {
        queryForTestimonials['property.id'] = queryForTestimonials.propertyId;
        delete queryForTestimonials.propertyId;
      }

      // Convert the query parameters to match ElasticAPIFeatures format
      const elasticQuery = {
        page: query.page || 1,
        pageSize: query.limit || 20,
        ...queryForTestimonials, // Include all other query parameters directly
      };

      const features = (
        await new ElasticAPIFeatures(ModuleName.TESTIMONIAL, elasticQuery, this._elasticService).filter()
      )
        .search()
        .sort()
        .limitFields();

      const esQuery = features.getQuery();
      const result = await this._elasticService.search(ModuleName.TESTIMONIAL, esQuery);

      const testimonials = result.hits.hits.map((hit) => ({
        _id: hit._id,
        ...(hit._source as TTestimonialDocument),
      }));

      return {
        data: testimonials,
        total: result.hits.total,
        lastId: testimonials.length > 0 ? testimonials[testimonials.length - 1]._id.toString() : null,
      };
    } catch (error) {
      console.error('Error in fetching Testimonials from Elasticsearch and fallback to MongoDB:', error);
      const testimonials = await this.findAll(query, user);
      return {
        data: testimonials.data,
        total: testimonials.total,
        lastId: testimonials.lastId,
      };
    }
  }

  async findOne(id: string, user: TCurrentUserType): Promise<Testimonial> {
    const testimonial = await this.testimonialModel.findOne({ _id: id }).exec();

    if (!testimonial) {
      throw new NotFoundException(
        "Testimonial not found or you don't have permission to access it"
      );
    }
    // Admin users can only access testimonials in their organization
    if (testimonial.organization.id !== user.organizationId) {
      throw new NotFoundException(
        "Testimonial not found or you don't have permission to access it"
      );
    }

    return testimonial;
  }

  async update(
    id: string,
    updateTestimonialDto: UpdateTestimonialDto,
    user: TCurrentUserType
  ): Promise<Testimonial> {
    // Verify access first
    const existingTestimonial = await this.findOne(id, user);

    const updatedTestimonial = await this.testimonialModel
      .findByIdAndUpdate(
        id,
        { ...updateTestimonialDto, updatedBy: buildUserMetadata(user) },
        { new: true }
      )
      .exec();

    await this._updateIndexedTestimonialInElasticSearch(updatedTestimonial);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.UPDATE,
      collectionName: ModuleName.TESTIMONIAL,
      user,
      objectId: updatedTestimonial._id as unknown as Types.ObjectId,
      existingData: existingTestimonial,
      newData: updatedTestimonial,
    });
    return updatedTestimonial;
  }

  async remove(id: string, user: TCurrentUserType): Promise<Testimonial> {
    // Verify access first
    const testimonial = await this.findOne(id, user);

    const deletedTestimonial = await this.testimonialModel.findByIdAndDelete(id).exec();

    // Delete from Elasticsearch
    await this._elasticService.deleteDocument(ModuleName.TESTIMONIAL, id);

    await this._auditTrailService.logAuditTrail({
      action: ACTIONS.DELETE,
      collectionName: ModuleName.TESTIMONIAL,
      user,
      objectId: new Types.ObjectId(id),
      existingData: testimonial,
      newData: null,
    });
    return deletedTestimonial;
  }
}