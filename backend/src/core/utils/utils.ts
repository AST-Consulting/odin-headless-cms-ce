import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { phone } from 'phone';
import { v4 as uuidv4 } from 'uuid';
import { APIFeatures } from './apiFeatures.utils';
import slugify from 'slugify';
import { BadRequestException } from '@nestjs/common';
import * as geoip from 'geoip-lite';
import { Request } from 'express';
import UAParser = require('ua-parser-js');
import sharp from 'sharp';
import { DeviceType, GENDER, MaritalStatus, ModuleName } from '../constants/enums.constants';
import { ISanitizedUser } from '@user/interfaces/sanitized-user.interface';
import { IRoleSub } from '@role/entities/role-sub.schema';
import { Permission } from '@role/entities/role.schema';
import { TUserDocument } from '@user/entities/user.schema';
import * as path from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import HTMLtoDOCX from 'html-to-docx';
import { TCurrentUserType } from '@auth/types/user.type';
import * as net from 'net';

// Security: Validate and extract client IP address safely
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP (client IP when behind trusted proxy)
    const firstIp = forwardedFor.toString().split(',')[0].trim();
    // Validate it's a proper IP format (handles IPv4 and all IPv6 forms including compressed)
    if (net.isIP(firstIp) !== 0) {
      return firstIp;
    }
  }
  // Fallback to Express req.ip (respects trust proxy setting)
  return req.ip || '0.0.0.0';
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export interface ISeoMetaData {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  category: string;
  tags: string[];
  excerpt: string;
  slug: string;
}

// Function to validate phone numbers
export function isValidPhoneNumber(phoneNumber: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phoneNumber);
}

export function parsePhoneNumber(input: string): {
  countryPrefix: string;
  fullNumber: string;
  number: string;
} {
  if (input.length == 10) input = '+91' + input;

  if (input.length == 12) input = '+' + input;
  const result = phone(input);

  if (result.isValid) {
    const countryPrefix = result.countryCode;
    const fullNumber = result.phoneNumber;
    const number = fullNumber.replace(countryPrefix, '');

    return {
      countryPrefix,
      fullNumber,
      number,
    };
  } else {
    throw new BadRequestException('Invalid phone number format');
  }
}

export const expireTime5M = '5m';

export const expireTime1H = '1h';

const SALT_ROUNDS = 10;

export async function generateSecretToken(): Promise<string> {
  return uuidv4();
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, SALT_ROUNDS);
}

export async function compareTokens(token: string, hashedToken: string): Promise<boolean> {
  return await bcrypt.compare(token, hashedToken);
}

