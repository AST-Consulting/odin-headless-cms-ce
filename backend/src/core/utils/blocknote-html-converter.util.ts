/**
 * Custom HTML converter for BlockNote rich blocks
 * Handles standard blocks and custom embed blocks (Twitter, Instagram, YouTube, etc.)
 */

interface RichBlock {
  id: string;
  type: string;
  content?: any[];
  metadata?: {
    props?: Record<string, any>;
    children?: any[];
    [key: string]: any;
  };
  props?: Record<string, any>;
  order?: number;
  status?: string;
}

interface InlineContent {
  type: string;
  text?: string;
  styles?: Record<string, any>;
  [key: string]: any;
}

/**
 * Converts inline content (text with styles) to HTML
 */
function inlineContentToHTML(content: InlineContent[]): string {
  if (!Array.isArray(content) || content.length === 0) {
    return '';
  }

  return content
    .map((item) => {
      if (!item || (item.type !== 'text' && item.type !== 'link')) return '';

      let text = item.text || '';
      const styles = item.styles || {};

      // Apply text styles
      if (styles.bold) text = `<strong>${text}</strong>`;
      if (styles.italic) text = `<em>${text}</em>`;
      if (styles.underline) text = `<u>${text}</u>`;
      if (styles.strikethrough) text = `<s>${text}</s>`;
      if (styles.code) text = `<code>${text}</code>`;

      if (item.type === 'link' && item.href) {
        // Recursive call to handle nested content inside the link
        const linkText = inlineContentToHTML(item.content || []);
        text = `<a href="${item.href}" target="_blank" rel="noopener noreferrer">${linkText || text}</a>`;
      }

      return text;
    })
    .join('');
}

/**
 * Converts a timestamp block to HTML
 */
function timestampToHTML(props: Record<string, any>): string {
  const timestamp = props.timestamp || new Date().toISOString();
  const authorName = props.authorName || '';
  const date = new Date(timestamp);

  const formattedTime = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let html = `<div class="timestamp-block" style="margin: 16px 0; padding: 8px 0; border-left: 3px solid #2563eb; padding-left: 12px;">`;
  html += `<div style="font-weight: bold; color: #2563eb;">${formattedTime}</div>`;
  if (authorName) {
    html += `<div style="font-size: 0.875rem; color: #6b7280; margin-top: 4px;">By ${authorName}</div>`;
  }
  html += `</div>`;

  return html;
}

/**
 * Converts a Twitter embed block to HTML
 * Based on TwitterEmbedBlock.tsx
 */
function twitterEmbedToHTML(props: Record<string, any>): string {
  const tweetId = props.tweetId || '';
  let url = props.url || `https://twitter.com/i/status/${tweetId}`;

  // Ensure we use twitter.com domain for widget compatibility
  url = url.replace('x.com', 'twitter.com');

  // Add ref_src parameter if not present (required by widget.js)
  if (!url.includes('ref_src')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}ref_src=twsrc%5Etfw`;
  }

  if (!tweetId) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa;"><p style="margin: 0; color: #657786;">Unable to load tweet. <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #1DA1F2;">View on X →</a></p></div>`;
  }

  return `<blockquote class="twitter-tweet"><a href="${url}"></a></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
}

/**
 * Converts an Instagram embed block to HTML
 * Based on InstagramEmbedBlock.tsx
 */
function instagramEmbedToHTML(props: Record<string, any>): string {
  const postId = props.postId || '';
  const url = props.url || `https://www.instagram.com/p/${postId}/`;

  if (!postId || !url) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa;"><p style="margin: 0; color: #657786;">Unable to load Instagram post. <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #E1306C;">View on Instagram →</a></p></div>`;
  }

  return `<blockquote class="instagram-media" data-instgrm-captioned data-instgrm-permalink="${url}" data-instgrm-version="14" style="background: #FFF; border: 0; border-radius: 3px; box-shadow: 0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width: 540px; min-width: 326px; padding: 0; width: calc(100% - 2px);"><a href="${url}" target="_blank" rel="noopener noreferrer">View on Instagram</a></blockquote><script async src="https://www.instagram.com/embed.js"></script>`;
}

/**
 * Converts a YouTube embed block to HTML
 * Based on YouTubeEmbedBlock.tsx
 */
