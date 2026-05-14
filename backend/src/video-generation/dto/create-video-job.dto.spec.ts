import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVideoJobDto } from './create-video-job.dto';

describe('CreateVideoJobDto contract compatibility', () => {
  it('accepts legacy media assets without clip metadata', async () => {
    const dto = plainToInstance(CreateVideoJobDto, {
      title: 'Test title',
      content: 'Test content body',
      mediaAssets: [
        {
          url: 'https://example.com/image.jpg',
          alt: 'legacy asset',
          source: 'stock',
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts enriched media assets with clip metadata', async () => {
    const dto = plainToInstance(CreateVideoJobDto, {
      title: 'Test title',
      content: 'Test content body',
      mediaAssets: [
        {
          url: 'https://example.com/video.mp4',
          alt: 'clip asset',
          source: 'media-gallery',
          assetType: 'video',
          sourceId: 'abc123',
          durationSec: 12.5,
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts legacy duration field and normalizes numeric value', async () => {
    const dto = plainToInstance(CreateVideoJobDto, {
      title: 'Test title',
      content: 'Test content body',
      mediaAssets: [
        {
          url: 'https://example.com/video.mp4',
          source: 'media-gallery',
          assetType: 'video',
          duration: '18.25',
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid assetType values', async () => {
    const dto = plainToInstance(CreateVideoJobDto, {
      title: 'Test title',
      content: 'Test content body',
      mediaAssets: [
        {
          url: 'https://example.com/image.jpg',
          assetType: 'gif',
        },
      ],
    });

    const errors = await validate(dto);
    const mediaAssetsError = errors.find((error) => error.property === 'mediaAssets');
    expect(mediaAssetsError).toBeDefined();
    expect(mediaAssetsError?.children?.length).toBeGreaterThan(0);
  });
});
