import { Injectable } from '@nestjs/common';
import { MongooseModuleOptions } from '@nestjs/mongoose';
import { ApiConfigService } from '../config/config.service';

@Injectable()
export class MongoConfigService {
  constructor(private _config: ApiConfigService) {}

  createMongooseOptions(): MongooseModuleOptions {
    return {
      dbName: this._config.mongoDB.database,
      uri: this._config.mongoDB.uri,
    };
  }
}
