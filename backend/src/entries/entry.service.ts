import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as ExcelJS from 'exceljs';
import {
  ContentType,
  TContentTypeDocument,
} from '@content-builder/schemas/content-type.schema';
import { Field } from '@content-builder/schemas/field.schema';
import { User } from 'src/user/entities/user.schema';
import { ComponentService } from '@content-builder/component.service';
import { DynamicModelRegistry } from './registry/dynamic-model.registry';
import { EntryValidator } from './entry.validator';
import { FilterKeyTranslator } from './registry/filter-key.translator';
import { CreateEntryDto, UpdateEntryDto } from './dto/entry.dto';
import { APIFeatures } from 'src/core/utils/apiFeatures.utils';
import { getFilters } from 'src/core/utils/getFilters';

export interface IImportResult {
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
}

export interface IPagedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Generic CRUD over any ContentType's dynamic collection.
 *
 * Routing:
 *   - Plural name → list many
 *   - Singular name + :id → single-doc ops (create / findOne / update / delete)
 */
@Injectable()
export class EntryService {
  constructor(
    @InjectModel(ContentType.name)
    private readonly _contentTypeModel: Model<TContentTypeDocument>,
    @InjectModel(User.name)
    private readonly _userModel: Model<any>,
    private readonly _registry: DynamicModelRegistry,
    private readonly _validator: EntryValidator,
    private readonly _filterTranslator: FilterKeyTranslator,
    private readonly _componentService: ComponentService,
  ) {}

  // ---------- Listing (plural) ----------

  async list(
    pluralName: string,
    rawQuery: Record<string, any>,
  ): Promise<IPagedResult<any>> {
    const contentType = await this._resolveByPlural(pluralName);
    const model = this._modelFor(contentType);

    const translated = this._filterTranslator.translate(contentType, rawQuery);
    const baseQuery = { ...translated, deletedAt: null };

    const features = new APIFeatures(model, baseQuery)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();

    const countFilter = getFilters({ ...baseQuery, lastId: undefined });
    const [raw, total] = await Promise.all([
      features.getQuery().exec(),
      model.countDocuments(countFilter).exec(),
    ]);

    const withUsers = await this._populateUsers(raw);
    const data = await this._populateRelations(withUsers, contentType);
    const page = Number(rawQuery.page || 1);
    const limit = Number(rawQuery.limit || 20);
    return { data, total, page, limit };
  }

  // ---------- Single-doc operations (singular) ----------