export function detectAndDecodeString(input: string): {
  emailContent: string;
  isHtml: boolean;
} {
  // Regular expressions to identify Base64 encoded strings and HTML content
  const base64Regex = /^(?:[A-Za-z0-9+/]{4})*?(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;
  const htmlRegex = /<[^>]+>/;

  // Helper function to decode Base64
  // const decodeBase64 = (str: string): string => atob(str);
  const decodeBase64 = (str: string): string => Buffer.from(str, 'base64').toString('utf-8');

  let finalString = input;
  let isHtml = false;

  // Check if the input is Base64 encoded
  if (base64Regex.test(input)) {
    try {
      const decoded = decodeBase64(input);
      // If decoding is successful and changes the string, update finalString
      if (decoded !== input) {
        finalString = decoded;
      }
    } catch (e) {
      // If Base64 decoding fails, retain the original string
    }
  }

  // Check if the final string is HTML
  isHtml = htmlRegex.test(finalString);

  return { emailContent: finalString, isHtml };
}

export function isURLEncoded(input: string): boolean {
  if (!input || input == '') return false;
  // Regular expression to match a percent-encoded triplet
  const percentEncodedRegex = /%(?:[0-9A-Fa-f]{2})/g;

  // Check if input contains any percent-encoded sequences
  const matches = input.match(percentEncodedRegex);

  if (!matches) {
    // If no matches found, input is not URL encoded
    return false;
  }

  // Iterate through matched percent-encoded sequences
  for (const match of matches) {
    try {
      // Attempt to decode the matched sequence
      decodeURIComponent(match);
    } catch (error) {
      // If decoding fails, input is not properly URL encoded
      return false;
    }
  }

  // If all sequences decode successfully, input is URL encoded
  return true;
}
export function parseRecipient(phoneNumber: string): any {
  const phoneNumberRegex = /^(\+?(\d{1,2}))(.*$)/;
  // Regex pattern to match phone number
  // ^ matches the start of the string
  // (\+?(\d{1,2})) captures a group (group 1) that matches:
  //   \+? matches an optional + character (0 or 1 times)
  //   (\d{1,2}) captures a group (group 2) that matches 1 or 2 digits (the country code)
  // (.*) captures a group (group 3) that matches any characters (including none) until the end of the string
  // $ matches the end of the string
  const match = phoneNumberRegex.exec(phoneNumber);

  if (phoneNumber.length === 10) {
    return {
      countryPrefix: '',
      number: phoneNumber,
      fullNumber: phoneNumber,
    };
  }
  let countryPrefix = match[2];
  const fullNumberWithoutCountryCode = match[3];
  const number = fullNumberWithoutCountryCode.replace(/[^0-9]/g, '');
  const fullNumber = `+${countryPrefix}${number}`;
  countryPrefix = `+${countryPrefix}`;

  const recipientObject = {
    countryPrefix,
    number,
    fullNumber,
  };

  return recipientObject;
}

// export function slugify(text: string): string {
//   return text
//     .toString() // Convert to string
//     .normalize('NFD') // Normalize the string
//     .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
//     .toLowerCase() // Convert to lowercase
//     .trim() // Trim whitespace
//     .replace(/[^a-z0-9 -]/g, '') // Remove invalid characters
//     .replace(/\s+/g, '-') // Replace spaces with hyphens
//     .replace(/-+/g, '-'); // Replace multiple hyphens with a single hyphen
// }

export function customUrlEncode(str) {
  const specialChars = {
    ' ': '%20',
    '!': '%21',
    '"': '%22',
    '#': '%23',
    $: '%24',
    '%': '%25',
    '&': '%26',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    '*': '%2A',
    '+': '%2B',
    ',': '%2C',
    '-': '%2D',
    '.': '%2E',
    '/': '%2F',
    ':': '%3A',
    ';': '%3B',
    '<': '%3C',
    '=': '%3D',
    '>': '%3E',
    '?': '%3F',
    '@': '%40',
    '[': '%5B',
    '\\': '%5C',
    ']': '%5D',
    '^': '%5E',
    _: '%5F',
    '`': '%60',
    '{': '%7B',
    '|': '%7C',
    '}': '%7D',
    '~': '%7E',
  };

  return str
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code < 128) {
        // Use special character map for ASCII characters
        return specialChars[char] || char;
      } else {
        // Encode non-ASCII characters using UTF-8
        return encodeURIComponent(char);
      }
    })
    .join('');
}

export function templateMessageCreator(message: string, templateParams: null | string[]): string {
  if (!templateParams) return message;
  templateParams.forEach((param, index) => {
    const placeholder = `{{${index + 1}}}`;
    message = message.replace(placeholder, param);
  });

  return message;
}
export function templateMessageFor2Factor(
  message: string,
  templateParams: null | string[]
): string {
  if (!templateParams) return message;

  templateParams.forEach((param, index) => {
    const placeholder = `#VAR${index + 1}#`;
    message = message.replace(new RegExp(placeholder, 'g'), param);
  });

  return message;
}
export function buildUserMetadata(user: TCurrentUserType): {
  id: string;
  name: string;
  email: string;
  userType: string;
} {
  return {
    id: user?.sub || 'System',
    name: user?.name || 'System',
    userType: user?.userType || 'System',
    email: user?.email || 'System',
  };
}
export async function getModelWithFeatures<T>(model: Model<T>, queryParams: any): Promise<any> {
  const features = new APIFeatures(model, queryParams)
    .filter()
    .search()
    .sort()
    .limitFields()
    .paginate();
  return await features.getQuery().exec();
}

