import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { Article, TArticleDocument } from 'src/articles/schemas/article.schema';
import { FileUploadService } from 'src/utilities/file-upload/fileUpload.service';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { PlanScenesDto } from './dto/plan-scenes.dto';
import { PublishVideoJobDto } from './dto/publish-video-job.dto';
import { SceneImagesDto } from './dto/scene-images.dto';
import { TtsDto } from './dto/tts.dto';
import {
  VideoGenerationJob,
  VideoGenerationJobDocument,
  VideoGenerationJobStatus,
} from './schemas/video-generation-job.schema';

@Injectable()
export class VideoGenerationService {
  constructor(
    @InjectModel(VideoGenerationJob.name)
    private readonly _videoJobModel: Model<VideoGenerationJobDocument>,
    @InjectModel(Article.name)
    private readonly _articleModel: Model<TArticleDocument>,
    private readonly _configService: ConfigService,
    private readonly _fileUploadService: FileUploadService
  ) {}

  private _getGeminiApiKey(): string {
    return (this._configService.get<string>('GEMINI_API_KEY') || '')
      .replace(/^\uFEFF/, '')
      .replace(/['"]/g, '')
      .trim();
  }

  private _sanitizeJson(raw: string): string {
    return raw
      .replace(/\/\/[^\n"]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
  }

  private _parseGeminiJson(raw: string): any {
    try {
      return JSON.parse(raw);
    } catch {
      // continue
    }
    const sanitized = this._sanitizeJson(raw);
    try {
      return JSON.parse(sanitized);
    } catch {
      const match = sanitized.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    }
    throw new InternalServerErrorException('Could not parse Gemini JSON response');
  }

  async planScenes(payload: PlanScenesDto) {
    const apiKey = this._getGeminiApiKey();
    if (!apiKey) {
      throw new BadRequestException('GEMINI_API_KEY is not configured on backend');
    }
    const maxScenes = Number(payload.maxScenes || 6);
    const language = payload.language || 'en';
    const voice = payload.voice || 'neutral';
    const aspectRatio = payload.aspectRatio || '16:9';
    const category = payload.category || 'general';
    const includeHook = payload.includeHook !== false;
    const schema = `{
  "title":"string",
  "scenes":[
    {"id":"string","order":1,"headline":"string","narration":"string","durationSeconds":6,"visualQuery":"string","visualQueryFallbacks":["string"],"ttsRate":1}
  ]
}`;
    const systemPrompt = 'Return strict JSON only.';
    const userPrompt = `Create a short video scene plan for this article.
Title: ${payload.title}
Content: ${(payload.content || '').slice(0, 3000)}

Rules:
- ${Math.max(4, Math.min(8, maxScenes))} scenes
- each narration 12-28 words
- visualQuery must be English stock-photo searchable
- keep duration 4-8 seconds per scene
- language: ${language}
- voice style: ${voice}
- aspect ratio target: ${aspectRatio}
- category: ${category}
- include hook scene: ${includeHook ? 'yes' : 'no'}

Output schema:
${schema}`;

    const model = this._configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => 'Gemini request failed');
      throw new BadRequestException(err);
    }
    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!rawText) {
      throw new InternalServerErrorException('Empty response from Gemini planning');
    }
    return this._parseGeminiJson(rawText);
  }

  async sceneImages(payload: SceneImagesDto, user: TCurrentUserType) {
    const pexelsKey = (this._configService.get<string>('PEXELS_API_KEY') || '').trim();
    const serperKey = (this._configService.get<string>('SERPER_API_KEY') || '').replace(/^\uFEFF/, '').trim();

    const query = payload.query;
    const fallback = payload.fallbackQueries || [];
    const orientation = payload.orientation || 'landscape';
    const perPage = Math.min(Math.max(Number(payload.perPage || 5), 1), 20);
    const page = Math.max(Number(payload.page || 1), 1);
    const returnAll = Boolean(payload.returnAll);
    const provider = payload.imageProvider || 'auto';
    const clipSelectionEnabled = String(
      this._configService.get<string>('VIDEO_GENERATOR_CLIP_SELECTION_ENABLED') ?? 'true'
    ).toLowerCase() !== 'false';
    const includeVideos = clipSelectionEnabled && Boolean(payload.includeVideos);
    const scopedPropertyId = String(payload.propertyId || user?.propertyId || '').trim() || undefined;
    const scopedOrganizationId = String(user?.organizationId || '').trim() || undefined;
    const contextTitle = String(payload.contextTitle || '').trim();
    const contextCategory = String(payload.contextCategory || '').trim().toLowerCase();
    const language = String(payload.language || '').trim().toLowerCase();

    const tokenize = (text: string): string[] =>
      text
        .toLowerCase()
        .replace(/[^a-z0-9\u0900-\u097f\u0980-\u09ff\u0b80-\u0bff\u0c00-\u0c7f\s-]/g, ' ')
        .split(/[\s-]+/)
        .map((t) => t.trim())
        .filter(Boolean);

    const stopwords = new Set([
      'the',
      'and',
      'for',
      'with',
      'from',
      'this',
      'that',
      'news',
      'photo',
      'image',
      'editorial',
      'video',
      'scene',
      'about',
      'into',
      'after',
      'before',
      'over',
      'under',
    ]);
    const allContext = [query, ...fallback, contextTitle, contextCategory].join(' ');
    const tokenCounts = new Map<string, number>();
    for (const token of tokenize(allContext)) {
      if (token.length <= 2 || stopwords.has(token)) continue;
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
    const topContextTokens = [...tokenCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([token]) => token);

    const refinedPrimary = [query, contextTitle, contextCategory, 'news editorial photo']
      .filter(Boolean)
      .join(', ');
    const contextRichQuery = topContextTokens.length
      ? `${query}, ${topContextTokens.join(' ')}, documentary editorial`
      : '';
    const localLanguageBias =
      language === 'hi' || language === 'bn' || language === 'mr' || language === 'ta' || language === 'te'
        ? `${query}, regional news`
        : '';
    const hasIndianScript = /[\u0900-\u097f\u0980-\u09ff\u0b80-\u0bff\u0c00-\u0c7f]/.test(allContext);
    const isLikelyIndiaContext =
      hasIndianScript || ['hi', 'bn', 'mr', 'ta', 'te'].includes(language);
    const orientationHint =
      orientation === 'portrait'
        ? 'vertical portrait composition, full-body framing'
        : orientation === 'square'
          ? 'square composition, centered subject'
          : 'horizontal landscape composition, wide framing';

    const tryQueries = Array.from(
      new Set(
        [
          `${refinedPrimary}, ${orientationHint}`,
          contextRichQuery ? `${contextRichQuery}, ${orientationHint}` : '',
          query,
          ...fallback,
          localLanguageBias,
          `news broadcast journalism, ${orientationHint}`,
        ].filter(Boolean)
      )
    );

    // Stripped queries for gallery search — no orientation/editorial noise so ES/MongoDB
    // filename and caption matching actually works. Try raw query + title keywords first.
    const galleryTryQueries = Array.from(
      new Set(
        [
          query,
          contextTitle || '',
          ...fallback,
          topContextTokens.join(' '),
        ].filter(Boolean)
      )
    );

    const normalizeGalleryCandidate = (asset: Record<string, any>, index: number) => {
      const mimeType = String(asset?.mimeType || '');
      const isVideo = mimeType.startsWith('video/');
      const mediaDetails = (asset?.media_details || {}) as Record<string, unknown>;
      const sizes = (asset?.sizes || {}) as Record<string, unknown>;
      const fallbackThumb =
        (sizes?.thumbnail as string) ||
        (sizes?.small as string) ||
        (sizes?.medium as string) ||
        (sizes?.large as string) ||
        (sizes?.original as string) ||
        '';

      const thumbnailUrl = isVideo
        ? String(
            (asset?.thumbnailUrl as string) ||
              (mediaDetails?.thumbnail as string) ||
              (mediaDetails?.poster as string) ||
              fallbackThumb ||
              asset?.url ||
              ''
          )
        : String(asset?.url || '');

      const durationCandidate =
        mediaDetails?.duration ||
        mediaDetails?.length ||
        asset?.duration ||
        asset?.durationSec;
      const durationSec =
        durationCandidate !== undefined && durationCandidate !== null
          ? Number.parseFloat(String(durationCandidate))
          : undefined;

      return {
        id: index + 1,
        url: String(asset?.url || ''),
        thumbnailUrl: thumbnailUrl || undefined,
        photographer: 'Media Gallery',
        src: {
          original: String(asset?.url || ''),
          large2x: thumbnailUrl || String(asset?.url || ''),
          large: thumbnailUrl || String(asset?.url || ''),
          medium: thumbnailUrl || String(asset?.url || ''),
          small: thumbnailUrl || String(asset?.url || ''),
        },
        alt: String(asset?.alt_text || asset?.caption || asset?.fileName || 'Gallery media'),
        width: Number(mediaDetails?.width || 0) || undefined,
        height: Number(mediaDetails?.height || 0) || undefined,
        assetType: isVideo ? 'video' : 'image',
        sourceId: String(asset?._id || ''),
        mimeType: mimeType || undefined,
        durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
        source: 'media-gallery',
      };
    };

    for (const galleryQuery of galleryTryQueries) {
      const galleryAssets = await this._fileUploadService.findRelevantMedia(
        galleryQuery,
        scopedOrganizationId,
        scopedPropertyId,
        perPage,
        includeVideos
      );
      const galleryCandidates = galleryAssets
        .map((asset, index) => normalizeGalleryCandidate(asset as Record<string, any>, index))
        .filter((candidate) => !!candidate.url && !!candidate.thumbnailUrl);

      if (galleryCandidates.length) {
        return returnAll
          ? {
              photos: galleryCandidates,
              matchedQuery: galleryQuery,
              source: 'media-gallery',
              clipSelectionEnabled,
            }
          : {
              photo: galleryCandidates[0],
              matchedQuery: galleryQuery,
              source: 'media-gallery',
              clipSelectionEnabled,
            };
      }
    }

    // If provider is media-gallery only, stop here — don't fall through to Google/Pexels.
    if (provider === 'media-gallery') {
      return returnAll ? { photos: [], matchedQuery: query, source: 'media-gallery', clipSelectionEnabled } : { photo: null, matchedQuery: query, source: 'media-gallery', clipSelectionEnabled };
    }

    const siteExclusions = '-site:instagram.com -site:facebook.com -site:reels';
    const useGoogle = provider === 'google' || (provider === 'auto' && !!serperKey);
    if (useGoogle && serperKey) {
      for (const rawQ of tryQueries) {
        const q = `${rawQ} ${siteExclusions}`;
        const r = await fetch('https://google.serper.dev/images', {
          method: 'POST',
          headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q,
            num: Math.min(perPage * 4, 20),
            gl: isLikelyIndiaContext ? 'in' : 'us',
            hl: language === 'hi' ? 'hi' : 'en',
            ...(page > 1 ? { start: (page - 1) * perPage + 1 } : {}),
          }),
        });
        if (r.ok) {
          const data = await r.json();
          const images = Array.isArray(data.images) ? data.images : [];
          const BLOCKED_HOSTS = ['lookaside.instagram.com', 'instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net'];
          const isBlocked = (u: string) => {
            try {
              const h = new URL(u).hostname;
              return BLOCKED_HOSTS.some((blocked) => h === blocked || h.endsWith(`.${blocked}`));
            } catch {
              return true;
            }
          };
          const photos = images
            .map((img: any, i: number) => {
              const rawUrl = typeof img.imageUrl === 'string' ? img.imageUrl : '';
              const thumbnailUrl = typeof img.thumbnailUrl === 'string' ? img.thumbnailUrl : '';
              // Skip entirely if the primary image URL is from a blocked host — thumbnails
              // from these sources are too low quality to be useful.
              if (!rawUrl || isBlocked(rawUrl)) return null;
              if (!rawUrl.startsWith('https://')) return null;
              const thumb = thumbnailUrl && !isBlocked(thumbnailUrl) ? thumbnailUrl : rawUrl;
              return {
                id: i + 1,
                url: rawUrl,
                photographer: img.source || 'Google Images',
                src: {
                  original: rawUrl,
                  large2x: rawUrl,
                  large: rawUrl,
                  medium: thumb,
                  small: thumb,
                },
                alt: img.title || 'Google image',
                width: img.imageWidth || 1600,
                height: img.imageHeight || 900,
              };
            })
            .filter(Boolean);
          if (photos.length) {
            return returnAll
              ? { photos, matchedQuery: q, source: 'google', clipSelectionEnabled }
              : { photo: photos[0], matchedQuery: q, source: 'google', clipSelectionEnabled };
          }
        } else if ((r.status === 401 || r.status === 403) && provider === 'google') {
          throw new BadRequestException('SERPER_API_KEY unauthorized or invalid');
        }
      }
    }

    if (!pexelsKey) {
      throw new BadRequestException('PEXELS_API_KEY is not configured on backend');
    }
    for (const q of tryQueries) {
      const url = new URL('https://api.pexels.com/v1/search');
      url.searchParams.set('query', q);
      url.searchParams.set('orientation', orientation);
      url.searchParams.set('per_page', String(Math.min(perPage, 9)));
      url.searchParams.set('size', 'large');
      if (page > 1) url.searchParams.set('page', String(page));
      const res = await fetch(url.toString(), { headers: { Authorization: pexelsKey } });
      if (!res.ok) continue;
      const data = await res.json();
      const photos = Array.isArray(data.photos) ? data.photos : [];
      if (photos.length) {
        return returnAll
          ? { photos, matchedQuery: q, source: 'pexels', clipSelectionEnabled }
          : { photo: photos[0], matchedQuery: q, source: 'pexels', clipSelectionEnabled };
      }
    }
    return returnAll
      ? { photos: [], source: 'none', clipSelectionEnabled }
      : { photo: null, source: 'none', clipSelectionEnabled };
  }

