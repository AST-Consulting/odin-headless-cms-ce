import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FieldTypeRegistry } from '@entries/registry/field-type.registry';
import { Component, TComponentDocument } from './schemas/component.schema';
import { CreateComponentDto, UpdateComponentDto } from './dto/component.dto';

@Injectable()
export class ComponentService {
  constructor(
    @InjectModel(Component.name)
    private readonly _componentModel: Model<TComponentDocument>,
    private readonly _fieldTypes: FieldTypeRegistry,
  ) {}

  async create(dto: CreateComponentDto, userId?: string): Promise<TComponentDocument> {
    const exists = await this._componentModel.findOne({ displayName: dto.displayName }).exec();
    if (exists) {
      throw new ConflictException(`Component "${dto.displayName}" already exists`);
    }
    this._validateFields(dto.fields || []);
    return this._componentModel.create({
      ...dto,
      fields: dto.fields || [],
      createdBy: userId,
      updatedBy: userId,
    });
  }

  findAll(): Promise<TComponentDocument[]> {
    return this._componentModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<TComponentDocument> {
    const doc = await this._componentModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Component not found');
    return doc;
  }

  async update(
    id: string,
    dto: UpdateComponentDto,
    userId?: string,
  ): Promise<TComponentDocument> {
    const doc = await this.findOne(id);
    if (dto.fields) this._validateFields(dto.fields);
    Object.assign(doc, dto, { updatedBy: userId });
    await doc.save();
    return doc;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const res = await this._componentModel.deleteOne({ _id: id }).exec();
    if (!res.deletedCount) throw new NotFoundException('Component not found');
    return { deleted: true };
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
