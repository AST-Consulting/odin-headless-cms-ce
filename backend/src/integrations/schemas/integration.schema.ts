import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Organization } from 'src/organization/entities/organization.schema';
import { Property } from 'src/property/schema/property.schema';
import { User } from 'src/user/entities/user.schema';

export type IntegrationDocument = Integration & Document;

export enum IntegrationProvider {
    GOOGLE_ANALYTICS = 'google_analytics',
    SEARCH_CONSOLE = 'search_console',
    YOUTUBE = 'youtube',
    FACEBOOK = 'facebook',
    INSTAGRAM = 'instagram',
    TWITTER = 'twitter',
    LINKEDIN = 'linkedin',
}

export enum IntegrationStatus {
    PENDING_SELECTION = 'pending_selection',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    EXPIRED = 'expired',
    ERROR = 'error',
}

@Schema({ timestamps: true })
export class Integration {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: Organization.name, required: true })
    organizationId: Organization | string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: Property.name, required: true })
    propertyId: Property | string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
    userId: User | string;

    @Prop({ type: String, enum: IntegrationProvider, required: true })
    provider: IntegrationProvider;

    @Prop({ type: String, enum: IntegrationStatus, default: IntegrationStatus.CONNECTED })
    status: IntegrationStatus;

    // Securely store OAuth credentials
    @Prop({
        type: {
            accessToken: { type: String },
            refreshToken: { type: String },
            expiresAt: { type: Date },
            scope: { type: String },
            tokenType: { type: String },
        },
        default: {},
    })
    credentials?: {
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: Date;
        scope?: string;
        tokenType?: string;
    };

    // Provider specific configuration/metadata (e.g. GA Property ID, GSC siteUrl)
    @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
    metadata: Record<string, any>;
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);

// Create compound index for property and provider to ensure only one active integration per provider per property
IntegrationSchema.index({ propertyId: 1, provider: 1 }, { unique: true });
