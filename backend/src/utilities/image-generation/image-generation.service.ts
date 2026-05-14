import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateInfographicDto } from './dto/generate-infographic.dto';
import { LocalService } from '../file-upload/providers/local.service';
import { CloudinaryService } from '../file-upload/providers/cloudinary.service';
import { AWSService } from '../file-upload/providers/aws.service';
import { TCurrentUserType } from 'src/auth/types/user.type';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { FILE_UPLOAD_SERVICE } from 'src/core/constants/enums.constants';
import slugify from 'slugify';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { ImageGenerationResult } from './types/flux.types';
import {
  IMAGE_TEMPLATES,
  TEMPLATE_KEYS,
  TEMPLATE_SELECTION_PROMPT,
} from './templates/image-templates';
import { FileUploadService } from '../file-upload/fileUpload.service';
import { WatermarkPosition } from '../file-upload/utils/watermark';
import { InfographicRendererService } from './infographic-renderer.service';
import {
  INFOGRAPHIC_PROMPT_TEMPLATES,
  INFOGRAPHIC_PROMPT_TEMPLATE_KEYS,
  InfographicPromptTemplate,
} from './templates/infographic-prompt-templates';
import { PrepareInfographicPromptDto } from './dto/prepare-infographic-prompt.dto';
import { ExtractScreenshotInsightsDto } from './dto/extract-screenshot-insights.dto';

// Aspect ratio mapping for Bedrock Nova Canvas
const BEDROCK_ASPECT_RATIO_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
};

// Aspect ratio mapping for Azure Flux
const FLUX_ASPECT_RATIO_MAP: Record<string, string> = {
  '1:1': '1:1',
  '16:9': '16:9',
  '9:16': '9:16',
  '4:3': '4:3',
  '3:4': '3:4',
  '21:9': '21:9',
};

const FLUX_API_ENDPOINT = 'https://api.bfl.ml/v1';
const FLUX_MODEL = 'flux-pro-1.1';

@Injectable()
export class ImageGenerationService {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly bedrockClient: BedrockRuntimeClient;
  private readonly genAI: GoogleGenAI | null = null;

