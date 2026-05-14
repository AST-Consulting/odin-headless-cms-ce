// Import necessary dependencies
import { Client } from '@elastic/elasticsearch';
import 'dotenv/config'; // Load .env variables
const elasticsearchService = new Client({
  node: process.env.ELASTICSEARCH_NODE,
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Define functions to create indices
async function createIndex(indexName, mapping) {
  try {
    const exists = await elasticsearchService.indices.exists({
      index: indexName,
    });
    if (exists) {
      console.log(`Index ${indexName} already exists.`);
      return;
    }

    await elasticsearchService.indices.create({
      index: indexName,
      body: mapping,
    });
    console.log(`Index ${indexName} created successfully.`);
  } catch (error) {
    console.error(`Error creating index ${indexName}:`, error);
  }
}

// Define functions to delete indices
async function deleteIndex(indexName) {
  try {
    const exists = await elasticsearchService.indices.exists({
      index: indexName,
    });
    if (!exists) {
      console.log(`Index ${indexName} does not exist.`);
      return;
    }

    await elasticsearchService.indices.delete({ index: indexName });
    console.log(`Index ${indexName} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting index ${indexName}:`, error);
  }
}

const propertyMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      user: {
        type: 'object',
        properties: {
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          id: { type: 'keyword' },
          email: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      createdAt: {
        type: 'date',
      },
      updatedAt: {
        type: 'date',
      },
      domain: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      credential: {
        type: 'object',
        properties: {
          username: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          password: {
            type: 'text', // Consider security; might want to exclude this from indexing
            index: false,
          },
          _id: { type: 'keyword' },
        },
      },
      status: {
        type: 'keyword',
      },
      platform: {
        type: 'keyword',
      },
      siteSlug: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      articleType: {
        type: 'keyword',
      },
      year: {
        type: 'integer',
      },
      autoKeyword: {
        type: 'boolean',
      },
      isComplete: {
        type: 'boolean',
      },
    },
  },
};

const clientMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      name: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      status: {
        type: 'keyword',
      }, // e.g., pending, active
      category: {
        type: 'text',
      },
      keywords: {
        type: 'text',
      },
      writingStyle: {
        type: 'keyword',
      }, // e.g., Informal
      tone: {
        type: 'keyword',
      }, // e.g., Casual
      expertiseLevel: {
        type: 'keyword',
      }, // e.g., Intermediate
      bio: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      numberOfBlogsPerDay: { type: 'integer' },
      about: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      example: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      language: { type: 'keyword' }, // e.g., English
      propertyId: { type: 'keyword' },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const blogPostMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 1,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      user: {
        type: 'object',
        properties: {
          id: {
            type: 'keyword',
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          email: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      url: {
        type: 'keyword',
      },
      category: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      tags: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      categoryId: {
        type: 'integer',
      },
      tagIds: {
        type: 'integer',
      },
      metaTitle: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      metaDescription: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      ogTitle: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      ogDescription: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      status: { type: 'keyword' },
      imagePrompt: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      imageCaption: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      articlePostId: {
        type: 'long',
      },
      author: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      authorId: {
        type: 'keyword',
      },
      content: {
        type: 'text',
        analyzer: 'standard',
      },
      featured_media: {
        type: 'integer',
      },
      articleType: {
        type: 'keyword',
      },
      year: {
        type: 'integer',
      },
      imageUrl: {
        type: 'keyword',
      },
      excerpt: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      humanizeBlogContent: {
        type: 'text',
        analyzer: 'standard',
      },
      siteSlug: {
        type: 'keyword',
      },
      language: {
        type: 'keyword',
      },
      publish_type: {
        type: 'keyword',
      },
      publishDate: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      generatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      propertyId: {
        type: 'keyword',
      },
    },
  },
};

const searchConsoleMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      userId: {
        type: 'keyword',
      },
      siteUrl: {
        type: 'keyword',
      },
      date: {
        type: 'date',
      },
      country: {
        type: 'keyword',
      },
      device: {
        type: 'keyword',
      },
      query: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      page: {
        type: 'keyword',
      },
      clicks: {
        type: 'integer',
      },
      impressions: {
        type: 'integer',
      },
      ctr: {
        type: 'float',
      },
      position: {
        type: 'float',
      },
      organization: {
        type: 'object',
        properties: {
          name: { type: 'keyword' },
          id: { type: 'keyword' },
        },
      },
    },
  },
};

const categoryMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
      normalizer: {
        lowercase_normalizer: {
          type: 'custom',
          filter: ['lowercase'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: {
        type: 'keyword',
      },
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
          keyword_ci: {
            type: 'keyword',
            ignore_above: 256,
            normalizer: 'lowercase_normalizer',
          },
        },
      },
      titleHn: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      description: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      slug: {
        type: 'keyword', // Exact matching for slug
        fields: {
          keyword_ci: {
            type: 'keyword',
            ignore_above: 256,
            normalizer: 'lowercase_normalizer',
          },
        },
      },
      status: {
        type: 'keyword', // Exact matching for status
      },
      isFeatured: {
        type: 'boolean', // Boolean to indicate if the category is featured
      },
      link: {
        type: 'keyword', // URL stored as keyword for exact matches
      },
      rank: {
        type: 'long', // Integer type for rank
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword',
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword',
          },
          profileId: {
            type: 'keyword',
          },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword',
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword',
          },
          profileId: {
            type: 'keyword',
          },
        },
      },
      seo: {
        type: 'object',
        properties: {
          title: { type: 'text' }, // Full-text search
          metaDescription: { type: 'text' }, // Full-text search
          keywords: { type: 'keyword' }, // Exact matches
          og: {
            type: 'object', // Nested type for querying
            properties: {
              title: { type: 'text' }, // Full-text search
              description: { type: 'text' }, // Full-text search
              url: { type: 'keyword' }, // Exact matches
              image: { type: 'keyword' }, // Exact matches
            },
          },
        },
      },
      createdAt: {
        type: 'date', // Date type for creation date
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date', // Date type for update date
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const faqMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      question: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for FAQ question
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      answer: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for FAQ answers
        search_analyzer: 'standard',
      },
      categories: {
        type: 'nested', // FAQs have an array of categories in MongoDB
        properties: {
          id: {
            type: 'keyword', // Exact match for category ID
          },
          name: {
            type: 'keyword', // Exact match for category name
          },
          displayName: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for display name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'keyword', // Exact match for category slug
          },
        },
      },
      tags: {
        type: 'nested', // Use nested type for array of tags
        properties: {
          id: {
            type: 'keyword', // Exact match for tag ID
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for tag name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'keyword', // Exact match for tag slug
          },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for creator user ID
          },
          userName: {
            type: 'keyword', // Exact match for creator username
          },
          userType: {
            type: 'keyword',
          },
          profileId: {
            type: 'keyword',
          },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for updater user ID
          },
          userName: {
            type: 'keyword', // Exact match for updater username
          },
          userType: {
            type: 'keyword',
          },
          profileId: {
            type: 'keyword',
          },
        },
      },
      status: {
        type: 'keyword', // Exact match for status (e.g., "active")
      },
      rank: {
        type: 'long', // Integer type for rank
      },
      entityType: {
        type: 'text', // Exact match for entity type (e.g., "faq")
      },
      entityId: {
        type: 'keyword', // Exact match for entity ID
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for creation date
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for last update
      },
    },
  },
};

const slugMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: {
        type: 'keyword',
      },
      slug: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for slug values
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      type: {
        type: 'keyword', // Exact match for type (e.g., "admin")
      },
      status: {
        type: 'keyword', // Exact match for status (e.g., "active")
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for creator user ID
          },
          userName: {
            type: 'keyword', // Exact match for creator username
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for updater user ID
          },
          userName: {
            type: 'keyword', // Exact match for updater username
          },
          userType: {
            type: 'keyword', // Exact match for updater user type
          },
          profileId: {
            type: 'keyword', // Exact match for updater profile ID
          },
        },
      },
      seo: {
        type: 'object',
        properties: {
          title: { type: 'text' }, // Full-text search
          metaDescription: { type: 'text' }, // Full-text search
          keywords: { type: 'keyword' }, // Exact matches
          og: {
            type: 'object', // Nested type for querying
            properties: {
              title: { type: 'text' }, // Full-text search
              description: { type: 'text' }, // Full-text search
              url: { type: 'keyword' }, // Exact matches
              image: { type: 'keyword' }, // Exact matches
            },
          },
        },
      },
      fullSlug: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for full slug
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      redirectTo: {
        type: 'keyword', // Exact match for redirect URL
      },
      redirectCode: {
        type: 'keyword', // Exact match for redirect code (e.g., "301", "302")
      },
      canonicalUrl: {
        type: 'keyword', // Exact match for canonical URL
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for creation date
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for last update
      },
    },
  },
};

const menuMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for title
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      id: { type: 'keyword' },
      slug: {
        type: 'keyword', // Exact matching for slug
      },
      rank: {
        type: 'long', // Integer type for rank
      },
      status: {
        type: 'keyword', // Exact matching for status
      },
      items: {
        type: 'nested', // Nested type for menu items
        properties: {
          titles: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for menu item titles
            search_analyzer: 'standard',
          },
          link: {
            type: 'keyword', // Exact match for link
          },
          status: {
            type: 'keyword', // Exact match for status
          },
          subMenuSlug: {
            type: 'keyword', // Exact match for status
          },
          type: {
            type: 'keyword', // Exact match for menu type (same-page or external link)
          },
          textColor: {
            type: 'keyword', // Exact match for text color
          },
          bgColor: {
            type: 'keyword', // Exact match for background color
          },
          rank: {
            type: 'long', // Rank of the item
          },
          _id: {
            type: 'keyword', // Exact match for unique item ID
          },
          object: {
            type: 'keyword', // Exact match for object type (e.g., category, post)
          },
          object_id: {
            type: 'keyword', // Exact match for object ID
          },
          children: {
            // Inline nested children of an item. Stored in _source and returned
            // verbatim on reads. enabled:false skips inverted indexing so we
            // don't have to declare the recursive structure level by level.
            type: 'object',
            enabled: false,
          },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },

      // ⭐ NEW FIELD: property
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact matching for creator user ID
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact matching for updater user ID
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword', // Exact match for updater user type
          },
          profileId: {
            type: 'keyword', // Exact match for updater profile ID
          },
        },
      },
      createdAt: {
        type: 'date', // Date type for created date
        format: 'strict_date_optional_time||epoch_millis', // Storing created date in date format
      },
      updatedAt: {
        type: 'date', // Date type for updated date
        format: 'strict_date_optional_time||epoch_millis', // Storing updated date in date format
      },
    },
  },
};

const tagMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: {
        type: 'keyword',
      },
      name: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for tag name
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      slug: {
        type: 'keyword', // Exact matching for slug
      },
      rank: {
        type: 'long', // Integer type for rank
      },
      status: {
        type: 'keyword', // Exact matching for status
      },
      isFeatured: {
        type: 'boolean', // Boolean to indicate if the tag is featured
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact matching for user ID
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      seo: {
        type: 'object',
        properties: {
          title: { type: 'text' }, // Full-text search
          metaDescription: { type: 'text' }, // Full-text search
          keywords: { type: 'keyword' }, // Exact matches
          og: {
            type: 'object', // Nested type for querying
            properties: {
              title: { type: 'text' }, // Full-text search
              description: { type: 'text' }, // Full-text search
              url: { type: 'keyword' }, // Exact matches
              image: { type: 'keyword' }, // Exact matches
            },
          },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact matching for updated user ID
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      createdAt: {
        type: 'date', // Date type for created date
        format: 'strict_date_optional_time||epoch_millis', // Storing created date in date format
      },
      updatedAt: {
        type: 'date', // Date type for updated date
        format: 'strict_date_optional_time||epoch_millis', // Storing created date in date format
      },
    },
  },
};

const staticPageMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for title
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      slug: {
        type: 'keyword', // Exact matching for slug
      },
      rank: {
        type: 'long', // Integer type for ranking
      },
      status: {
        type: 'keyword', // Exact matching for status
      },
      tags: {
        type: 'nested', // Use nested type for tags
        properties: {
          id: {
            type: 'keyword', // Exact matching for tag ID
          },
          name: {
            type: 'keyword', // Exact matching for category ID
          },
          slug: {
            type: 'keyword', // Exact matching for tag slug
          },
        },
      },
      categories: {
        type: 'nested', // Use nested type for categories
        properties: {
          id: {
            type: 'keyword', // Exact matching for category ID
          },
          name: {
            type: 'keyword', // Exact matching for category ID
          },
          slug: {
            type: 'keyword', // Exact matching for category slug
          },
        },
      },
      content: {
        type: 'text', // Full-text search for article content
        analyzer: 'standard', // Standard analyzer for content
      },
      metaDescription: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for meta description
        search_analyzer: 'standard',
      },
      metaKeywords: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for meta keywords
        search_analyzer: 'standard',
      },
      isPublished: {
        type: 'boolean', // Boolean for published status
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },

      // ⭐ NEW FIELD: property
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact matching for user ID
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact matching for user ID
          },
          userName: {
            type: 'keyword',
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      seo: {
        type: 'object',
        properties: {
          title: { type: 'text' }, // Full-text search
          metaDescription: { type: 'text' }, // Full-text search
          keywords: { type: 'keyword' }, // Exact matches
          og: {
            type: 'object', // Nested type for querying
            properties: {
              title: { type: 'text' }, // Full-text search
              description: { type: 'text' }, // Full-text search
              url: { type: 'keyword' }, // Exact matches
              image: { type: 'keyword' }, // Exact matches
            },
          },
        },
      },
      createdAt: {
        type: 'date', // Date type for created date
        format: 'strict_date_optional_time||epoch_millis', // Storing created date in date format
      },
      updatedAt: {
        type: 'date', // Date type for updated date
        format: 'strict_date_optional_time||epoch_millis', // Storing created date in date format
      },
      // ── WordPress migration fields ─────────────────────────────────────
      wpId: { type: 'long' },
      wpParentId: { type: 'long' },
      wpAuthorId: { type: 'long' },
      wpFeaturedMediaId: { type: 'long' },
      wpLink: { type: 'keyword' },
      wpCreatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      wpModifiedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      excerpt: { type: 'text', analyzer: 'standard' },
      template: { type: 'keyword' },
      menuOrder: { type: 'long' },
      // ──────────────────────────────────────────────────────────────────
    },
  },
};

const pollMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      question: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for poll questions
        search_analyzer: 'standard',
      },
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for poll title
        search_analyzer: 'standard',
      },
      hint: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for poll hints
        search_analyzer: 'standard',
      },
      status: {
        type: 'keyword', // Exact match for status (e.g., "active")
      },
      options: {
        type: 'nested', // Nested structure to handle options array
        properties: {
          text: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for option text
            search_analyzer: 'standard',
          },
          votes: {
            type: 'integer', // Stores vote count as integer
          },
        },
      },
      totalVotes: {
        type: 'integer', // Stores the total number of votes
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for creator user ID
          },
          userName: {
            type: 'keyword', // Exact match for creator username
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for updater user ID
          },
          userName: {
            type: 'keyword', // Exact match for updater username
          },
          userType: {
            type: 'keyword', // Exact match for updater user type
          },
          profileId: {
            type: 'keyword', // Exact match for updater profile ID
          },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for creation timestamp
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for last update timestamp
      },
    },
  },
};

const formMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      name: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for form name
        search_analyzer: 'standard',
      },
      slug: {
        type: 'keyword', // Exact matching for slug
      },
      displayHeadline: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for headline
        search_analyzer: 'standard',
      },
      description: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for description
        search_analyzer: 'standard',
      },
      fields: {
        type: 'nested', // Nested object for fields
        properties: {
          name: { type: 'keyword' },
          type: { type: 'keyword' },
          label: { type: 'text' },
          required: { type: 'boolean' },
          visiblity: { type: 'keyword' },
          rank: { type: 'long' },
        },
      },
      startAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Start date for form
      },
      endAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // End date for form
      },
      createdBy: {
        properties: {
          userId: { type: 'keyword' },
          userName: { type: 'keyword' },
          userType: { type: 'keyword' },
          profileId: { type: 'keyword' },
        },
      },
      updatedBy: {
        properties: {
          userId: { type: 'keyword' },
          userName: { type: 'keyword' },
          userType: { type: 'keyword' },
          profileId: { type: 'keyword' },
        },
      },
      status: {
        type: 'keyword', // Status of the form
      },
      responseCount: {
        type: 'integer', // Number of responses
      },
      media: {
        type: 'nested', // Array of media objects
        properties: {
          fileName: { type: 'keyword' },
          path: { type: 'text' },
          id: { type: 'keyword' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Created timestamp
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Updated timestamp
      },
    },
  },
};

const bannerMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for title
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      slug: {
        type: 'keyword',
      },
      bannerType: {
        properties: {
          id: {
            type: 'keyword', // Exact match for banner type ID
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for banner name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for banner slug
            search_analyzer: 'standard',
          },
        },
      },
      banners: {
        type: 'nested',
        properties: {
          title: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          ctaText: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          appLink: {
            type: 'keyword',
            null_value: '',
          },
          apiLink: {
            type: 'keyword',
            null_value: '',
          },
          webLink: {
            type: 'keyword',
            null_value: '',
          },
          image: {
            type: 'nested',
            properties: {
              id: { type: 'keyword' },
              path: { type: 'keyword' },
              fileName: {
                type: 'text',
                analyzer: 'ngram_analyzer',
                search_analyzer: 'standard',
              },
            },
          },
          description: {
            type: 'text',
            analyzer: 'standard',
          },
          openIn: {
            type: 'keyword',
          },
          runsOn: {
            type: 'keyword',
          },
          rank: {
            type: 'long',
          },
          startDate: {
            type: 'date',
            format: 'strict_date_optional_time||epoch_millis',
          },
          endDate: {
            type: 'date',
            format: 'strict_date_optional_time||epoch_millis',
          },
          status: {
            type: 'keyword',
          },
        },
      },
      description: {
        type: 'text', // HTML content as plain text
      },
      categories: {
        type: 'nested', // Structured category data
        properties: {
          id: {
            type: 'keyword', // Exact match for category ID
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for category name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'keyword', // Exact match for category slug
          },
        },
      },
      tags: {
        type: 'nested', // Structured tag data
        properties: {
          id: {
            type: 'keyword', // Exact match for tag ID
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for tag name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'keyword', // Exact match for tag slug
          },
        },
      },
      rank: {
        type: 'long', // Integer value for rank
      },
      startDate: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for startDate
      },
      endDate: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for endDate
      },
      status: {
        type: 'keyword', // Exact match for status (e.g., "active")
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for creator user ID
          },
          userName: {
            type: 'keyword', // Exact match for creator username
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for updater user ID
          },
          userName: {
            type: 'keyword', // Exact match for updater username
          },
          userType: {
            type: 'keyword', // Exact match for updater user type
          },
          profileId: {
            type: 'keyword', // Exact match for updater profile ID
          },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      // ⭐ NEW FIELD: property
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for createdAt
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for updatedAt
      },
    },
  },
};

const bannerTypeMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      name: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for name
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      slug: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for slug
        search_analyzer: 'standard',
      },
      entity: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for entity field
        search_analyzer: 'standard',
      },
      status: {
        type: 'keyword', // Exact match for status (e.g., "deleted")
      },
      createdBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for creator user ID
          },
          userName: {
            type: 'keyword', // Exact match for creator username
          },
          userType: {
            type: 'keyword', // Exact match for creator user type
          },
          profileId: {
            type: 'keyword', // Exact match for creator profile ID
          },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },

      // ⭐ NEW FIELD: property
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      updatedBy: {
        properties: {
          userId: {
            type: 'keyword', // Exact match for updater user ID
          },
          userName: {
            type: 'keyword', // Exact match for updater username
          },
          userType: {
            type: 'keyword', // Exact match for updater user type
          },
          profileId: {
            type: 'keyword', // Exact match for updater profile ID
          },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for createdAt
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Date format for updatedAt
      },
    },
  },
};

const formResponseMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      formId: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for form name
        search_analyzer: 'standard',
      },
      formName: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for form name
        search_analyzer: 'standard',
      },
      formSlug: {
        type: 'keyword', // Exact matching for slug
      },
      userId: {
        type: 'text',
        analyzer: 'ngram_analyzer', // Fuzzy search for headline
        search_analyzer: 'standard',
      },
      submitted_at: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Start date for form
      },
      fields: {
        type: 'nested', // Nested object for fields
        properties: {
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for description
            search_analyzer: 'standard',
          },
          type: { type: 'keyword' },
          value: { type: 'text' },
          isVerfied: { type: 'boolean' },
        },
      },
      createdBy: {
        properties: {
          userId: { type: 'keyword' },
          userName: { type: 'keyword' },
          userType: { type: 'keyword' },
          profileId: { type: 'keyword' },
        },
      },
      updatedBy: {
        properties: {
          userId: { type: 'keyword' },
          userName: { type: 'keyword' },
          userType: { type: 'keyword' },
          profileId: { type: 'keyword' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Created timestamp
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis', // Updated timestamp
      },
    },
  },
};

const searchConsoleMapping1 = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      userId: {
        type: 'keyword',
      },
      siteUrl: {
        type: 'keyword',
      },
      date: {
        type: 'date',
      },
      country: {
        type: 'keyword',
      },
      device: {
        type: 'keyword',
      },
      query: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      page: {
        type: 'keyword',
      },
      clicks: {
        type: 'integer',
      },
      impressions: {
        type: 'integer',
      },
      ctr: {
        type: 'float',
      },
      position: {
        type: 'float',
      },
      organization: {
        type: 'object',
        properties: {
          name: { type: 'keyword' },
          id: { type: 'keyword' },
        },
      },
    },
  },
};

const keywordMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      keyword: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          raw: {
            type: 'keyword',
          },
        },
      },
      intent: {
        type: 'keyword',
      },
      contentType: {
        type: 'keyword',
      },
      volume: {
        type: 'integer',
      },
      difficulty: {
        type: 'keyword',
      },
      cpc: {
        type: 'float',
      },
      competition: {
        type: 'keyword',
      },
      serp: {
        type: 'keyword',
      },
      category: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          raw: {
            type: 'keyword',
          },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const googleAnalyticsMapping = {
  settings: {
    number_of_shards: 3,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        url_analyzer: {
          type: 'custom',
          tokenizer: 'url_tokenizer',
          filter: ['lowercase'],
        },
      },
      tokenizer: {
        url_tokenizer: {
          type: 'path_hierarchy',
          delimiter: '/',
        },
      },
    },
  },
  mappings: {
    properties: {
      userId: { type: 'keyword' },
      propertyId: { type: 'keyword' },
      propertyName: { type: 'keyword' },
      accountId: { type: 'keyword' },
      accountName: { type: 'keyword' },
      date: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      dataType: { type: 'keyword' },
      uniqueHash: { type: 'keyword' },
      dimensions: {
        properties: {
          deviceCategory: { type: 'keyword' },
          sessionSource: { type: 'keyword' },
          sessionMedium: { type: 'keyword' },
          campaignName: { type: 'keyword' },
          pagePath: {
            type: 'text',
            analyzer: 'url_analyzer',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          pageTitle: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword' },
            },
          },
          eventName: { type: 'keyword' },
          country: { type: 'keyword' },
          city: { type: 'keyword' },
          browser: { type: 'keyword' },
          operatingSystem: { type: 'keyword' },
        },
      },
      metrics: {
        properties: {
          // User metrics
          totalUsers: { type: 'long' },
          newUsers: { type: 'long' },
          activeUsers: { type: 'long' },
          sessions: { type: 'long' },
          engagedSessions: { type: 'long' },

          // Traffic metrics
          trafficSessions: { type: 'long' },
          trafficEngagedSessions: { type: 'long' },

          // Page metrics
          screenPageViews: { type: 'long' },
          userEngagementDuration: { type: 'float' },
          engagementRate: { type: 'float' },

          // Event metrics
          eventCount: { type: 'long' },
          eventValue: { type: 'float' },

          // Geo metrics
          geoSessions: { type: 'long' },
          geoUsers: { type: 'long' },

          // Tech metrics
          techSessions: { type: 'long' },
          techUsers: { type: 'long' },
        },
      },
      // Metadata
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      organization: {
        type: 'object',
        properties: {
          name: { type: 'keyword' },
          id: { type: 'keyword' },
        },
      },
    },
  },
};

const articleMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: {
        type: 'keyword',
      },
      user: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          email: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      type: { type: 'keyword' }, // article, liveblog, explainer, photo_story, video, opinion, post
      status: { type: 'keyword' }, // draft, review, scheduled, published, archived
      lang: { type: 'keyword' },
      slug: { type: 'keyword' },
      canonicalUrl: { type: 'keyword' },
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      dek: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      body: {
        type: 'text',
        analyzer: 'standard',
      },
      richBlocks: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          type: { type: 'keyword' }, // paragraph, heading, list, image, video, etc.
          content: {
            type: 'nested',
            properties: {
              type: { type: 'keyword' }, // text, image, video, etc.
              text: {
                type: 'text',
                analyzer: 'standard',
              },
            },
          },
          metadata: { type: 'object', enabled: false }, // Variable structure, so disabled indexing
          order: { type: 'integer' },
        },
      },
      images: {
        type: 'nested',
        properties: {
          url: { type: 'keyword' },
          caption: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          alt: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          credit: { type: 'text' },
        },
      },
      videos: {
        type: 'nested',
        properties: {
          url: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          description: { type: 'text' },
          thumbnail: { type: 'keyword' },
        },
      },
      authors: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          slug: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          email: { type: 'keyword' },
          bio: { type: 'text' },
        },
      },
      beats: { type: 'keyword' },
      geo: { type: 'keyword' },
      entities: {
        type: 'nested',
        properties: {
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          type: { type: 'keyword' },
          relevance: { type: 'float' },
        },
      },
      channels: {
        type: 'object',
        properties: {
          web: { type: 'boolean' },
          mobile: { type: 'boolean' },
          amp: { type: 'boolean' },
        },
      },
      seo: {
        type: 'object',
        properties: {
          metaTitle: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          metaDescription: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          keywords: { type: 'keyword' },
          canonicalUrl: { type: 'keyword' },
        },
      },
      discoverHealth: {
        type: 'object',
        properties: {
          score: { type: 'float' },
          issues: { type: 'keyword' },
        },
      },
      counters: {
        type: 'object',
        properties: {
          views: { type: 'long' },
          shares: { type: 'long' },
          comments: { type: 'long' },
          likes: { type: 'long' },
        },
      },
      metricsLatest: {
        type: 'object',
        properties: {
          pageViews: { type: 'long' },
          uniqueVisitors: { type: 'long' },
          avgTimeOnPage: { type: 'float' },
        },
      },
      embeddings: {
        type: 'object',
        properties: {
          vector: { type: 'dense_vector', dims: 768 },
          model: { type: 'keyword' },
        },
      },
      categories: {
        type: 'nested', // Structured category data
        properties: {
          id: {
            type: 'keyword', // Exact match for category ID
          },
          title: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for category title
            search_analyzer: 'standard',
          },
          slug: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      tags: {
        type: 'nested', // Structured tag data
        properties: {
          id: {
            type: 'keyword', // Exact match for tag ID
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for tag name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      publishedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      embargoAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      scheduledAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      currentVersion: { type: 'integer' },
      revisionsLite: {
        type: 'nested',
        properties: {
          version: { type: 'integer' },
          timestamp: { type: 'date' },
          author: { type: 'keyword' },
          changes: { type: 'text' },
        },
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },

      // ⭐ NEW FIELD: property
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      moderation: {
        type: 'object',
        properties: {
          status: { type: 'keyword' },
          notes: { type: 'text' },
          moderatedBy: { type: 'keyword' },
          moderatedAt: { type: 'date' },
        },
      },
      softDeleted: { type: 'boolean' },
      articlePostId: { type: 'long' },
      primaryCategory: {
        type: 'object',
        properties: {
          id: {
            type: 'keyword', // Exact match for category ID
          },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer', // Fuzzy search for category name
            search_analyzer: 'standard',
          },
          slug: {
            type: 'keyword', // Exact match for category slug
          },
        },
      },
      metaTitle: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      metaDescription: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      ogTitle: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      ogDescription: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      excerpt: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      keyword: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      propertyId: { type: 'keyword' },
      featured_media: { type: 'integer' },
      featuredMedia: {
        type: 'object',
        properties: {
          path: { type: 'keyword' },
          id: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      featuredVideo: {
        type: 'object',
        properties: {
          path: { type: 'keyword' },
          id: { type: 'keyword' },
          url: { type: 'keyword' },
          alt: { type: 'keyword' },
          caption: { type: 'text' },
        },
      },
      wpCategoryIds: { type: 'integer' },
      wpTagIds: { type: 'integer' },
      wpPostId: { type: 'long' },
      createdBy: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          email: { type: 'keyword' },
        },
      },
      updatedBy: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          email: { type: 'keyword' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const mediaMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      fileName: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          text: {
            type: 'text',
            analyzer: 'standard',
          },
        },
      },
      mimeType: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
        },
      },
      size: { type: 'long' },
      url: { type: 'keyword' },
      source_url: { type: 'keyword' },
      source: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      caption: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          text: {
            type: 'text',
            analyzer: 'standard',
          },
        },
      },
      alt_text: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          text: {
            type: 'text',
            analyzer: 'standard',
          },
        },
      },
      path: { type: 'keyword' },
      folderPath: { type: 'keyword' },
      isPrivate: { type: 'boolean' },
      type: { type: 'keyword' },
      wpId: { type: 'long' },
      postId: { type: 'long' },
      featured_media: { type: 'long' },
      orientation: { type: 'keyword' },
      media_details: {
        type: 'object',
        enabled: false,
      },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdBy: {
        type: 'object',
        properties: {
          userId: { type: 'keyword' },
          userName: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          slug: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      updatedBy: {
        type: 'object',
        properties: {
          userId: { type: 'keyword' },
          userName: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const testimonialMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      testimonialText: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      authorName: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      authorDesignation: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      authorCompany: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      status: { type: 'keyword' },
      rating: { type: 'float' },
      date: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      media: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          fileName: { type: 'text' },
          path: { type: 'keyword' },
        },
      },
      slug: { type: 'keyword' },
      rank: { type: 'integer' },
      isFeatured: { type: 'boolean' },
      videoURL: { type: 'keyword' },
      organization: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const sectionMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
    },
  },
  mappings: {
    properties: {
      title: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      titleHindi: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      description: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      slug: { type: 'keyword' },
      status: { type: 'keyword' },
      link: { type: 'keyword' },
      displayType: { type: 'keyword' },
      contentType: { type: 'keyword' },
      rank: { type: 'integer' },
      startDate: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      endDate: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      category: { type: 'keyword' },
      sectionUrls: { type: 'keyword' },
      contentPriority: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          title: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          slug: { type: 'keyword' },
          contentRank: { type: 'integer' },
          contentType: { type: 'keyword' },
          url: { type: 'keyword' },
        },
      },
      seo: {
        type: 'object',
        properties: {
          metaTitle: { type: 'text' },
          metaDescription: { type: 'text' },
          canonicalUrl: { type: 'keyword' },
        },
      },
      organization: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      property: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: {
            type: 'text',
            analyzer: 'ngram_analyzer',
            search_analyzer: 'standard',
          },
          domain: { type: 'keyword' },
        },
      },
      createdBy: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: { type: 'text' },
        },
      },
      updatedBy: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: { type: 'text' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

const userMapping = {
  settings: {
    analysis: {
      filter: {
        ngram_filter: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
        },
      },
      analyzer: {
        ngram_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'ngram_filter'],
        },
      },
      normalizer: {
        lowercase_normalizer: {
          type: 'custom',
          filter: ['lowercase'],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256,
          },
          keyword_ci: {
            type: 'keyword',
            ignore_above: 256,
            normalizer: 'lowercase_normalizer',
          },
        },
      },
      alt_name: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      email: {
        type: 'text',
        analyzer: 'standard', // 🔥 IMPORTANT CHANGE
        fields: {
          autocomplete: {
            type: 'text',
            analyzer: 'ngram_analyzer', // for search typing
            search_analyzer: 'standard',
          },
          keyword: {
            type: 'keyword', // 🔥 for exact match
          },
        },
      },
     phone: {
  properties: {
    countryCode: { type: 'keyword' },
    number: { type: 'keyword' },

    fullNumber: { type: 'keyword' }, // ✅ keep as-is (UI safe)

    search: {
      type: 'text',
      analyzer: 'ngram_analyzer',
      search_analyzer: 'standard',
    },
  },
},
      userType: { type: 'keyword' },
      roles: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
        },
      },
      permissions: {
        type: 'nested',
        properties: {
          module: { type: 'keyword' },
          actions: { type: 'keyword' },
        },
      },
      description: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      slug: {
        type: 'keyword',
        fields: {
          keyword_ci: {
            type: 'keyword',
            ignore_above: 256,
            normalizer: 'lowercase_normalizer',
          },
        },
      },
      username: { type: 'keyword' },
      verified: { type: 'boolean' },
      isVerified: { type: 'boolean' },
      isCompleted: { type: 'boolean' },
      hasCompletedOnboarding: { type: 'boolean' },
      generateNewPw: { type: 'boolean' },
      designation: {
        type: 'text',
        analyzer: 'ngram_analyzer',
        search_analyzer: 'standard',
      },
      industry: { type: 'keyword' },
      wpId: { type: 'integer' },
      header: { type: 'text', analyzer: 'ngram_analyzer' },
      socialLinks: {
        type: 'object',
        properties: {
          twitter: { type: 'keyword' },
          facebook: { type: 'keyword' },
          linkedin: { type: 'keyword' },
          instagram: { type: 'keyword' },
        },
      },
      timezone: {
        type: 'object',
        properties: {
          name: { type: 'keyword' },
          country_or_territory: { type: 'keyword' },
          utc_time_offset: { type: 'keyword' },
        },
      },
      organization: {
        type: 'object',
        properties: {
          id: { type: 'keyword' },
          name: { type: 'text', analyzer: 'ngram_analyzer' },
          slug: { type: 'keyword' },
          domain: { type: 'keyword' },
        },
      },
      properties: {
        type: 'nested',
        properties: {
          id: { type: 'keyword' },
          name: { type: 'keyword' },
          domain: { type: 'keyword' },
          status: { type: 'keyword' },
          roles: {
            type: 'nested',
            properties: {
              id: { type: 'keyword' },
              name: { type: 'keyword' },
            },
          },
          permissions: {
            type: 'nested',
            properties: {
              module: { type: 'keyword' },
              actions: { type: 'keyword' },
            },
          },
        },
      },
      createdBy: {
        type: 'object',
        properties: {
          userId: { type: 'keyword' },
          userName: { type: 'text' },
        },
      },
      updatedBy: {
        type: 'object',
        properties: {
          userId: { type: 'keyword' },
          userName: { type: 'text' },
        },
      },
      createdAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
      updatedAt: {
        type: 'date',
        format: 'strict_date_optional_time||epoch_millis',
      },
    },
  },
};

