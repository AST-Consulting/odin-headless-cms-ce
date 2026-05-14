import { Injectable, Logger } from '@nestjs/common';
import mongoose, { Model, Document } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { AuditTrailDto } from './dto/audit-trail.dto'; // Import your AuditTrail DTO if needed
import { AuditTrail } from './entities/audit-trail.schema';
import { ICreateAuditTrail } from './entities/create-audit-trail.interface';
import { InjectQueue } from '@nestjs/bullmq';
import { QUEUE_CONSTANTS } from '../constants/redis.constants';
import { Queue } from 'bullmq';
import { getFilters } from '../utils/getFilters';
import { APIFeatures } from '../utils/apiFeatures.utils';
import { STATUS } from '../constants/enums.constants';

@Injectable()
export class AuditTrailService {
  private readonly _logger = new Logger(AuditTrailService.name);

  constructor(
    @InjectModel(AuditTrail.name)
    private readonly _auditTrailModel: Model<AuditTrail>,
    @InjectQueue(QUEUE_CONSTANTS.AUDIT_QUEUE) private _auditQueue: Queue
  ) {}

  /**
   * Retrieve all audit trail entries
   * @returns { Promise<{ data: AuditTrail[]; total: number }>} A promise that resolves to an array of AuditTrail documents
   */
  async getAllAuditTrailEntries(query: any): Promise<{ data: AuditTrail[]; total: number }> {
    const filters = getFilters(query);
    const total = await this._auditTrailModel.countDocuments(filters);
    const features = new APIFeatures(this._auditTrailModel, query)
      .filter()
      .search()
      .sort()
      .limitFields()
      .paginate();
    const doc = await features.getQuery().exec();

    return { data: doc, total };
  }

  async getMarkedDeletedAuditTrailEntries(date: Date): Promise<AuditTrail[]> {
    const markedDeletedEntries = await this._auditTrailModel
      .find({ deletionDate: { $lt: date }, status: STATUS.TO_BE_DELETED })
      .exec();

    return markedDeletedEntries;
  }

  async markDeletedAuditTrailEntries(date: Date): Promise<void> {
    try {
      await this._auditTrailModel.updateMany(
        { deletionDate: { $lt: date }, status: STATUS.TO_BE_DELETED },
        { status: STATUS.DELETED }
      );
    } catch (error) {
      this._logger.error(`Failed to mark AuditTrail documents for deletion: ${error.message}`);
      throw new Error(`Failed to mark AuditTrail documents for deletion: ${error.message}`);
    }
  }

  // /**
  //  * Retrieve audit trail entries by object ID
  //  * @param {any} query The query object
  //  * @param {string} id The object ID
  //  * @returns {Promise<any>} A promise that resolves to the audit trail data
  //  */
  // async getAuditTrailEntriesById(query: any, id: string): Promise<any> {
  //   try {
  //     const filters = getFilters(query);
  //     const baseQuery = this._auditTrailModel.aggregate([
  //       { $match: { objectId: id } },
  //       { $unwind: { path: '$changes' } },
  //       {
  //         $project: {
  //           _id: '$changes._id',
  //           action: 1,
  //           collectionName: 1,
  //           fieldName: '$changes.fieldName',
  //           oldValue: '$changes.oldValue',
  //           newValue: '$changes.newValue',
  //           updatedBy: '$updatedBy.userName',
  //           updatedAt: 1,
  //         },
  //       },
  //     ]);

  //     const total = await this._auditTrailModel.aggregate([
  //       { $match: { objectId: id, ...filters } },
  //       { $unwind: { path: '$changes' } },
  //       {
  //         $group: {
  //           _id: null,
  //           count: { $sum: 1 },
  //         },
  //       },
  //     ]);

  //     const features = new APIFeatures(this._auditTrailModel, query)
  //       .filter('aggregate')
  //       .sort()
  //       .paginate();

  //     const documents = await features.query;

  //     return {
  //       results: documents.length,
  //       total: total.length > 0 ? total[0].count : 0,
  //       data: documents,
  //     };
  //   } catch (error) {
  //     this._logger.error(
  //       `Failed to retrieve AuditTrail documents: ${error.message}`,
  //     );
  //     throw new Error(
  //       `Failed to retrieve AuditTrail documents: ${error.message}`,
  //     );
  //   }
  // }

