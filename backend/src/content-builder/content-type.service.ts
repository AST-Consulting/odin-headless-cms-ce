import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { DynamicModelRegistry } from '@entries/registry/dynamic-model.registry';
import { IndexManagerService } from '@entries/registry/index-manager.service';
import { FieldTypeRegistry } from '@entries/registry/field-type.registry';
import {
  ContentType,
  TContentTypeDocument,
} from './schemas/content-type.schema';
import { CreateContentTypeDto } from './dto/content-type.create.dto';
import { UpdateContentTypeDto } from './dto/content-type.update.dto';

@Injectable()
export class ContentTypeService {
  constructor(
    @InjectModel(ContentType.name)
    private readonly _contentTypeModel: Model<TContentTypeDocument>,
    private readonly _registry: DynamicModelRegistry,
    private readonly _indexManager: IndexManagerService,
    private readonly _fieldTypes: FieldTypeRegistry,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {}

  async create(dto: CreateContentTypeDto, userId?: string): Promise<TContentTypeDocument> {
    const collectionName = dto.collectionName || dto.pluralName;
    await this._ensureUniqueness(dto.pluralName, dto.singularName, collectionName);
    this._validateFields(dto.fields || []);

    const doc = await this._contentTypeModel.create({
      ...dto,
      collectionName,
      fields: dto.fields || [],
      indexes: dto.indexes || [],
      createdBy: userId,
      updatedBy: userId,
    });

    this._registry.register(doc);
    await this._indexManager.syncIndexes(doc);
    return doc;
  }

  findAll(): Promise<TContentTypeDocument[]> {
    return this._contentTypeModel.find().sort({ createdAt: -1 }).exec();
  }

  async findById(id: string): Promise<TContentTypeDocument> {
    const doc = await this._contentTypeModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Content type not found');
    return doc;
  }

  async update(
    id: string,
    dto: UpdateContentTypeDto,
    userId?: string,
  ): Promise<TContentTypeDocument> {
    const existing = await this.findById(id);

    if (dto.fields) this._validateFields(dto.fields);

    if (dto.pluralName && dto.pluralName !== existing.pluralName) {
      await this._ensureUniquePluralName(dto.pluralName);
    }
    if (dto.singularName && dto.singularName !== existing.singularName) {
      await this._ensureUniqueSingularName(dto.singularName);
    }
    if (dto.collectionName && dto.collectionName !== existing.collectionName) {
      await this._ensureUniqueCollectionName(dto.collectionName);
    }

    Object.assign(existing, dto, { updatedBy: userId });
    await existing.save();

    this._registry.register(existing);
    await this._indexManager.syncIndexes(existing);
    return existing;
  }

  async publish(id: string, userId?: string): Promise<TContentTypeDocument> {
    const doc = await this.findById(id);
    doc.status = 'published';
    doc.updatedBy = userId as any;
    await doc.save();
    return doc;
  }

  async setListColumns(id: string, columns: string[]): Promise<TContentTypeDocument> {
    const doc = await this.findById(id);
    doc.set('listColumns', columns);
    await doc.save();
    return doc;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const doc = await this.findById(id);
    this._registry.drop(doc._id.toString());
    await this._contentTypeModel.deleteOne({ _id: id }).exec();
    return { deleted: true };
  }

  async bootstrapAll(): Promise<void> {
    const all = await this._contentTypeModel.find().exec();
    for (const ct of all) {
      try {
        this._registry.register(ct);
      } catch (err: any) {
        this._logger.error(
          `Failed to register "${ct.collectionName}": ${err?.message}`,
          err?.stack,
          ContentTypeService.name,
        );
      }
    }
    this._logger.log(
      `Bootstrapped ${all.length} dynamic content types`,
      ContentTypeService.name,
    );
  }

  private async _ensureUniqueness(
    pluralName: string,
    singularName: string,
    collectionName: string,
  ): Promise<void> {
    const conflict = await this._contentTypeModel
      .findOne({
        $or: [{ pluralName }, { singularName }, { collectionName }],
      })
      .exec();
    if (conflict) {
      throw new ConflictException(
        `Content type already exists with pluralName/singularName/collectionName`,
      );
    }
  }

  private async _ensureUniquePluralName(pluralName: string): Promise<void> {
    const conflict = await this._contentTypeModel.findOne({ pluralName }).exec();
    if (conflict) throw new ConflictException(`pluralName "${pluralName}" already in use`);
  }

  private async _ensureUniqueSingularName(singularName: string): Promise<void> {
    const conflict = await this._contentTypeModel.findOne({ singularName }).exec();
    if (conflict) {
      throw new ConflictException(`singularName "${singularName}" already in use`);
    }
  }

  private async _ensureUniqueCollectionName(collectionName: string): Promise<void> {
    const conflict = await this._contentTypeModel.findOne({ collectionName }).exec();
    if (conflict) {
      throw new ConflictException(`collectionName "${collectionName}" already in use`);
    }
  }

  private _validateFields(fields: { name: string; type: string }[]): void {
    const seen = new Set<string>();
    for (const f of fields) {
      if (seen.has(f.name)) {
        throw new BadRequestException(`Duplicate field name "${f.name}"`);
      }
      seen.add(f.name);
      if (!this._fieldTypes.has(f.type as any)) {
        throw new BadRequestException(`Unsupported field type "${f.type}"`);
      }
    }
  }
}