function youtubeEmbedToHTML(props: Record<string, any>): string {
  const videoId = props.videoId || '';

  if (!videoId) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa; color: #657786;">Invalid YouTube URL</div>`;
  }

  return `<div contenteditable="false" style="margin: 16px 0; width: 100%; display: flex; justify-content: center;"><div style="width: 100%; max-width: 800px; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"><iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; border-radius: 8px;" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div></div>`;
}

/**
 * Converts a SoundCloud embed block to HTML
 * Based on SoundCloudEmbedBlock.tsx
 */
function soundCloudEmbedToHTML(props: Record<string, any>): string {
  const url = props.url || '';
  const height = props.height || '166';

  if (!url) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa;"><p style="margin: 0; color: #657786;">Unable to load SoundCloud track. ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #ff5500;">Open in SoundCloud →</a>` : ''}</p></div>`;
  }

  const encodedUrl = encodeURIComponent(url);
  const iframeSrc = `https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`;

  return `<div contenteditable="false" style="margin: 16px 0; width: 100%; max-width: 100%;"><iframe width="100%" height="${height}" scrolling="no" frameborder="no" allow="autoplay" src="${iframeSrc}" style="border: none; border-radius: 8px;" title="SoundCloud Player"></iframe></div>`;
}

/**
 * Converts an image block to HTML
 */
function imageToHTML(props: Record<string, any>): string {
  const url = props.url || '';
  const caption = props.caption || '';
  const name = props.name || '';
  const textAlignment = props.textAlignment || 'left';

  if (!url) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa;"><p style="margin: 0; color: #657786;">Image unavailable</p></div>`;
  }

  const alignStyle =
    textAlignment === 'center'
      ? 'margin: 16px auto; display: block;'
      : textAlignment === 'right'
        ? 'margin: 16px 0 16px auto; display: block;'
        : 'margin: 16px 0;';

  let html = `<figure style="${alignStyle} max-width: 100%;">`;
  html += `<img src="${url}" alt="${name || caption || 'Image'}" style="max-width: 100%; height: auto; border-radius: 4px;" />`;

  if (caption) {
    html += `<figcaption style="margin-top: 8px; font-size: 0.875rem; color: #6b7280; text-align: ${textAlignment};">${caption}</figcaption>`;
  }

  html += `</figure>`;
  return html;
}

/**
 * Converts a video block to HTML
 */
function videoToHTML(props: Record<string, any>): string {
  const url = props.url || '';
  const caption = props.caption || '';
  const name = props.name || '';
  const textAlignment = props.textAlignment || 'left';

  if (!url) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa;"><p style="margin: 0; color: #657786;">Video unavailable</p></div>`;
  }

  const alignStyle =
    textAlignment === 'center'
      ? 'margin: 16px auto; display: block;'
      : textAlignment === 'right'
        ? 'margin: 16px 0 16px auto; display: block;'
        : 'margin: 16px 0;';

  let html = `<figure style="${alignStyle} max-width: 100%;">`;
  html += `<video controls style="max-width: 100%; height: auto; border-radius: 4px;">`;
  html += `<source src="${url}" type="video/mp4">`;
  html += `Your browser does not support the video tag.`;
  html += `</video>`;

  if (caption) {
    html += `<figcaption style="margin-top: 8px; font-size: 0.875rem; color: #6b7280; text-align: ${textAlignment};">${caption}</figcaption>`;
  }

  html += `</figure>`;
  return html;
}

/**
 * Converts a Snapchat embed block to HTML
 * Based on SnapchatEmbedBlock.tsx
 */