// Define the interface for the slug document if needed

export async function generateUniqueSlug(
  name: string,
  model: Model<any>,
  user: any,
  moduleType: ModuleName
): Promise<string> {
  // Step 1: Create the initial slug using slugify
  let slug = slugify(name, { lower: true });

  // Step 2: Check if the generated slug already exists in the Slug collection
  let slugExists = await model.findOne({ slug });

  if (!slugExists) {
    // If the slug doesn't exist, store it in the database
    await model.create({
      slug,
      type: moduleType,
      createdBy: {
        userId: user.sub,
        userName: user.name,
        userType: user.userType,
        profileId: user.profileId,
      },
      updatedBy: {
        userId: user.sub,
        userName: user.name,
        userType: user.userType,
        profileId: user.profileId,
      },
    });
    return slug;
  }
  // Step 3: If the slug exists, modify the slug by appending/incrementing the number
  while (slugExists) {
    const slugParts = slug.split('-');
    const lastPart = slugParts[slugParts.length - 1];

    let newSlug: string;
    if (!isNaN(parseInt(lastPart))) {
      // If the last part is a number, increment it
      const lastNumber = parseInt(lastPart);
      slugParts[slugParts.length - 1] = (lastNumber + 1).toString();
      newSlug = slugParts.join('-');
    } else {
      // If no number at the end or '-' not present, append "-1"
      newSlug = `${slug}-1`;
    }

    slug = newSlug;
    slugExists = await model.findOne({ slug });
  }

  // Step 4: Store the new unique slug in the database
  await model.create({
    slug,
    type: moduleType,
    createdBy: {
      userId: user.sub,
      userName: user.name,
      userType: user.userType,
      profileId: user.profileId,
    },
    updatedBy: {
      userId: user.sub,
      userName: user.name,
      userType: user.userType,
      profileId: user.profileId,
    },
  });

  // Return the modified or unique slug
  return slug;
}
export function extractModule(summary: string): string {
  const moduleTypes = Object.values(ModuleName);
  for (const moduleType of moduleTypes) {
    if (summary.toLowerCase().includes(moduleType)) {
      return moduleType;
    }
  }
  return 'item'; // Default return value if no match found
}

export function getSalutation(name: string, maritalStatus: string, gender: string): string {
  const titles = {
    [GENDER.MALE]: {
      [MaritalStatus.MARRIED]: 'Mr.',
      [MaritalStatus.SINGLE]: 'Mr.',
    },
    [GENDER.FEMALE]: {
      [MaritalStatus.SINGLE]: 'Ms.',
    },
    [GENDER.OTHERS]: {
      [MaritalStatus.MARRIED]: 'Mx.',

      [MaritalStatus.SINGLE]: 'Mx.',
    },
  };

  return `${titles[gender][maritalStatus]} ${name}`;
}
export function getDeviceDetails(req: Request): any {
  const ipAddress = getClientIp(req);
  // Extract country code based on IP address
  let countryCode = null;
  const geo = geoip.lookup(ipAddress);
  if (geo && geo.country) {
    countryCode = geo.country;
  } else {
    countryCode = 'IN'; // Default country code
  }

  // Extract user-agent header from the request
  const userAgent = req.headers['user-agent'];

  // Parse the user-agent string using ua-parser-js
  const parser = new UAParser();
  const uaResult = parser.setUA(userAgent).getResult();

  let type = DeviceType.OTHER;
  if (userAgent && userAgent.includes('okhttp/')) {
    type = DeviceType.PHONE; // Set device type to phone if OkHttp is detected
    uaResult.os.name = DeviceType.ANDROID; // Set platform to Android for OkHttp requests
  } else if (uaResult.os && uaResult.os.name) {
    const osName = uaResult.os.name.toLowerCase();
    switch (osName) {
      case DeviceType.WINDOW:
      case DeviceType.MAC:
      case DeviceType.LINUX:
        type = DeviceType.DESKTOP;
        break;
      case DeviceType.ANDROID:
      case DeviceType.IOS:
        type = DeviceType.PHONE;
        break;
    }
  }

  // Extract device details from the parsed result
  const device = {
    countryCode: countryCode,
    ip: ipAddress,
    userAgent: userAgent,
    name: uaResult.device.model || '',
    platform: uaResult.os.name || '',
    browser: uaResult.browser.name || '',
    type: type,
    dummy: '', // Add logic to determine dummy value
  };

  return device;
}
export function convertEmailToLowerCase(email: string): string {
  if (!email) return email;

  // Convert the email to lowercase and return it.
  return email.toLowerCase();
}
export function capitalizeNames(name?: string): { name?: string } {
  if (!name) return { name: undefined };

  // Split by spaces, capitalize each word, and join back
  const capitalizedName = name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return {
    name: capitalizedName,
  };
}

