import { SeoDto } from '../dto/seo.dto';

interface IOg {
  title: string;
  description: string;
  url: string;
  image: string;
}

export interface ISeo {
  title: string;
  metaDescription: string;
  keywords?: string[];
  og: IOg;
}

// Function to build the SEO object with fallbacks
export function buildSeoObject(
  seo: SeoDto | null | undefined,
  defaultTitle: string,
  content: string,
  image?: string
): ISeo {
  // Destructure values from the SeoDto input, providing default values if seo is not provided
  const {
    title = '',
    metaDescription = '',
    keywords = [],
    og: ogObj = {
      title: defaultTitle,
      description: content,
      image: image ? image : '',
      url: image ? image : '',
    },
  } = seo || {};

  // Destructure values from the optional og object in SeoDto, providing default values if ogObj is not provided
  const {
    title: ogTitle = '',
    description: ogDescription = '',
    image: ogImage = '',
    url: ogUrl = '',
  } = ogObj;

  // Use defaultTitle and content as fallbacks for title and metaDescription if not provided
  const finalTitle =
    title || defaultTitle || (content ? content.split(' ').slice(0, 10).join(' ') : '') || 'Default Title';
  const finalMetaDescription =
    metaDescription || (content ? content.substring(0, 150) : '') || 'Default description';

  // Final URL and image fallbacks
  const finalUrl = ogUrl || null; // Fallback to a default URL if not provided
  const finalImage = ogImage || image || null; // Fallback to provided image or a default image URL

  // Construct the OG object using provided values or fallbacks
  const og: IOg = {
    title: ogTitle || finalTitle, // OG title falls back to finalTitle
    description: ogDescription || finalMetaDescription, // OG description falls back to finalMetaDescription
    url: finalUrl,
    image: finalImage,
  };

  // Return the constructed SEO object
  return {
    title: finalTitle,
    metaDescription: finalMetaDescription,
    keywords,
    og,
  };
}