  /**
   * Create a new audit trail entry.
   *
   * @param auditTrailDto - The audit trail DTO.
   * @returns A promise that resolves to the created AuditTrail document.
   */
  async saveAuditTrail(auditTrailDto: AuditTrailDto): Promise<AuditTrail> {
    try {
      const auditTrail = new this._auditTrailModel(auditTrailDto);
      const createdAuditTrail = await auditTrail.save();

      return createdAuditTrail;
    } catch (error) {
      this._logger.error(`Failed to create AuditTrail entry: ${error.message}`);
      throw new Error(`Failed to create AuditTrail entry: ${error.message}`);
    }
  }
  /**
   * Check and update fields for audit trail
   *
   * @param action - The action performed (create, update, delete)
   * @param collectionName - The name of the collection
   * @param user - The user performing the action
   * @param objectId - The ID of the object being modified
   * @param existingData - The existing data (before update), optional
   * @param newData - The new data (after update), optional
   */
  async createAuditTrail(data: ICreateAuditTrail): Promise<void> {
    const { action, collectionName, user, objectId, existingData, newData } = data;
    const userId = user?.sub || 'System';
    const name = user?.name || 'System';
    const changes: { fieldName: string; oldValue: string; newValue: string }[] = [];

    const ignoredKeys = ['__v', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy', 'password'];

    // If both existingData and newData are available, perform update
    if (existingData && newData) {
      this._handleUpdateAuditTrail(existingData, newData, changes, ignoredKeys);
    }
    // If only existingData is available, perform delete
    else if (existingData) {
      this._handleDeleteAuditTrail(existingData, changes, ignoredKeys);
    }
    // If only newData is available, perform create
    else if (newData) {
      this._handleCreateAuditTrail(newData, changes, ignoredKeys);
    }
    await this.auditTrailHelper(
      action,
      collectionName,
      changes,
      userId,
      name,
      objectId ? objectId.toString() : ''
    );
  }

  /**
   * Helper function to handle creation of audit trail for updates
   */
  private _handleUpdateAuditTrail(
    existingData: Document,
    newData: Document,
    changes: { fieldName: string; oldValue: string; newValue: string }[],
    ignoredKeys: string[]
  ): void {
    // const updateObjKeys = Object.keys(newData['_doc']);
    const updateObjKeys = Object.keys(newData);

    updateObjKeys.forEach((key) => {
      if (!ignoredKeys.includes(key)) {
        const existingKeyValue = existingData[key];
        const newKeyValue = newData[key];

        if (JSON.stringify(newKeyValue) !== JSON.stringify(existingKeyValue)) {
          changes.push({
            fieldName: key,
            oldValue: existingKeyValue ? JSON.stringify(existingData[key]) : '',
            newValue: newKeyValue ? JSON.stringify(newData[key]) : '',
          });
        }
      }
    });
  }

  /**
   * Helper function to handle creation of audit trail for deletions
   */
  private _handleDeleteAuditTrail(
    existingData: Document,
    changes: { fieldName: string; oldValue: string; newValue: string }[],
    ignoredKeys: string[]
  ): void {
    // const objKeys = Object.keys(existingData['_doc']);
    const objKeys = Object.keys(existingData['_doc']);

    objKeys.forEach((key) => {
      if (!ignoredKeys.includes(key)) {
        changes.push({
          fieldName: key,
          oldValue: existingData[key] ? existingData[key].toString() : '',
          newValue: '',
        });
      }
    });
  }

  /**
   * Helper function to handle creation of audit trail for creations
   */
  private _handleCreateAuditTrail(
    newData: Document,
    changes: { fieldName: string; oldValue: string; newValue: string }[],
    ignoredKeys: string[]
  ): void {
    // const objKeys = Object.keys(newData['_doc']);
    const objKeys = Object.keys(newData);

    objKeys.forEach((key) => {
      if (!ignoredKeys.includes(key)) {
        const newKeyValue = newData[key];
        if (newKeyValue) {
          changes.push({
            fieldName: key,
            oldValue: '',
            newValue: JSON.stringify(newKeyValue),
          });
        }
      }
    });
  }

  /**
   * Helper function to determine if a value is a nested object
   */
  private _isNestedObject(value: any): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      !mongoose.Types.ObjectId.isValid(value) &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    );
  }

  /**
   * Helper function to create an audit trail entry
   */
  async auditTrailHelper(
    action: string,
    collectionName: string,
    changes: { fieldName: string; oldValue: string; newValue: string }[],
    userId: string,
    userName: string,
    objectId?: string
  ): Promise<void> {
    try {
      const auditTrailDto: AuditTrailDto = {
        action,
        collectionName,
        objectId: objectId || null,
        changes,
        createdBy: {
          userId,
          userName,
        },
        updatedBy: {
          userId,
          userName,
        },
      };

      await this.saveAuditTrail(auditTrailDto);
    } catch (error) {
      this._logger.error(`Error while creating audit trail: ${error.message}`);
    }
  }

  // You can add more service methods here for working with AuditTrail documents
  async logAuditTrail({
    action,
    collectionName,
    user,
    objectId,
    existingData,
    newData,
  }: ICreateAuditTrail): Promise<void> {
    this._logger.log('Adding audit trail to queue');
    try {
      await this._auditQueue.add(
        QUEUE_CONSTANTS.LOG_AUDIT_JOB,
        {
          action,
          collectionName,
          user,
          objectId,
          existingData,
          newData,
        },
        {
          attempts: 5, // Retry the job up to 5 times if it fails
          delay: 3000, // Delay the job processing by 3 seconds
          backoff: {
            type: 'exponential', // Use exponential backoff strategy
            delay: 2000, // Initial delay for retries is 2 seconds
          },
          removeOnComplete: true, // Automatically remove job when completed
          removeOnFail: false, // Keep the job in the queue if it fails (optional)
          priority: 1, // Job priority (lower number = higher priority)
        }
      );
      this._logger.log('Audit trail job added to queue successfully');
    } catch (error) {
      this._logger.error(`Failed to add audit trail job to queue: ${error.message}`);
      throw error;
    }
  }
}