export function createUserObject(user: TUserDocument): ISanitizedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    verified: user.verified,
    userType: user.userType,
    timezone: user.timezone?.country_or_territory ?? null,
    phone: user.phone ?? null,
    designation: user.designation ?? null,
    industry: user.industry ?? null,
    expertise: user.expertise ?? null,
    interests: user.interests ?? null,
    tone: user.tone ?? null,
    style: user.style ?? null,
    emoticons: user.emoticons ?? null,
    defaultPostHour: user.defaultPostHour ?? null,
    usedInviteCode: user.usedInviteCode ?? null,
    linkedin: user.linkedin ? true : false,
    totalCreditsUsed: user.totalCreditsUsed,
    totalCreditsBought: user.totalCreditsBought,
    subscription: user.subscription ?? null,
    isCompleted: user.isCompleted,
    companyName: user.companyName ?? null,
    accountLinked: user.accountLinked ?? null,
    hasCompletedOnboarding: user.hasCompletedOnboarding ?? false,
    generateNewPw: user.generateNewPw ?? false,
    slug: user.slug,
    username: user.username ?? null,
    description: user.description ?? null,
    profilePicture: user.profilePicture
      ? {
        url: user.profilePicture.url,
        fileName: user.profilePicture.fileName,
        path: user.profilePicture.path,
        id: user.profilePicture.id,
      }
      : null,
    organizations: user.organizations?.map((org: any) => ({
      id: org.id || org._id?.toString(),
      name: org.name,
      domain: org.domain,
    })) ?? [],
    properties: (user.properties as any[])?.map((p: any) => ({
      id: p.id || p._id?.toString(),
      domain: p.domain,
      name: p.name,
      status: p.status,
      organizationId: (p.organization?.id || p.organizationId),
      roles: p.roles ?? [],
      permissions: (p.permissions as any[])?.filter(perm => perm && perm.module && Array.isArray(perm.actions) && perm.actions.length > 0) ?? [],
    })) ?? [],
    roles: (user as any).roles ?? [],
    permissions: (user as any).permissions?.filter(perm => perm && perm.module && Array.isArray(perm.actions) && perm.actions.length > 0) ?? [],
    socialLinks: user.socialLinks
      ? {
        twitter: user.socialLinks.twitter,
        facebook: user.socialLinks.facebook,
        linkedin: user.socialLinks.linkedin,
        instagram: user.socialLinks.instagram,
      }
      : null,
    seo: user.seo
      ? {
        title: user.seo.title,
        metaDescription: user.seo.metaDescription,
        keywords: user.seo.keywords,
      }
      : null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
    createdBy: user.createdBy
      ? {
        id: user.createdBy?.id,
        name: user.createdBy?.name,
        userType: user.createdBy?.userType,
      }
      : null,
    updatedBy: user.updatedBy
      ? {
        id: user.updatedBy?.id,
        name: user.updatedBy?.name,
        userType: user.updatedBy?.userType,
      }
      : null,
  };
}

