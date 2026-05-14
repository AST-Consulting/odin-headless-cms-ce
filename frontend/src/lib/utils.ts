import {
  type ClassValue,
  clsx
} from "clsx";
import {
  twMerge
} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

export function formatPercentage(num: number): string {
  return `${(num * 100).toFixed(1)}%`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function truncateWithEllipsis(str: string, maxLength: number): string {
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '...';
  }
  return str;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/-+/g, "-"); // Replace multiple - with single -
}

export function generateRandomPassword(length = 14): string {
  if (length < 12) length = 12;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  // Guarantee at least one of each and two symbols
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle it
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (password.length < 12) {
    return { isValid: false, message: "Password must be at least 12 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "Password must contain at least one number" };
  }
  
  const specialChars = (password.match(/[^A-Za-z0-9]/g) || []).length;
  if (specialChars < 2) {
    return { isValid: false, message: "Password must contain at least two special characters" };
  }

  // Sequential check (3 or more)
  for (let i = 0; i < password.length - 2; i++) {
    const char1 = password.charCodeAt(i);
    const char2 = password.charCodeAt(i + 1);
    const char3 = password.charCodeAt(i + 2);

    // ASC: 123, abc
    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return { isValid: false, message: "Password cannot contain sequential characters like '123' or 'abc'" };
    }
    // DESC: 321, cba
    if (char2 === char1 - 1 && char3 === char2 - 1) {
      return { isValid: false, message: "Password cannot contain sequential characters like '321' or 'cba'" };
    }
  }

  return { isValid: true };
}

export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return "";
  
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  return text
    .replace(/&[a-z]+;|&#[0-9]+;|&#x[0-9a-f]+;/gi, (match) => {
      const lowerMatch = match.toLowerCase();
      if (entities[lowerMatch]) return entities[lowerMatch];
      if (lowerMatch.startsWith('&#x')) {
        return String.fromCharCode(parseInt(match.substring(3, match.length - 1), 16));
      }
      if (lowerMatch.startsWith('&#')) {
        return String.fromCharCode(parseInt(match.substring(2, match.length - 1), 10));
      }
      return match;
    });
}


/**
 * Safely resolves an image URL, prepending the CDN host if necessary.
 * Returns null instead of an empty string to prevent Next.js "empty src" console errors.
 * 
 * @param url The relative or absolute image URL
 * @returns The full image URL or null if invalid
 */
export function getImageUrl(url?: string | null): string | null {
  if (!url) return null;
  
  const CDN = process.env.NEXT_PUBLIC_CDN_URL || "";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // If it's an absolute URL (e.g. S3 or origin server), check if it contains
  // an /uploads/ path that should be rewritten to the CDN.
  if (url.startsWith("http")) {
    const uploadsIndex = url.indexOf("/uploads/");
    if (uploadsIndex !== -1 && CDN) {
      // Extract just the /uploads/... portion and serve via CDN
      const uploadPath = url.slice(uploadsIndex);
      return `${CDN}${uploadPath}`;
    }
    // Other absolute URLs (YouTube thumbnails, external images, etc.) → pass through
    return url;
  }

  // Ensure we have a leading slash for normalization
  const normalizedPath = url.startsWith("/") ? url : `/${url}`;

  // Check if it's an upload or a public asset
  if (normalizedPath.includes("/uploads")) return `${CDN}${normalizedPath}`;
  if (normalizedPath.includes("/public/")) return `${API_BASE}${normalizedPath}`;
  return url;
}