  constructor(
    private readonly _awsService: AWSService,
    private readonly _cloudinaryService: CloudinaryService,
    private readonly _localService: LocalService,
    private readonly _fileUploadService: FileUploadService,
    private readonly _infographicRendererService: InfographicRendererService,
    private readonly _configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger
  ) {
    const region = this._configService.get<string>('AWS_REGION_AST') || 'us-east-1';
    const accessKeyId = this._configService.get<string>('AWS_BEARER_TOKEN_BEDROCK');

    this.bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: '', // Bearer token goes into accessKeyId
      },
      maxAttempts: 10,
    });

    const apiKey = this._configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey.replace(/['"]/g, ''),
      });
    }
  }

  private isRetryableError(error: unknown): boolean {
    const errorName = (error as any)?.name;
    const errorMessage = (error as any)?.message || '';

    // Retry on throttling and server errors
    return (
      errorName === 'ThrottlingException' ||
      errorMessage.includes('Too many requests') ||
      (error as any)?.$metadata?.httpStatusCode >= 500
    );
  }

  private async generateImageUsingBedrock(
    imagePrompt: string,
    aspectRatio: string = '16:9',
    isInfographic: boolean = false
  ): Promise<{ image: string }> {
    // For infographics, allow text; for regular images, add no-text instruction
    const prompt = isInfographic
      ? imagePrompt
      : '**Image should not contain any text**, ' + imagePrompt;

    const dimensions = BEDROCK_ASPECT_RATIO_MAP[aspectRatio] || BEDROCK_ASPECT_RATIO_MAP['16:9'];
    let lastError: Error | null = null;

    const modelId =
      this._configService.get<string>('AWS_BEDROCK_IMAGE_MODEL') || 'amazon.nova-canvas-v1:0';

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this._logger.log(
          `Generating image with Bedrock (${modelId}), attempt ${attempt}/${this.MAX_RETRIES}`,
          this.constructor.name
        );

        const requestBody = {
          taskType: 'TEXT_IMAGE',
          textToImageParams: {
            text: prompt,
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            quality: 'standard',
            height: dimensions.height,
            width: dimensions.width,
            cfgScale: 8.0,
            seed: Math.floor(Math.random() * 2147483647),
          },
        };

        const command = new InvokeModelCommand({
          modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody),
        });

        const response = await this.bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        const base64Image = responseBody?.images?.[0];

        if (!base64Image) {
          throw new Error('No image data received from Bedrock API');
        }

        this._logger.log('Image generated successfully with Bedrock', this.constructor.name);
        return { image: base64Image };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(errorMessage);

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(error)) {
          this._logger.error(
            `Non-retryable error occurred: ${errorMessage}`,
            error instanceof Error ? error.stack : undefined,
            this.constructor.name
          );
          throw lastError;
        }

        if (attempt === this.MAX_RETRIES) {
          this._logger.error(
            `Failed to generate image after ${this.MAX_RETRIES} attempts: ${errorMessage}`,
            error instanceof Error ? error.stack : undefined,
            this.constructor.name
          );
          throw lastError;
        }

        const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        this._logger.warn(
          `Attempt ${attempt} failed: ${errorMessage}. Retrying in ${delay}ms...`,
          this.constructor.name
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError ?? new Error('Failed to generate image');
  }

  async generateImage(
    generateImageDto: GenerateImageDto,
    user: TCurrentUserType
  ): Promise<ImageGenerationResult> {
    try {
      // Get image provider from config (default: bedrock)
      const imageProvider = this._configService.get<string>('IMAGE_PROVIDER') || 'bedrock';

      let result: { image: string };

      if (imageProvider === 'flux' || imageProvider === 'azure-flux') {
        // Use Azure Flux
        this._logger.log('Generating image using Azure Flux', this.constructor.name);
        result = await this.generateImageUsingFlux(
          generateImageDto.prompt,
          generateImageDto.aspectRatio || '16:9'
        );
      } else if (imageProvider === 'gemini') {
        // Use Gemini
        this._logger.log('Generating image using Google Gemini (Imagen)', this.constructor.name);
        result = await this.generateImageUsingGemini(
          generateImageDto.prompt,
          generateImageDto.aspectRatio || '16:9',
          generateImageDto.template,
          generateImageDto.isInfographic || false
        );
      } else {
        // Use Bedrock (default)
        this._logger.log(
          `Generating ${generateImageDto.isInfographic ? 'infographic' : 'image'} using AWS Bedrock (Nova Canvas)`,
          this.constructor.name
        );
        result = await this.generateImageUsingBedrock(
          generateImageDto.prompt,
          generateImageDto.aspectRatio || '16:9',
          generateImageDto.isInfographic || false
        );
      }

      if (!result.image) {
        throw new BadRequestException(`No image returned from ${imageProvider} generation service`);
      }

      this._logger.log(
        `[DEBUG] Image provider=${imageProvider}, base64 length=${result.image?.length || 0}`,
        this.constructor.name
      );

      // Convert base64 to buffer
      const imageBuffer: Buffer = Buffer.from(result.image, 'base64');

      const uploadResult = await this.uploadGeneratedBuffer(
        imageBuffer,
        user,
        'generated',
        generateImageDto.propertyId,
        generateImageDto.isInfographic ? 'bottom-right' : undefined,
        generateImageDto.isInfographic ? 0.12 : undefined,
        // Fall back to the prompt when no article-provided title is set —
        // keeps standalone image-picker generations searchable too.
        { title: generateImageDto.title || generateImageDto.prompt, tags: generateImageDto.tags },
      );

      this._logger.log(
        `[DEBUG] Upload result: ${JSON.stringify(uploadResult?.data ? { url: uploadResult.data.url, path: uploadResult.data.path, _id: uploadResult.data._id } : uploadResult)}`,
        this.constructor.name
      );
      this._logger.log(
        `Image generated and uploaded successfully for prompt: ${generateImageDto.prompt}`,
        this.constructor.name
      );

      return uploadResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._logger.error(
        `Image generation failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        this.constructor.name
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate and upload image');
    }
  }

  private static readonly REUSE_SCORE_THRESHOLD = 500;
  private static readonly MIN_IMAGE_WIDTH = 600;

  async generateOrReuseImage(
    generateImageDto: GenerateImageDto,
    user: TCurrentUserType
  ): Promise<ImageGenerationResult> {
    // Infographics are data-specific snapshots — the same template + similar
    // topic still renders different numbers, dates, and entities. Reusing a
    // prior one would silently serve stale data and defeat the grounded
    // fetch in prepareInfographicPrompt. Always generate fresh.
    if (generateImageDto.isInfographic) {
      return this.generateImage(generateImageDto, user);
    }

    try {
      const matches = await this._fileUploadService.findRelevantImages(
        generateImageDto.prompt,
        user.organizationId,
        user.propertyId,
        5,
      );

      // Find first match that meets resolution requirements
      const match = matches.find((m) => this._hasMinResolution(m));

      if (match) {
        const score = (match._score as number) || 0;
        const matchUrl = (match.url as string) || '';
        const matchPath = (match.path as string) || '';
        const matchId = String(match._id || '');

        // Tier 1: Strong match — reuse directly
        if (score >= ImageGenerationService.REUSE_SCORE_THRESHOLD) {
          this._logger.log(
            `Reusing existing image "${match.fileName}" (score: ${score}) instead of generating new one`,
            this.constructor.name,
          );
          return {
            data: { _id: matchId, path: matchPath, url: matchUrl },
            message: 'Existing image reused',
          };
        }

        // Tier 2: Medium match — use as visual reference for generation
        const imageProvider = this._configService.get<string>('IMAGE_PROVIDER') || 'bedrock';
        if (imageProvider === 'gemini' && matchUrl) {
          try {
            const refImage = await this._downloadImageAsBase64(matchUrl);
            if (refImage) {
              this._logger.log(
                `Using "${match.fileName}" (score: ${score}) as visual reference for generation`,
                this.constructor.name,
              );
              return this._generateWithReference(generateImageDto, user, refImage);
            }
          } catch (error) {
            this._logger.warn(
              `Reference-based generation failed, falling back to scratch: ${(error as Error).message}`,
              this.constructor.name,
            );
          }
        }
      }
    } catch (error) {
      this._logger.warn(
        `Image reuse search failed, falling back to generation: ${(error as Error).message}`,
        this.constructor.name,
      );
    }

    // Tier 3: No match — generate from scratch
    return this.generateImage(generateImageDto, user);
  }

  private _hasMinResolution(image: Record<string, unknown>): boolean {
    const details = image.media_details as Record<string, unknown> | undefined;
    if (!details?.width) return true; // no metadata = assume acceptable
    const width = Number(details.width);
    return width >= ImageGenerationService.MIN_IMAGE_WIDTH;
  }

  private async _downloadImageAsBase64(
    url: string,
  ): Promise<{ data: string; mimeType: string } | null> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      const buffer = Buffer.from(response.data);
      const mimeType = (response.headers['content-type'] as string) || 'image/jpeg';
      return { data: buffer.toString('base64'), mimeType };
    } catch {
      return null;
    }
  }

  private async _generateWithReference(
    generateImageDto: GenerateImageDto,
    user: TCurrentUserType,
    referenceImage: { data: string; mimeType: string },
  ): Promise<ImageGenerationResult> {
    if (!this.genAI) {
      throw new BadRequestException('Gemini API key not configured');
    }

    const modelId =
      this._configService.get<string>('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-preview-04-17';
    const textModelId = this._configService.get<string>('GEMINI_TEXT_MODEL') || 'gemini-2.5-flash';
    const aspectRatio = generateImageDto.aspectRatio || '16:9';

    const resolvedKey =
      generateImageDto.template ?? (await this._selectTemplate(generateImageDto.prompt, textModelId));
    const template = IMAGE_TEMPLATES[resolvedKey] ?? IMAGE_TEMPLATES['editorial-photo'];
    const wrappedPrompt = template.promptWrapper(generateImageDto.prompt);

    const referencePrompt = `Use the provided reference image as visual style guidance — match its color palette, lighting, composition style, and editorial tone. Generate a completely NEW and original image (do not copy the reference) that depicts the following subject:\n\n${wrappedPrompt}`;

    const response = await this.genAI.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } },
            { text: referencePrompt },
          ],
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio },
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);
    if (!imagePart?.inlineData?.data) {
      throw new Error('Gemini returned no image from reference-based generation');
    }

    this._logger.log(
      `Reference-based image generated successfully (${imagePart.inlineData.mimeType})`,
      this.constructor.name,
    );

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    return this.uploadGeneratedBuffer(
      imageBuffer,
      user,
      'generated-ref',
      generateImageDto.propertyId,
      generateImageDto.isInfographic ? 'bottom-right' : undefined,
      generateImageDto.isInfographic ? 0.12 : undefined,
      { title: generateImageDto.title || generateImageDto.prompt, tags: generateImageDto.tags },
    );
  }

  async generateInfographic(
    generateInfographicDto: GenerateInfographicDto,
    user: TCurrentUserType
  ): Promise<ImageGenerationResult> {
    try {
      const base64Png = await this._infographicRendererService.renderInfographicPngBase64(
        generateInfographicDto
      );
      const pngBuffer = Buffer.from(base64Png, 'base64');

      const uploadResult = await this.uploadGeneratedBuffer(
        pngBuffer,
        user,
        'infographic',
        generateInfographicDto.propertyId,
        undefined,
        undefined,
        { title: generateInfographicDto.title },
      );

      this._logger.log(
        `Infographic generated and uploaded successfully for title: ${generateInfographicDto.title}`,
        this.constructor.name
      );

      return uploadResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._logger.error(
        `Infographic generation failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        this.constructor.name
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to generate and upload infographic');
    }
  }

  getInfographicPromptTemplates(): InfographicPromptTemplate[] {
    return INFOGRAPHIC_PROMPT_TEMPLATE_KEYS.map((key) => INFOGRAPHIC_PROMPT_TEMPLATES[key]);
  }

  async prepareInfographicPrompt(payload: PrepareInfographicPromptDto): Promise<{
    prompt: string;
    dataSummary: string;
    sources: string[];
  }> {
    const template = INFOGRAPHIC_PROMPT_TEMPLATES[payload.templateKey];
    if (!template) {
      throw new BadRequestException('Invalid infographic template key');
    }

    const csvSummary = this._summarizeCsv(payload.csvText);
    const screenshotSummary = payload.screenshotInsights?.trim() || '';
    const topic = payload.topic?.trim() || '';
    const additionalContext = payload.additionalContext?.trim() || '';
    const overrideSummary = payload.overrideDataSummary?.trim() || '';

    if (!topic && !csvSummary && !screenshotSummary && !overrideSummary) {
      throw new BadRequestException(
        'Provide at least one input: topic, csvText, screenshotInsights, or overrideDataSummary'
      );
    }

    // Editor-approved rebuild path. Skip research and use the summary the FE
    // constructed from the inline-edited rows as the sole data source.
    if (overrideSummary) {
      const prompt = this._buildInfographicPrompt(template.promptSkeleton, overrideSummary);
      return { prompt, dataSummary: overrideSummary, sources: [] };
    }

    // Topic-only requests have no concrete data for the image model to render,
    // which historically let it invent numbers or pull stale facts via its
    // own in-call web search. Ground the topic with a separate text-only
    // search first so the image call only has to render pre-verified data.
    let groundedSummary = '';
    let sources: string[] = [];
    const isTopicOnly = Boolean(topic) && !csvSummary && !screenshotSummary;
    if (isTopicOnly) {
      const grounded = await this._fetchGroundedInfographicData(
        payload.templateKey,
        topic,
        additionalContext,
      );
      groundedSummary = grounded.summary;
      sources = grounded.sources;
    }

    const dataSummaryParts: string[] = [];

    if (topic) {
      dataSummaryParts.push(`Topic: ${topic}`);
    }
    if (groundedSummary) {
      dataSummaryParts.push(`Researched Data:\n${groundedSummary}`);
    }
    if (csvSummary) {
      dataSummaryParts.push(`CSV Data:\n${csvSummary}`);
    }
    if (screenshotSummary) {
      dataSummaryParts.push(`Screenshot Insights: ${screenshotSummary}`);
    }
    if (additionalContext) {
      dataSummaryParts.push(`Additional Context: ${additionalContext}`);
    }

    const dataSummary = dataSummaryParts.join('\n\n');

    const prompt = this._buildInfographicPrompt(template.promptSkeleton, dataSummary);

    return { prompt, dataSummary, sources };
  }

  private _buildInfographicPrompt(promptSkeleton: string, dataSummary: string): string {
    return [
      'INFOGRAPHIC DESIGN:',
      promptSkeleton,
      '',
      'DESIGN GUIDELINES:',
      '- Use factual, editorial style visual design suitable for a news CMS',
      '- Use orange accent color #f58634 for highlights and neutral palette (grays, whites) for supporting elements',
      '- Do not invent numbers - use only values present in the input data summary',
      '- Keep text concise and readable with proper font hierarchy',
      '- Avoid clutter, neon styling, and gimmicks',
      '- Do NOT draw any checkered/transparent-style backgrounds, grids, textures, placeholders, frames, or "empty slot" patterns anywhere - the background must be a single consistent solid or subtle-gradient fill',
      '',
      'Input data summary:',
      dataSummary,
      '',
      // Language directive is the last thing the model reads — recency
      // matters. The digits rule is placed AFTER the language rule so it
      // overrides any "everything in Hindi" interpretation.
      'LANGUAGE — Conversational Hinglish:',
      'Use a modern conversational Hinglish style — the way Indian TV news and social media channels talk. Mix Hindi with English. Do NOT translate everything into formal literary Hindi, but also do NOT leave common everyday nouns in English when they have natural Hindi words.',
      '',
      'USE ENGLISH for news/media/business jargon (these feel awkward in formal Hindi):',
      '- "Top 10", "Gross", "Worldwide", "Global", "Rank", "Box Office", "Total", "Revenue", "Trending", "Comparison", "Cost of Living", "Salary", "Market"',
      '- Avoid formal/Sanskrit-derived Hindi: सकल → "Gross", वैश्विक → "Global", विश्वव्यापी → "Worldwide", शीर्ष → "Top", क्रम → "Rank"',
      '',
      'USE HINDI for everyday domain labels — these read more natural and local in Hindi:',
      '- Rent → किराया · Groceries → किराना · Utilities / Electricity & Water → बिजली-पानी · Food → खाना · Meal → भोजन / खाना · Transport → यातायात · Monthly → मासिक / हर महीना · Weekly → साप्ताहिक · Daily → दैनिक / रोज़ · Apartment → फ्लैट · House → घर · Restaurant → रेस्टोरेंट · Hospital → अस्पताल · School → स्कूल · Work → काम',
      '- Short labels inside cards/badges: prefer the Hindi word if it is one commonly spoken in daily life.',
      '',
      'PROPER NOUNS:',
      '- Indian cities, states, rivers: prefer Devanagari (दिल्ली, मुंबई, कोलकाता) — not DELHI, MUMBAI.',
      '- Indian people, political parties, institutions: Devanagari.',
      '- International brands, movies, companies, products: keep the original English spelling (iPhone 16, Netflix, Tesla). Devanagari transliteration only if it clearly reads natural.',
      '',
      'CONNECTIVE PROSE:',
      '- Hindi for सेंटेंस flow: की, वाली, सबसे ज्यादा, कमाई, फिल्में, में, है, etc.',
      '',
      'CRITICAL — DIGITS MUST BE ARABIC NUMERALS:',
      'Every numeric value in the image (years, ranks, currency amounts, percentages, counts, dates, any digit anywhere) MUST be rendered using Arabic numerals only: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9.',
      'NEVER render digits as Devanagari numerals ०, १, २, ३, ४, ५, ६, ७, ८, ९.',
      'Examples (follow these exactly):',
      '- Title: write "Top 10 Bollywood Movies of 2025" or "2025 की Top 10 Bollywood फिल्में" — do NOT write "२०२५ की शीर्ष १०"',
      '- Rank: write "1, 2, 3" — do NOT write "१, २, ३"',
      '- Currency: write "₹808 crore" or "$2.15B" — do NOT write "₹८०८ करोड़"',
      '- Percentage: write "7.2%" — do NOT write "७.२%"',
      'Digits = Arabic numerals. No exceptions.',
    ].join('\n');
  }

  private async _fetchGroundedInfographicData(
    templateKey: string,
    topic: string,
    additionalContext: string,
  ): Promise<{ summary: string; sources: string[] }> {
    if (!this.genAI) {
      this._logger.warn(
        'Gemini not configured — skipping grounded data fetch, falling back to topic-only prompt',
        this.constructor.name,
      );
      return { summary: '', sources: [] };
    }

    const textModelId = this._configService.get<string>('GEMINI_TEXT_MODEL') || 'gemini-2.5-flash';
    const template = INFOGRAPHIC_PROMPT_TEMPLATES[templateKey];

    const STRUCTURE_HINTS: Record<string, string> = {
      'ranking-board':
        'Return an ordered list of 5-10 entries. For each: rank, entity name, primary metric value (with unit), optional secondary metric.',
      'comparison-cards':
        'Return 2-6 entities and the same 3-5 metrics for each, with values and units so they line up side by side.',
      timeline:
        'Return 5-10 chronological events with exact dates (YYYY or YYYY-MM-DD) and a one-line description each.',
      'stat-highlight':
        'Return one headline statistic (number + unit + one-line context) and 2-3 supporting facts.',
    };
    const structureHint =
      STRUCTURE_HINTS[templateKey] || 'Return key facts and numbers relevant to the topic.';

    const contextLine = additionalContext ? `\nAdditional context: ${additionalContext}` : '';

    const researchPrompt = [
      `You are researching data for a news infographic. Topic: ${topic}${contextLine}`,
      `Template: ${template?.label || templateKey} — ${structureHint}`,
      '',
      'STRICT RULES — violating any of these makes the entire output unusable:',
      '- Use ONLY data you can verify from your search results',
      '- Data rows must contain ONLY the entity and value/metric. NO URLs, NO "source:" citations, NO parenthetical references, NO citation markers ([1], [2], etc.) — keep the DATA section clean text.',
      '- Put all supporting URLs ONLY in the SOURCES section at the bottom, one per line. Never inline within data rows.',
      '- Currency: this is an Indian news platform. For topics involving Indian cities, Indian brands, Indian companies, Indian markets, or any Indian context, values MUST be in Indian Rupees (₹ / INR). Prefer Indian/local sources — if you only find USD, search again for the INR figure before giving up. Use "lakh" / "crore" where idiomatic (e.g., "₹8,500/month", "₹20 crore"). For clearly global/international topics (Hollywood box office, global tech revenue), use the currency natural to that context.',
      '- NEVER use hedge words: "estimated", "approximately", "around", "roughly", "~", "expected", "projected", "upcoming", "unreleased", "anticipated", "forecast", "tentative", "likely", "tbd", "tba"',
      '- NEVER include items that have not happened yet (unreleased films, upcoming events, future numbers)',
      '- NEVER pad the list to hit a target count. If the user asks for top 10 but only 4 are verifiable, return 4.',
      '- Numbers must be exact. No "(estimated)", no "~", no parenthetical caveats on values.',
      '- If verified data is thin or unavailable for this topic, return the single line "INSUFFICIENT DATA" instead of guessing.',
      '',
      'Respond in two sections, plain text only:',
      'DATA:',
      '<clean rows: entity and value only — NO URLs, NO citations. Or exactly "INSUFFICIENT DATA".>',
      '',
      'SOURCES:',
      '<the distinct URLs used, one per line — this is the ONLY place URLs belong>',
    ].join('\n');

    try {
      const response = await this.genAI.models.generateContent({
        model: textModelId,
        contents: researchPrompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = (response.text || '').trim();
      if (!text) {
        return { summary: '', sources: [] };
      }

      const parts = text.split(/\n\s*SOURCES:\s*\n/i);
      const rawSummary = (parts[0] || '').replace(/^\s*DATA:\s*/i, '').trim();
      const sources = (parts[1] || '')
        .split(/\n/)
        .map((line) => line.trim().replace(/^[-*•]\s*/, ''))
        .filter((line) => /^https?:\/\//i.test(line));

      // If the model escape-hatched to "INSUFFICIENT DATA", drop the whole
      // summary. The wizard surfaces this as an empty research result and the
      // editor can switch to providing their own data.
      if (/\bINSUFFICIENT\s+DATA\b/i.test(rawSummary)) {
        this._logger.log(
          `Grounded research returned INSUFFICIENT DATA for topic "${topic}"`,
          this.constructor.name,
        );
        return { summary: '', sources: [] };
      }

      // Strip any row that slipped a hedge word past the prompt rules. This is
      // the last line of defence against "estimated" / "approximately" etc.
      const HEDGE_PATTERN =
        /\b(estimated?|approximately|approx\.?|around|roughly|expected|projected|upcoming|unreleased|anticipated|forecast(ed)?|tentative|likely|tbd|tba|placeholder)\b|~\s*\d|\(estimate\)/i;

      // Gemini's googleSearch tool loves to inline source URLs into each row
      // even when told not to, and templates like comparison-cards produce
      // nested multi-line bullets where URLs can appear in parens/brackets.
      // Apply a multi-pass cleanup so nothing URL-shaped reaches the image
      // model. (Especially vertexaisearch.cloud.google.com grounding
      // redirects — opaque tokens that mean nothing to a reader.)
      const LABELED_SOURCE =
        /\s*[(\[—–-]*\s*(?:source|src|sources|link|ref|refs|reference|citation|cite)s?\s*:\s*https?:\/\/[^\s)\]]+[)\]]*/gi;
      const BARE_URL = /https?:\/\/[^\s)\]]+/g;
      const CITATION_MARKER = /\s*[\[(](?:\d+(?:,\s*\d+)*|cite\s*\d*)[\])]/gi;

      const filteredLines = rawSummary
        .split(/\n/)
        .filter((line) => {
          const trimmed = line.trim();
          if (!trimmed) return true;
          return !HEDGE_PATTERN.test(trimmed);
        })
        .map((line) => {
          let cleaned = line.replace(LABELED_SOURCE, '');
          cleaned = cleaned.replace(BARE_URL, '');
          cleaned = cleaned.replace(CITATION_MARKER, '');
          // Collapse orphan punctuation left behind after URL/citation removal.
          cleaned = cleaned.replace(/\(\s*\)/g, '');
          cleaned = cleaned.replace(/\[\s*\]/g, '');
          cleaned = cleaned.replace(/\s+[—–-]\s*$/g, '');
          cleaned = cleaned.replace(/[ \t]+/g, ' ');
          return cleaned.trimEnd();
        });
      const summary = filteredLines.join('\n').trim();

      if (!summary) {
        this._logger.warn(
          `All grounded rows for topic "${topic}" were filtered out as unverifiable`,
          this.constructor.name,
        );
        return { summary: '', sources: [] };
      }

      this._logger.log(
        `Grounded infographic data fetched for topic "${topic}" (${sources.length} sources)`,
        this.constructor.name,
      );

      return { summary, sources };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this._logger.warn(
        `Grounded data fetch failed, proceeding with topic alone: ${msg}`,
        this.constructor.name,
      );
      return { summary: '', sources: [] };
    }
  }

  async extractInfographicInsightsFromScreenshot(payload: ExtractScreenshotInsightsDto): Promise<{
    insights: string;
  }> {
    if (!this.genAI) {
      throw new BadRequestException('Gemini API key not configured for screenshot extraction');
    }

    const textModelId = this._configService.get<string>('GEMINI_TEXT_MODEL') || 'gemini-2.5-flash';

    try {
      const response = await this.genAI.models.generateContent({
        model: textModelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'Extract structured infographic-ready data from this screenshot.',
                  'Return plain text with these sections only:',
                  '1) Title guess',
                  '2) Key metrics (bullet list with label and value)',
                  '3) Categories/entities detected',
                  '4) Timeline points if present',
                  '5) Notes about unclear or unreadable values',
                ].join('\n'),
              },
              {
                inlineData: {
                  mimeType: payload.mimeType,
                  data: payload.imageBase64,
                },
              },
            ],
          },
        ],
      });

      const insights = (response.text || '').trim();
      if (!insights) {
        throw new BadRequestException('Could not extract usable insights from screenshot');
      }

      return { insights };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._logger.error(
        `Screenshot insight extraction failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        this.constructor.name
      );
      throw new InternalServerErrorException('Failed to extract screenshot insights');
    }
  }

  private _summarizeCsv(csvText?: string): string {
    if (!csvText) {
      return '';
    }

    const trimmed = csvText.trim();
    if (!trimmed) {
      return '';
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 30);

    if (lines.length === 0) {
      return '';
    }

    const rows = lines.map((line) => this._splitCsvLine(line).slice(0, 8));
    const header = rows[0];
    const dataRows = rows.slice(1, 13);

    if (dataRows.length === 0) {
      return `Headers: ${header.join(' | ')}`;
    }

    const formattedRows = dataRows.map((row, index) => {
      const pairs = row
        .map((value, i) => `${header[i] || `col${i + 1}`}: ${value}`)
        .join(', ');
      return `${index + 1}. ${pairs}`;
    });

    return [`Headers: ${header.join(' | ')}`, ...formattedRows].join('\n');
  }

  private _splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private async uploadGeneratedBuffer(
    imageBuffer: Buffer,
    user: TCurrentUserType,
    namePrefix: string,
    propertyId?: string,
    watermarkPosition?: WatermarkPosition,
    watermarkScale?: number,
    metadata?: { title?: string; tags?: string[] },
  ): Promise<ImageGenerationResult> {
    // Build a searchable filename slug from the article title when we have one.
    // Keeps the timestamp suffix so we never clash with existing records.
    const title = metadata?.title?.trim();
    const tags = (metadata?.tags || []).map((t) => String(t).trim()).filter(Boolean);
    const slug = title
      ? slugify(title, { lower: true, strict: true }).slice(0, 60)
      : '';
    const filenameBase = slug ? `${namePrefix}-${slug}` : namePrefix;
    // Caption gets the full title plus tags so the media-library search hits
    // either the topic or any of the tags. alt_text is not stored via the
    // upload query yet — caption is the searchable field that already flows.
    const captionParts: string[] = [];
    if (title) captionParts.push(title);
    if (tags.length) captionParts.push(tags.join(', '));
    const caption = captionParts.join(' — ');

    const file = {
      buffer: imageBuffer,
      originalname: `${filenameBase}-${Date.now()}.png`,
      mimetype: 'image/png',
      size: imageBuffer.length,
      fieldname: 'files',
      encoding: '7bit',
    };

    const query = {
      service: process.env.UPLOAD_SERVICE || FILE_UPLOAD_SERVICE.LOCAL,
      strategy: 'full',
      isPrivate: false,
      propertyId,
      watermarkPosition,
      watermarkScale,
      caption: caption || undefined,
    };

    const req = {} as Request;
    const uploadService = query.service;
    const org = slugify(process.env.BRAND_NAME || 'default', { lower: true });

    if (uploadService === FILE_UPLOAD_SERVICE.S3) {
      return (await this._awsService.handleRequest(
        [file],
        req,
        query,
        org,
        user
      )) as ImageGenerationResult;
    }

    if (uploadService === FILE_UPLOAD_SERVICE.CLOUDINARY) {
      return (await this._cloudinaryService.handleRequest(
        [file],
        req,
        query,
        org,
        user
      )) as ImageGenerationResult;
    }

    return (await this._localService.handleRequest([file], req, query, org, user)) as ImageGenerationResult;
  }

  /**
   * Generate image using Azure Flux API
   */
  private async generateImageUsingFlux(
    prompt: string,
    aspectRatio: string
  ): Promise<{ image: string }> {
    const fluxApiKey = this._configService.get<string>('AZURE_FLUX_API_KEY');

    if (!fluxApiKey) {
      throw new BadRequestException('Azure Flux API key not configured');
    }

    const aspectRatioValue = FLUX_ASPECT_RATIO_MAP[aspectRatio] || '16:9';

    // Enhanced prompt to prevent text in images
    const enhancedPrompt = `${prompt}. Professional photography, no text, no words, no letters, clean image`;

    this._logger.debug(
      `Generating image with Flux: prompt="${enhancedPrompt}", aspectRatio=${aspectRatioValue}`,
      this.constructor.name
    );

    try {
      // Step 1: Submit generation request
      const generateResponse = await axios.post(
        `${FLUX_API_ENDPOINT}/${FLUX_MODEL}`,
        {
          prompt: enhancedPrompt,
          width: aspectRatioValue === '16:9' ? 1280 : aspectRatioValue === '9:16' ? 720 : 1024,
          height: aspectRatioValue === '16:9' ? 720 : aspectRatioValue === '9:16' ? 1280 : 1024,
          prompt_upsampling: false,
          safety_tolerance: 2,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Key': fluxApiKey,
          },
        }
      );

      const requestId = generateResponse.data.id;
      this._logger.debug(`Flux request submitted: ${requestId}`, this.constructor.name);

      // Step 2: Poll for result
      let attempts = 0;
      const maxAttempts = 60; // 60 attempts * 2 seconds = 2 minutes max wait

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between polls

        const resultResponse = await axios.get(`${FLUX_API_ENDPOINT}/get_result?id=${requestId}`, {
          headers: {
            'X-Key': fluxApiKey,
          },
        });

        if (resultResponse.data.status === 'Ready') {
          // Download the image
          const imageUrl = resultResponse.data.result.sample;
          const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
          });

          // Convert to base64
          const base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');

          this._logger.log('Flux image generated successfully', this.constructor.name);
          return { image: base64Image };
        } else if (resultResponse.data.status === 'Error') {
          throw new Error(
            `Flux generation failed: ${resultResponse.data.error || 'Unknown error'}`
          );
        }

        attempts++;
        this._logger.debug(
          `Waiting for Flux image (attempt ${attempts}/${maxAttempts})...`,
          this.constructor.name
        );
      }

      throw new Error('Flux image generation timed out');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._logger.error(
        `Flux image generation failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        this.constructor.name
      );
      throw new InternalServerErrorException(`Flux image generation failed: ${errorMessage}`);
    }
  }

  /**
   * Use a fast text-only call to select the best template for the given prompt.
   * Falls back to 'editorial-photo' if response is unrecognised.
   */
  private async _selectTemplate(prompt: string, textModelId: string): Promise<string> {
    try {
      const selectionResponse = await this.genAI!.models.generateContent({
        model: textModelId,
        contents: TEMPLATE_SELECTION_PROMPT(prompt),
      });
      const selected = (selectionResponse.text ?? '').trim().toLowerCase();
      if (TEMPLATE_KEYS.includes(selected)) {
        this._logger.log(`Template selected: ${selected}`, this.constructor.name);
        return selected;
      }
    } catch {
      // Non-fatal: fall through to default
    }
    this._logger.log(
      'Template selection failed, using default: editorial-photo',
      this.constructor.name
    );
    return 'editorial-photo';
  }

  /**
   * Generate image using Google Gemini (Imagen)
   */
  private async generateImageUsingGemini(
    prompt: string,
    aspectRatio: string = '16:9',
    templateKey?: string,
    isInfographic: boolean = false
  ): Promise<{ image: string }> {
    if (!this.genAI) {
      throw new BadRequestException('Gemini API key not configured');
    }

    const modelId =
      this._configService.get<string>('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-preview-04-17';
    const textModelId = this._configService.get<string>('GEMINI_TEXT_MODEL') || 'gemini-2.5-flash';

    try {
      // For infographics, use the prompt directly — image templates override infographic layout instructions
      let wrappedPrompt: string;
      if (isInfographic) {
        wrappedPrompt = prompt;
        this._logger.log(
          `Generating infographic with Gemini: model=${modelId} (bypassing template wrapper)`,
          this.constructor.name
        );
      } else {
        // Step 1: select template (auto if not provided by caller)
        const resolvedKey = templateKey ?? (await this._selectTemplate(prompt, textModelId));
        const template = IMAGE_TEMPLATES[resolvedKey] ?? IMAGE_TEMPLATES['editorial-photo'];
        wrappedPrompt = template.promptWrapper(prompt);
        this._logger.log(
          `Generating image with Gemini: template=${resolvedKey}, model=${modelId}`,
          this.constructor.name
        );
      }

      const imageConfig: Record<string, any> = {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio,
        },
      };
      const searchToolEnv = String(
        this._configService.get<string>('GEMINI_IMAGE_ENABLE_SEARCH_TOOL') || 'true'
      ).toLowerCase();
      const enableImageSearchTool = searchToolEnv !== 'false';
      if (!isInfographic && enableImageSearchTool) {
        imageConfig.tools = [{ googleSearch: {} }];
      }

      let response;
      try {
        response = await this.genAI.models.generateContent({
          model: modelId,
          contents: wrappedPrompt,
          config: imageConfig,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Some Gemini image models reject googleSearch tool; retry once without it.
        if (msg.includes('Search as tool is not enabled for this model') && imageConfig.tools) {
          delete imageConfig.tools;
          response = await this.genAI.models.generateContent({
            model: modelId,
            contents: wrappedPrompt,
            config: imageConfig,
          });
        } else {
          throw err;
        }
      }

      const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData);
      if (imagePart?.inlineData?.data) {
        this._logger.log(
          `Image generated successfully with Gemini (${imagePart.inlineData.mimeType})`,
          this.constructor.name,
        );
        return { image: imagePart.inlineData.data };
      }

      this._logger.warn('Gemini returned no inline image data', this.constructor.name);
      throw new Error('Failed to extract image data from Gemini response');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._logger.error(
        `Gemini image generation failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        this.constructor.name
      );
      throw new InternalServerErrorException(`Gemini image generation failed: ${errorMessage}`);
    }
  }
}
