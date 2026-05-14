import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { ApiKey, ApiKeyDocument } from './schemas/api-key.schema';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { OrganizationService } from '@organization/organization.service';
import { buildUserMetadata } from 'src/core/utils/utils';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel(ApiKey.name) private readonly _apiKeyModel: Model<ApiKeyDocument>,
    private readonly _organizationService: OrganizationService,
  ) {}

  async create(dto: CreateApiKeyDto, user: TCurrentUserType): Promise<{ apiKey: ApiKeyDocument; rawKey: string }> {
    const rawKey = this._generateRawKey();
    const keyHash = this._hash(rawKey);

    const orgId = dto.organizationId ?? user.organizationId;
    let organization: ApiKey['organization'];
    if (orgId) {
      const org = await this._organizationService.findOne(orgId);
      organization = {
        id: org._id.toString(),
        name: org.organization_name,
        slug: org.slug,
        domain: org.domain,
      };
    }

    const apiKey = await this._apiKeyModel.create({
      name: dto.name,
      keyHash,
      organization,
      createdBy: buildUserMetadata(user),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    return { apiKey, rawKey };
  }

  async findAll(userId: string): Promise<ApiKeyDocument[]> {
    return this._apiKeyModel
      .find({ 'createdBy.id': userId })
      .select('-keyHash')
      .sort({ createdAt: -1 })
      .exec();
  }

  async revoke(id: string, userId: string): Promise<void> {
    const result = await this._apiKeyModel.findOneAndDelete({
      _id: id,
      'createdBy.id': userId,
    });
    if (!result) throw new NotFoundException('API key not found');
  }

  async update(id: string, dto: UpdateApiKeyDto, user: TCurrentUserType): Promise<ApiKeyDocument> {
    const update: Partial<ApiKey> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.expiresAt !== undefined) update.expiresAt = new Date(dto.expiresAt);
    update.updatedBy = buildUserMetadata(user);

    const apiKey = await this._apiKeyModel
      .findOneAndUpdate(
        { _id: id, 'createdBy.id': user.sub },
        update,
        { new: true },
      )
      .select('-keyHash');
    if (!apiKey) throw new NotFoundException('API key not found');
    return apiKey;
  }

  async validate(rawKey: string): Promise<ApiKeyDocument> {
    const keyHash = this._hash(rawKey);
    const apiKey = await this._apiKeyModel.findOne({ keyHash, isActive: true });

    if (!apiKey) throw new UnauthorizedException('Invalid API key');
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    await this._apiKeyModel.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).exec();

    return apiKey;
  }

  private _generateRawKey(): string {
    return `odin_${crypto.randomBytes(24).toString('base64url')}`;
  }

  private _hash(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