  async findOne(singularName: string, id: string) {
    const contentType = await this._resolveBySingular(singularName);
    const doc = await this._modelFor(contentType)
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!doc) throw new NotFoundException('Entry not found');
    const [withUser] = await this._populateUsers([doc]);
    const [populated] = await this._populateRelations([withUser], contentType);
    return populated;
  }

  async create(singularName: string, dto: CreateEntryDto, userId?: string) {
    const contentType = await this._resolveBySingular(singularName);
    const model = this._modelFor(contentType);
    const cleanData = this._validator.validateAndTransform(contentType, dto.data);
    return model.create({
      contentTypeId: contentType._id,
      data: cleanData,
      propertyId: this._toObjectId(dto.propertyId),
      organizationId: this._toObjectId(dto.organizationId),
      locale: dto.locale ?? null,
      status: dto.status || 'draft',
      publishedAt: dto.status === 'published' ? new Date() : null,
      createdBy: this._toObjectId(userId),
      updatedBy: this._toObjectId(userId),
    });
  }

  async importFromExcel(
    singularName: string,
    buffer: Buffer,
    meta: { status?: string; locale?: string; propertyId?: string; organizationId?: string },
    userId?: string,
  ): Promise<IImportResult> {
    const contentType = await this._resolveBySingular(singularName);
    const model = this._modelFor(contentType);

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BadRequestException('Could not parse the uploaded file as a valid Excel workbook');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel file contains no sheets');
    }

    const rows: Record<string, any>[] = [];
    let headers: string[] = [];
    
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          headers[colNumber] = cell.value ? String(cell.value) : '';
        });
        return;
      }
      
      const rowData: Record<string, any> = {};
      for (let i = 1; i < headers.length; i++) {
        if (headers[i]) rowData[headers[i]] = null;
      }

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          let val = cell.value;
          if (val && typeof val === 'object') {
            if ('richText' in val) val = (val as any).richText.map((rt: any) => rt.text).join('');
            else if ('result' in val) val = (val as any).result;
            else if ('text' in val) val = (val as any).text;
          }
          rowData[header] = val ?? null;
        }
      });
      rows.push(rowData);
    });

    if (!rows.length) {
      return { total: 0, imported: 0, failed: 0, errors: [] };
    }

    let imported = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // row 1 is the header
      const data = this._coerceRowValues(rows[i]);

      try {
        const cleanData = this._validator.validateAndTransform(contentType, data);
        await model.create({
          contentTypeId: contentType._id,
          data: cleanData,
          propertyId: this._toObjectId(meta.propertyId),
          organizationId: this._toObjectId(meta.organizationId),
          locale: meta.locale ?? null,
          status: meta.status || 'draft',
          publishedAt: meta.status === 'published' ? new Date() : null,
          createdBy: this._toObjectId(userId),
          updatedBy: this._toObjectId(userId),
        });
        imported++;
      } catch (err: any) {
        const details = err?.response?.errors;
        const message = Array.isArray(details) && details.length
          ? details.join('; ')
          : (err?.response?.message ?? err?.message ?? 'Unknown error');
        errors.push({ row: rowNum, message });
      }
    }

    return { total: rows.length, imported, failed: errors.length, errors };
  }

  async update(singularName: string, id: string, dto: UpdateEntryDto, userId?: string) {
    const contentType = await this._resolveBySingular(singularName);
    const existing = await this._modelFor(contentType)
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!existing) throw new NotFoundException('Entry not found');

    if (dto.data) {
      const cleanData = this._validator.validateAndTransform(contentType, dto.data, true);
      existing.set('data', { ...(existing.get('data') || {}), ...cleanData });
    }
    if (dto.locale !== undefined) existing.set('locale', dto.locale);
    if (dto.status) existing.set('status', dto.status);
    existing.set('updatedBy', this._toObjectId(userId));
    existing.set('version', (existing.get('version') || 1) + 1);
    await existing.save();
    return existing;
  }

  async remove(singularName: string, id: string, userId?: string) {
    const contentType = await this._resolveBySingular(singularName);
    const model = this._modelFor(contentType);
    const doc = await model
      .findOneAndUpdate(
        { _id: id },
        { deletedAt: new Date(), updatedBy: this._toObjectId(userId) },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Entry not found');
    return { deleted: true };
  }

  async publish(singularName: string, id: string, userId?: string) {
    const contentType = await this._resolveBySingular(singularName);
    return this._setPublishState(contentType, id, 'published', userId);
  }

  async unpublish(singularName: string, id: string, userId?: string) {
    const contentType = await this._resolveBySingular(singularName);
    return this._setPublishState(contentType, id, 'draft', userId);
  }

  // ---------- Shared helpers ----------

  private async _setPublishState(
    contentType: TContentTypeDocument,
    id: string,
    status: 'published' | 'draft',
    userId?: string,
  ) {
    const model = this._modelFor(contentType);
    const update: Record<string, any> = {
      status,
      updatedBy: this._toObjectId(userId),
      $inc: { version: 1 },
    };
    if (status === 'published') update.publishedAt = new Date();
    else update.unpublishedAt = new Date();

    const doc = await model.findByIdAndUpdate(id, update, { new: true }).exec();
    if (!doc) throw new NotFoundException('Entry not found');
    return doc;
  }

  private async _resolveByPlural(pluralName: string): Promise<TContentTypeDocument> {
    const ct = await this._contentTypeModel.findOne({ pluralName }).exec();
    if (!ct) {
      throw new NotFoundException(`No content type with pluralName "${pluralName}"`);
    }
    return ct;
  }

  private async _resolveBySingular(singularName: string): Promise<TContentTypeDocument> {
    const ct = await this._contentTypeModel.findOne({ singularName }).exec();
    if (!ct) {
      throw new NotFoundException(`No content type with singularName "${singularName}"`);
    }
    return ct;
  }

  private _modelFor(contentType: TContentTypeDocument) {
    const id = contentType._id.toString();
    if (!this._registry.hasId(id)) {
      this._registry.register(contentType);
    }
    return this._registry.getById(id);
  }

  private _toObjectId(id?: string): Types.ObjectId | undefined {
    if (!id || !Types.ObjectId.isValid(id)) return undefined;
    return new Types.ObjectId(id);
  }

  // ---------- Relation population ----------

  private async _populateRelations(docs: any[], contentType: TContentTypeDocument): Promise<any[]> {
    // Pre-load all component field definitions once
    const compDocs = await this._componentService.findAll();
    const componentCache = new Map<string, Field[]>(
      compDocs.map(c => [c._id.toString(), c.fields ?? []]),
    );

    // Collect all IDs that need to be fetched, grouped by pluralName
    const toFetch = new Map<string, Set<string>>();
    for (const doc of docs) {
      this._collectIds(doc.data ?? {}, contentType.fields, componentCache, toFetch);
    }
    if (!toFetch.size) return docs;

    // Fetch related documents in bulk per content type
    const resolved = new Map<string, Map<string, any>>();
    for (const [pluralName, ids] of toFetch) {
      try {
        const ct = await this._resolveByPlural(pluralName).catch(() => null);
        if (!ct) continue;
        const model = this._modelFor(ct);
        const entries = await model
          .find({ _id: { $in: [...ids].map(id => new Types.ObjectId(id)) }, deletedAt: null })
          .lean()
          .exec();
        resolved.set(pluralName, new Map(entries.map(e => [e._id.toString(), e])));
      } catch {}
    }
    if (!resolved.size) return docs;

    return docs.map(doc => ({
      ...doc,
      data: this._replaceIds(doc.data ?? {}, contentType.fields, componentCache, resolved),
    }));
  }

  private _collectIds(
    data: Record<string, any>,
    fields: Field[],
    componentCache: Map<string, Field[]>,
    out: Map<string, Set<string>>,
  ): void {
    for (const field of fields) {
      const val = data[field.name];
      if (val === undefined || val === null) continue;

      if (field.type === 'relation' && field.relationTarget) {
        if (!out.has(field.relationTarget)) out.set(field.relationTarget, new Set());
        const ids = field.repeatable ? (Array.isArray(val) ? val : []) : [val];
        for (const id of ids) {
          if (id) out.get(field.relationTarget)!.add(id.toString());
        }
      } else if (field.type === 'component' && field.componentRef) {
        const compFields = componentCache.get(field.componentRef) ?? [];
        const items = field.repeatable ? (Array.isArray(val) ? val : []) : [val];
        for (const item of items) {
          if (item && typeof item === 'object') {
            this._collectIds(item, compFields, componentCache, out);
          }
        }
      } else if (field.type === 'dynamiczone' && Array.isArray(val)) {
        const zoneFields = (field.zoneFields ?? []) as Field[];
        for (const item of val) {
          if (item && typeof item === 'object') {
            this._collectIds(item, zoneFields, componentCache, out);
          }
        }
      }
    }
  }

  private _replaceIds(
    data: Record<string, any>,
    fields: Field[],
    componentCache: Map<string, Field[]>,
    resolved: Map<string, Map<string, any>>,
  ): Record<string, any> {
    const result = { ...data };
    for (const field of fields) {
      const val = result[field.name];
      if (val === undefined || val === null) continue;

      if (field.type === 'relation' && field.relationTarget) {
        const map = resolved.get(field.relationTarget);
        if (!map) continue;
        if (field.repeatable) {
          result[field.name] = (Array.isArray(val) ? val : []).map(
            id => map.get(id?.toString()) ?? id,
          );
        } else {
          result[field.name] = map.get(val?.toString()) ?? val;
        }
      } else if (field.type === 'component' && field.componentRef) {
        const compFields = componentCache.get(field.componentRef) ?? [];
        if (field.repeatable) {
          result[field.name] = (Array.isArray(val) ? val : []).map(item =>
            item && typeof item === 'object'
              ? this._replaceIds(item, compFields, componentCache, resolved)
              : item,
          );
        } else if (val && typeof val === 'object') {
          result[field.name] = this._replaceIds(val, compFields, componentCache, resolved);
        }
      } else if (field.type === 'dynamiczone' && Array.isArray(val)) {
        const zoneFields = (field.zoneFields ?? []) as Field[];
        result[field.name] = val.map(item =>
          item && typeof item === 'object'
            ? this._replaceIds(item, zoneFields, componentCache, resolved)
            : item,
        );
      }
    }
    return result;
  }

  private async _fetchRelatedDoc(id: any, pluralName: string): Promise<any> {
    // Already a full embedded object — pass through (idempotent re-saves)
    if (id && typeof id === 'object') return id;
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) return id;
    try {
      const ct = await this._resolveByPlural(pluralName).catch(() => null);
      if (!ct) return id;
      const doc = await this._modelFor(ct)
        .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
        .lean()
        .exec();
      return doc ?? id;
    } catch {
      return id;
    }
  }

  // ---------- Coerce raw Excel cell values ----------

  private _coerceRowValues(row: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length > 1) {
          try {
            result[key] = JSON.parse(trimmed);
            continue;
          } catch {
            // fall through — keep as string
          }
        }
        result[key] = trimmed === '' ? null : trimmed;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  // ---------- Populate users (createdBy / updatedBy) ----------

  private async _populateUsers(docs: any[]): Promise<any[]> {
    const ids = new Set<string>();
    for (const doc of docs) {
      const d = doc.toObject ? doc.toObject() : doc;
      if (d.createdBy) ids.add(d.createdBy.toString());
      if (d.updatedBy) ids.add(d.updatedBy.toString());
    }
    if (!ids.size) return docs.map(d => (d.toObject ? d.toObject() : d));

    const users = await this._userModel
      .find({ _id: { $in: [...ids].map(id => new Types.ObjectId(id)) } })
      .select('_id name')
      .lean()
      .exec();

    const userMap = new Map(users.map(u => [u._id.toString(), { id: u._id.toString(), name: u.name }]));

    return docs.map(doc => {
      const obj = doc.toObject ? doc.toObject() : { ...doc };
      if (obj.createdBy) obj.createdBy = userMap.get(obj.createdBy.toString()) ?? { id: obj.createdBy.toString(), name: null };
      if (obj.updatedBy) obj.updatedBy = userMap.get(obj.updatedBy.toString()) ?? { id: obj.updatedBy.toString(), name: null };
      return obj;
    });
  }
}