export function addTitleToHtmlContent(title: string, htmlContent: string): string {
  // Check if the HTML content has a proper structure
  const bodyStartIndex = htmlContent.indexOf('<body>');

  if (bodyStartIndex !== -1) {
    // If <body> tag exists, insert <h1> right after it
    const insertPosition = bodyStartIndex + '<body>'.length;
    return (
      htmlContent.slice(0, insertPosition) + `<h1>${title}</h1>` + htmlContent.slice(insertPosition)
    );
  } else {
    // If no proper HTML structure, wrap the content
    return `<html><head></head><body><h1>${title}</h1>${htmlContent}</body></html>`;
  }
}

/**
 * Compresses and optimizes a base64 image to reduce file size
 * @param base64Image - Base64 encoded image string
 * @param maxWidth - Maximum width for resizing (default: 800)
 * @param quality - JPEG quality (default: 80)
 * @returns Promise<Buffer> - Compressed image buffer
 */
export async function compressImage(
  base64Image: string,
  maxWidth: number = 800,
  quality: number = 80
): Promise<Buffer> {
  try {
    if (!base64Image) {
      throw new Error('No image data provided');
    }

    // Convert Base64 to Buffer
    const imageBuffer = Buffer.from(base64Image, 'base64');

    // Compress and optimize the image
    const compressedImageBuffer = await sharp(imageBuffer)
      .resize(maxWidth, null, {
        withoutEnlargement: true, // Don't enlarge if smaller than maxWidth
        fit: 'inside', // Maintain aspect ratio
      })
      .jpeg({
        quality,
        progressive: true, // Enable progressive JPEG for better loading
        mozjpeg: true, // Use mozjpeg encoder for better compression
      })
      .toBuffer();

    console.log(
      `Image compressed: Original size: ${imageBuffer.length} bytes, Compressed size: ${compressedImageBuffer.length} bytes`
    );

    return compressedImageBuffer;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Saves a base64 image to the filesystem with compression
 * @param base64Image - Base64 encoded image string
 * @param fileName - Name for the saved image file (without extension)
 * @param directory - Directory to save the image
 * @returns Promise<string> - Path to the saved image file
 */
export async function saveCompressedImage(
  base64Image: string,
  fileName: string,
  directory: string
): Promise<string> {
  try {
    if (!base64Image) {
      throw new Error('No image data provided');
    }

    // Ensure the directory exists
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }

    // Compress the image
    const compressedImageBuffer = await compressImage(base64Image);

    // Create file path with .jpg extension
    const imagePath = path.join(directory, `${fileName}.jpg`);

    // Write the compressed image to file
    writeFileSync(imagePath, new Uint8Array(compressedImageBuffer));

    console.log(`Image saved successfully: ${imagePath}`);
    return imagePath;
  } catch (error) {
    console.error('Error saving compressed image:', error);
    throw new Error('Failed to save compressed image');
  }
}

export async function convertHtmlToDocx(
  title: string,
  htmlContent: string,
  siteSlug: string,
  seoMetaData: ISeoMetaData,
  generatedAt: string,
  imageData?: string
): Promise<string> {
  try {
    // Validate inputs
    if (!title || !htmlContent || !siteSlug) {
      console.error(
        `Missing required parameters: title=${!!title}, htmlContent=${!!htmlContent}, siteSlug=${!!siteSlug}`
      );
      return ''; // Return empty string if validation fails
    }

    // Add title as H1 to the HTML content
    let htmlWithTitle = addTitleToHtmlContent(title, htmlContent);

    // Append SEO metadata to the HTML content
    if (seoMetaData) {
      const seoHtml = `
          <br>
          <hr>
          <h2>SEO Meta Data</h2>
          <p><strong>Meta Title:</strong> ${seoMetaData.metaTitle || ''}</p>
          <p><strong>Meta Description:</strong> ${seoMetaData.metaDescription || ''}</p>
          <p><strong>OG Title:</strong> ${seoMetaData.ogTitle || ''}</p>
          <p><strong>OG Description:</strong> ${seoMetaData.ogDescription || ''}</p>
          <p><strong>Category:</strong> ${seoMetaData.category || ''}</p>
          <p><strong>Tags:</strong> ${Array.isArray(seoMetaData.tags) ? seoMetaData.tags.join(', ') : seoMetaData.tags || ''}</p>
          <p><strong>Excerpt:</strong> ${seoMetaData.excerpt || ''}</p>
          <p><strong>Slug:</strong> ${seoMetaData.slug || ''}</p>
        `;

      // Check if the HTML has a closing body tag to insert before it
      if (htmlWithTitle.includes('</body>')) {
        htmlWithTitle = htmlWithTitle.replace('</body>', seoHtml + '</body>');
      } else {
        // If no closing body tag, just append the SEO HTML
        htmlWithTitle += seoHtml;
      }
    }

    // Get the root directory path of the project
    const rootDir = process.cwd();

    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split('T')[0];

    // Create the folder structure: public/user_id/date
    const publicDir = path.join(rootDir, 'public');
    const userDir = path.join(publicDir, siteSlug);
    const dateDir = path.join(userDir, currentDate);

    // Ensure the folder structure exists
    if (!existsSync(publicDir)) {
      mkdirSync(publicDir, { recursive: true });
    }
    if (!existsSync(userDir)) {
      mkdirSync(userDir, { recursive: true });
    }
    if (!existsSync(dateDir)) {
      mkdirSync(dateDir, { recursive: true });
    }

    // Sanitize the title to remove invalid characters for filenames
    // Extract HH:MM from generatedAt timestamp
    const timestamp = new Date(generatedAt);
    const hours = timestamp.getUTCHours().toString().padStart(2, '0');
    const minutes = timestamp.getUTCMinutes().toString().padStart(2, '0');
    const timeString = `${hours}-${minutes}`;

    const sanitizedTitle = title
      .normalize('NFKD') // Normalize Unicode
      .replace(/[\s\p{P}\p{S}]+/gu, '-') // Replace spaces & punctuations with hyphen
      .replace(/^-+|-+$/g, '') // Trim leading/trailing hyphens
      .toLowerCase();

    // Append the time to the sanitized title
    const sanitizedTitleWithTime = `${sanitizedTitle}-${timeString}`;

    // Define the output file path in the date-specific folder
    const outputPath = path.join(dateDir, `${sanitizedTitleWithTime}.docx`);

    // Save the generated image if provided
    if (imageData) {
      try {
        const imageFileName = `${sanitizedTitleWithTime}-featured`;
        await saveCompressedImage(imageData, imageFileName, dateDir);
        console.log(`Image saved alongside DOCX: ${imageFileName}.jpg`);
      } catch (imageError) {
        console.error('Failed to save image with DOCX:', imageError);
        // Don't fail the DOCX generation if image saving fails
      }
    }

    // Convert HTML to DOCX (Buffer) using html-to-docx
    const nodeBuffer = await HTMLtoDOCX(htmlWithTitle, null, {});

    // Write the content to file
    writeFileSync(outputPath, new Uint8Array(nodeBuffer as Buffer));

    return outputPath; // Return the file path for reference
  } catch (error) {
    console.error('Error converting HTML to DOCX:', error);
    return null;
  }
}

export function detectLanguage(text: string): string {
  const hindiPattern = /[\u0900-\u097F]/;
  return hindiPattern.test(text) ? 'hindi' : 'english';
}

export function generateHindiSlug(hindiText: string): string {
  return hindiText
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0900-\u097Fa-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

// Removed PDF conversion helper in favor of DOCX-only flow