  async generateTts(payload: TtsDto) {
    const apiKey = this._getGeminiApiKey();
    if (!apiKey) {
      return { audioContent: null, skipped: true };
    }
    const voiceMap: Record<string, string> = {
      neutral: 'Aoede',
      male: 'Fenrir',
      female: 'Kore',
    };
    const voice = voiceMap[payload.voice || 'neutral'] || 'Aoede';
    const rate = Number(payload.rate ?? 1.2);
    const safeRate = Number.isFinite(rate) ? Math.max(0.7, Math.min(1.3, rate)) : 1.2;
    const languageHint = payload.language ? `Speak in ${payload.language}.` : '';
    const styleHint =
      safeRate < 0.8
        ? 'Speak slowly and clearly.'
        : safeRate > 1.1
          ? 'Speak briskly and energetically.'
          : 'Speak at a clear, measured news pace.';

    const rawText = String(payload.text || '');
    const normalizedText = rawText
      .replace(/\s+/g, ' ')
      .replace(/[^\S\r\n]+/g, ' ')
      .trim()
      .slice(0, 5000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const voicesToTry = [voice, 'Aoede'];
    const stylesToTry = [styleHint, 'Speak at a clear, neutral pace.'];

    for (const voiceName of voicesToTry) {
      for (const style of stylesToTry) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${languageHint}\n${style}\n\n${normalizedText}` }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
        });

        if (!res.ok) {
          continue;
        }

        const data = await res.json();
        const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
        for (const candidate of candidates) {
          const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
          for (const part of parts) {
            const inlineData = part?.inlineData;
            if (inlineData?.data) {
              return {
                audioContent: inlineData.data,
                mimeType: inlineData?.mimeType || 'audio/wav',
              };
            }
          }
        }
      }
    }

    return { audioContent: null, skipped: true };
  }

  async createJob(payload: CreateVideoJobDto, user: TCurrentUserType) {
    const normalizedMediaAssets = (payload.mediaAssets || []).map((asset: any) => {
      const durationSecCandidate =
        asset?.durationSec !== undefined && asset?.durationSec !== null
          ? Number(asset.durationSec)
          : asset?.duration !== undefined && asset?.duration !== null
            ? Number(asset.duration)
            : undefined;
      return {
        ...asset,
        durationSec: Number.isFinite(durationSecCandidate) ? durationSecCandidate : undefined,
      };
    });

    const job = await this._videoJobModel.create({
      userId: user._id || user.sub,
      organizationId: user.organizationId || '',
      propertyId: user.propertyId || undefined,
      articleId: payload.articleId,
      title: payload.title,
      content: payload.content,
      mediaAssets: normalizedMediaAssets,
      status: VideoGenerationJobStatus.PROCESSING,
    });

    // Phase-1 deterministic flow: keep durable lifecycle in DB and
    // return a completed mock result so frontend integration can proceed.
    job.status = VideoGenerationJobStatus.COMPLETED;
    job.result = {
      videoUrl: payload.uploadedVideoUrl || `/media/generated-video/${job._id}.mp4`,
      uploadedVideoUrl: payload.uploadedVideoUrl || null,
      durationSec: payload.durationSec || null,
      thumbnailUrl: `/media/generated-video/${job._id}.jpg`,
      title: payload.title,
      mediaAssetCount: normalizedMediaAssets.length,
      mode: 'phase1-mock',
    };
    job.completedAt = new Date();
    await job.save();

    return job.toObject();
  }

  async listJobs(
    user: TCurrentUserType,
    query: { page?: number; limit?: number; propertyId?: string }
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = {
      organizationId: user.organizationId || '',
    };
    // Only filter by propertyId when explicitly provided AND the job was
    // created with one — fall back to org-wide listing when unset.
    if (query.propertyId) {
      filter.$or = [
        { propertyId: query.propertyId },
        { propertyId: { $exists: false } },
        { propertyId: null },
      ];
    }

    const [jobs, total] = await Promise.all([
      this._videoJobModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this._videoJobModel.countDocuments(filter),
    ]);

    return {
      data: jobs,
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  async getJob(jobId: string, user: TCurrentUserType) {
    const job = await this._videoJobModel.findById(jobId).lean();
    if (!job) {
      throw new NotFoundException('Video generation job not found');
    }
    if ((job.organizationId || '') !== (user.organizationId || '')) {
      throw new NotFoundException('Video generation job not found');
    }
    return job;
  }

  async cancelJob(jobId: string, user: TCurrentUserType) {
    const job = await this._videoJobModel.findById(jobId);
    if (!job || (job.organizationId || '') !== (user.organizationId || '')) {
      throw new NotFoundException('Video generation job not found');
    }
    if (job.status !== VideoGenerationJobStatus.PROCESSING) {
      throw new BadRequestException('Video generation job is not cancellable');
    }

    job.status = VideoGenerationJobStatus.CANCELLED;
    job.cancelledAt = new Date();
    await job.save();

    return job.toObject();
  }

  async publishJob(jobId: string, payload: PublishVideoJobDto, user: TCurrentUserType) {
    const job = await this._videoJobModel.findById(jobId);
    if (!job || (job.organizationId || '') !== (user.organizationId || '')) {
      throw new NotFoundException('Video generation job not found');
    }
    if (job.status !== VideoGenerationJobStatus.COMPLETED || !job.result) {
      throw new UnprocessableEntityException('Video generation job is not ready to publish');
    }

    const uploadedVideo = payload.uploadedVideo
      ? {
          id: payload.uploadedVideo.id,
          url: payload.uploadedVideo.url,
          path: payload.uploadedVideo.path,
          fileName: payload.uploadedVideo.fileName || '',
          mimeType: payload.uploadedVideo.mimeType || '',
          size: payload.uploadedVideo.size || 0,
          duration: payload.uploadedVideo.duration,
        }
      : null;

    job.publishResult = {
      articleId: payload.articleId,
      articleSlug: payload.articleSlug || null,
      publishedVideoUrl:
        uploadedVideo?.url || (job.result as Record<string, unknown>).videoUrl || null,
      uploadedVideo,
    };
    job.publishedAt = new Date();
    await job.save();

    if (uploadedVideo) {
      // Use update queries to avoid hydrating legacy malformed subdocuments (e.g. seo.*)
      // when publishing only needs featuredVideo/videos fields.
      const articleUpdate = await this._articleModel.updateOne(
        { _id: payload.articleId },
        { $set: { featuredVideo: uploadedVideo as any } }
      );

      if (!articleUpdate.matchedCount) {
        throw new NotFoundException('Article not found while publishing video');
      }

      // MongoDB rejects updating the same array path with $pull and $push in one update.
      await this._articleModel.updateOne(
        { _id: payload.articleId },
        { $pull: { videos: { path: uploadedVideo.path } } }
      );
      await this._articleModel.updateOne(
        { _id: payload.articleId },
        { $push: { videos: uploadedVideo as any } }
      );
    }

    return job.toObject();
  }
}