function snapchatEmbedToHTML(props: Record<string, any>): string {
  const url = props.url || '';

  if (!url) {
    return `<div contenteditable="false" style="margin: 16px 0; padding: 16px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #f7f9fa;"><p style="margin: 0; color: #657786;">Unable to load Snapchat Spotlight. ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #FFFC00;">Open in Snapchat →</a>` : ''}</p></div>`;
  }

  const embedUrl = `${url}?embed=true`;

  return `<div contenteditable="false" style="width: 100%; max-width: 405px; margin: 16px auto;"><iframe src="${embedUrl}" width="405" height="720" frameborder="0" scrolling="no" allow="autoplay; fullscreen" style="border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" title="Snapchat Spotlight"></iframe></div>`;
}

/**
 * Converts an FAQ embed block to HTML
 */
function faqEmbedToHTML(props: Record<string, any>): string {
  const question = props.question || '';
  const answer = props.answer || '';

  if (!question && !answer) {
    return '';
  }

  // return `
  // <div class="faq-block" style="margin: 24px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-family: sans-serif;">
  //   <details style="width: 100%;">
  //     <summary style="background-color: #f8fafc; padding: 16px 20px; font-weight: 700; cursor: pointer; color: #1e293b; font-size: 1.1rem; list-style: none; display: flex; align-items: center; justify-content: space-between;">
  //       <span>${question}</span>
  //       <span style="font-size: 1.2rem; transition: transform 0.2s;">▾</span>
  //     </summary>
  //     <div style="padding: 16px 20px; color: #334155; line-height: 1.6; border-top: 1px solid #e2e8f0;">
  //       ${answer}
  //     </div>
  //   </details>
  //   <style>
  //     .faq-block details summary::-webkit-details-marker { display: none; }
  //     .faq-block details[open] summary span:last-child { transform: rotate(180deg); }
  //   </style>
  // </div>`;

  return JSON.stringify({ type: 'faq', question, answer });
}


/**
 * Converts a single block to HTML
 */
