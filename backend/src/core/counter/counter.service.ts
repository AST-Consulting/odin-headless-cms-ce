import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Counter, TCounterDocumnet } from './counter.schema';

@Injectable()
export class CounterService {
  constructor(@InjectModel(Counter.name) private counterModel: Model<TCounterDocumnet>) {}

  async create(name: string): Promise<Counter> {
    const createdCounter = new this.counterModel({ name });

    return createdCounter.save();
  }

  async findAll(): Promise<Counter[]> {
    return this.counterModel.find().exec();
  }

  async findOne(name: string): Promise<Counter> {
    const counter = await this.counterModel.findOne({ name }).exec();

    return counter;
  }

  async increment(name: string): Promise<Counter> {
    const counter = await this.counterModel
      .findOneAndUpdate({ name }, { $inc: { count: 1 } }, { new: true, upsert: true })
      .exec();

    return counter;
  }

  async delete(name: string): Promise<Counter> {
    const counter = await this.counterModel.findOneAndDelete({ name }).exec();
    if (!counter) {
      throw new NotFoundException(`Counter with name "${name}" not found`);
    }

    return counter;
  }
}
