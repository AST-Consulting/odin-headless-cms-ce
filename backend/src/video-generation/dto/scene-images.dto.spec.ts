import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SceneImagesDto } from './scene-images.dto';

describe('SceneImagesDto contract compatibility', () => {
  it('accepts legacy payload without new optional fields', async () => {
    const dto = plainToInstance(SceneImagesDto, {
      query: 'indian budget highlights',
      orientation: 'landscape',
      perPage: 5,
      returnAll: true,
      imageProvider: 'auto',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts enhanced payload with video + property context', async () => {
    const dto = plainToInstance(SceneImagesDto, {
      query: 'indian budget highlights',
      fallbackQueries: ['finance minister speech'],
      orientation: 'landscape',
      perPage: 8,
      returnAll: true,
      imageProvider: 'auto',
      includeVideos: true,
      propertyId: 'prop_123',
      contextTitle: 'Union Budget Highlights',
      contextCategory: 'business',
      language: 'en',
      page: 2,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