function blockToHTML(block: RichBlock): string {
  const type = block.type || 'paragraph';
  const props = block.props || block.metadata?.props || {};
  const content = block.content || [];

  // Handle custom embed blocks
  switch (type) {
    // Recipe Specific Blocks - Handle as JSON for consumer site
    case 'recipeIngredient': {
      const text = inlineContentToHTML(content) || props.text || '';
      return JSON.stringify({ type: 'recipeIngredient', text });
    }

    case 'howToStep': {
      const text = inlineContentToHTML(content) || props.text || '';
      return JSON.stringify({ type: 'howToStep', text });
    }

    case 'timestamp':
      return timestampToHTML(props);

    case 'image':
      return imageToHTML(props);

    case 'video':
      return videoToHTML(props);

    case 'twitterEmbed':
      return twitterEmbedToHTML(props);

    case 'instagramEmbed':
      return instagramEmbedToHTML(props);

    case 'youtubeEmbed':
      return youtubeEmbedToHTML(props);

    case 'soundCloudEmbed':
      return soundCloudEmbedToHTML(props);

    case 'snapchatEmbed':
      return snapchatEmbedToHTML(props);

    case 'faqEmbed':
      return faqEmbedToHTML(props);

    // Handle standard blocks
    case 'heading': {
      const level = props.level || 1;
      const text = inlineContentToHTML(content);
      return `<h${level}>${text}</h${level}>`;
    }

    case 'paragraph': {
      const text = inlineContentToHTML(content);
      return text ? `<p>${text}</p>` : '<p><br></p>';
    }
    case 'pollEmbed': {
      return inlineContentToHTML(content);
    }

    case 'bulletListItem': {
      const text = inlineContentToHTML(content);
      return `<li>${text}</li>`;
    }

    case 'numberedListItem': {
      const text = inlineContentToHTML(content);
      return `<li>${text}</li>`;
    }

    case 'checkListItem': {
      const text = inlineContentToHTML(content);
      const checked = props.checked || false;
      return `<li style="list-style: none;">
        <input type="checkbox" ${checked ? 'checked' : ''} disabled> ${text}
      </li>`;
    }

    case 'codeBlock': {
      const text = content.map((c) => c.text || '').join('\n');
      const language = props.language || '';
      return `<pre><code class="language-${language}">${text}</code></pre>`;
    }

    case 'quote': {
      const text = inlineContentToHTML(content);
      return `<blockquote>${text}</blockquote>`;
    }

    case 'table': {
      const tableContent = block.content as any;
      if (!tableContent?.rows?.length) return '';
      let html = '<figure class="wp-block-table"><table><tbody>';
      for (const row of tableContent.rows) {
        html += '<tr>';
        for (const cell of row.cells || []) {
          html += `<td>${inlineContentToHTML(cell)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table></figure>';
      return html;
    }

    default:
      // Fallback for unknown block types
      const text = inlineContentToHTML(content);
      return text ? `<div class="block-${type}">${text}</div>` : '';
  }
}

/**
 * Groups consecutive list items and wraps them in ul/ol tags
 */
function groupListItems(blocks: RichBlock[]): string {
  let html = '';
  let currentListType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (currentListType && listItems.length > 0) {
      html += `<${currentListType}>${listItems.join('')}</${currentListType}>`;
      listItems = [];
      currentListType = null;
    }
  };

  blocks.forEach((block) => {
    if (block.type === 'bulletListItem') {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      listItems.push(blockToHTML(block));
    } else if (block.type === 'numberedListItem') {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      listItems.push(blockToHTML(block));
    } else {
      flushList();
      html += blockToHTML(block);
    }
  });

  flushList();
  return html;
}

/**
 * Main function: Converts BlockNote rich blocks to HTML
 */
export function convertBlocksToHTML(blocks: RichBlock[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return '';
  }

  const activeBlocks = blocks.filter((b) => b.status !== 'deleted');

  // For liveblog articles, blocks are stored flat (timestamp followed by its content
  // blocks as siblings). Content blocks carry local order values (0, 1, 2…) relative
  // to their timestamp group, so a global sort by order would cluster all content
  // before the timestamps. Preserve array order when timestamp blocks are present.
  const hasTimestamp = activeBlocks.some((b) => b.type === 'timestamp');
  if (hasTimestamp) {
    return groupListItems(activeBlocks);
  }

  const sortedBlocks = activeBlocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return groupListItems(sortedBlocks);
}

/**
 * Converts timestamp blocks with their following content to live blog entries
 * Returns an array of live blog entries in the format:
 * {
 *   id: number,
 *   time: string,
 *   time_gmt: string,
 *   content: string (HTML),
 *   author: { id, name, slug }
 * }
 */
export function convertBlocksToLiveBlogEntries(
  blocks: RichBlock[],
  page: number = 1,
  limit: number = 5
): any[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return [];
  }

  // Process blocks in original array order.
  // Content blocks within each live entry all carry order:0 (local ordering),
  // so a global sort by order would cluster them before any timestamp blocks.
  const liveEntries: any[] = [];
  let currentEntry: any = null;
  let contentBlocks: RichBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.status === 'deleted') continue;

    if (block.type === 'timestamp') {
      // Save the previous entry if exists
      if (currentEntry && contentBlocks.length > 0) {
        const contentHTML = groupListItems(contentBlocks);
        currentEntry.content = contentHTML;
        liveEntries.push(currentEntry);
        contentBlocks = [];
      }

      // Start a new entry
      const props = block.props || block.metadata?.props || {};
      const timestamp = props.timestamp ? new Date(props.timestamp) : new Date();
      const authorName = props.authorName || '';
      const authorId = props.authorId || '';
      const authorSlug = props.authorSlug || '';

      // Format time in local timezone (IST)
      const timeIST = new Date(timestamp.getTime()).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      });

      // Format time in GMT
      const timeGMT = new Date(timestamp.getTime()).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'GMT',
      });

      // Convert to YYYY-MM-DD HH:mm:ss format
      const formatDateTime = (dateStr: string) => {
        const parts = dateStr.split(', ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1];
        return `${dateParts[2]}-${dateParts[0]}-${dateParts[1]} ${timeParts}`;
      };

      currentEntry = {
        id: timestamp.getTime(), // Use timestamp as ID
        time: formatDateTime(timeIST),
        time_gmt: formatDateTime(timeGMT),
        content: '',
        status: block.status || '',
        author: {
          id: authorId || 0,
          name: authorName || '',
          slug: authorSlug ? authorSlug : '',
        },
      };
    } else if (currentEntry) {
      // Collect content blocks for the current entry
      // Skip empty paragraphs
      if (block.type === 'paragraph' && (!block.content || block.content.length === 0)) {
        continue;
      }
      contentBlocks.push(block);
    }
  }

  // Add the last entry if exists
  if (currentEntry && contentBlocks.length > 0) {
    const contentHTML = groupListItems(contentBlocks);
    currentEntry.content = contentHTML;
    liveEntries.push(currentEntry);
  }

  // Sort entries by timestamp descending (newest first)
  liveEntries.sort((a, b) => b.id - a.id);

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  return liveEntries.slice(startIndex, endIndex);
}
