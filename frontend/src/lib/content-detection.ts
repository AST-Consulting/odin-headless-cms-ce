/**
 * Patterns that indicate the user is requesting content generation
 * These will trigger auto-insertion into the editor
 */
const CONTENT_GENERATION_PATTERNS = [
  /write\s+(an?\s+)?article/i,
  /write\s+(a\s+)?draft/i,
  /prepare\s+(a\s+)?draft/i,
  /create\s+(an?\s+)?article/i,
  /create\s+(some\s+)?content/i,
  /draft\s+(an?\s+)?article/i,
  /compose\s+(an?\s+)?article/i,
  /generate\s+(an?\s+)?article/i,
  /write\s+about/i,
  /write\s+something\s+about/i,
  /can\s+you\s+write/i,
  /could\s+you\s+write/i,
  /please\s+write/i,
  /help\s+me\s+write/i,
  /create\s+(a\s+)?blog\s+post/i,
  /write\s+(a\s+)?blog\s+post/i,
  /generate\s+(some\s+)?content/i,
  /make\s+(an?\s+)?article/i,
];

/**
 * Determines if a user message should trigger auto-insertion
 * into the editor based on content generation patterns
 * 
 * @param userMessage - The user's message to check
 * @returns true if the message matches content generation patterns
 */
export function shouldAutoInsert(userMessage: string): boolean {
  if (!userMessage || typeof userMessage !== 'string') {
    return false;
  }
  
  const trimmedMessage = userMessage.trim();
  
  // Check if message matches any of the patterns
  return CONTENT_GENERATION_PATTERNS.some(pattern => 
    pattern.test(trimmedMessage)
  );
}