// Main function to execute index operations
async function manageIndices(action, indices = []) {
  // Define all possible indices and their mappings
  const allIndices = {
    property: propertyMapping,
    client: clientMapping,
    blogpost: blogPostMapping,
    searchconsole: searchConsoleMapping,
    searchconsole1: searchConsoleMapping1,
    category: categoryMapping,
    keyword: keywordMapping,
    'static-page': staticPageMapping,
    tag: tagMapping,
    menu: menuMapping,
    faq: faqMapping,
    slug: slugMapping,
    testimonial: testimonialMapping,
    poll: pollMapping,
    banner: bannerMapping,
    'banner-type': bannerTypeMapping,
    'google-analytics': googleAnalyticsMapping,
    form: formMapping,
    'form-response': formResponseMapping,
    article: articleMapping,
    media: mediaMapping,
    section: sectionMapping,
    user: userMapping,
  };

  // Optional env-driven suffix so the same config can target per-env indices
  // (e.g. `property-dev`, `property-staging`). Empty suffix = legacy behavior.
  const suffix = process.env.ELASTICSEARCH_INDEX_SUFFIX || '';
  const applySuffix = (base) => (suffix ? `${base}${suffix}` : base);

  // Determine which indices to process: all or only specified ones
  const indicesToProcess = indices.length > 0 ? indices : Object.keys(allIndices);

  if (action === 'create') {
    for (const index of indicesToProcess) {
      if (allIndices[index]) {
        await createIndex(applySuffix(index), allIndices[index]);
      } else {
        console.log(`Index "${index}" does not exist in the configuration.`);
      }
    }
  } else if (action === 'delete') {
    for (const index of indicesToProcess) {
      if (allIndices[index]) {
        await deleteIndex(applySuffix(index));
      } else {
        console.log(`Index "${index}" does not exist in the configuration.`);
      }
    }
  } else {
    console.log("Invalid action. Use 'create' or 'delete'.");
  }
}

// Run the script with the specified action
const action = process.argv[2]; // Pass 'create' or 'delete' as a command-line argument
const indices = process.argv.slice(3);
// eslint-disable-next-line promise/catch-or-return
manageIndices(action, indices).then(() => process.exit());

// to run the script, use the following command:
/// to create the indices
// node src/core/elastic/manageIndices.mjs create
/// to delete the indices
// node src/core/elastic/manageIndices.mjs delete
