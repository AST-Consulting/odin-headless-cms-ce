import { Client } from '@elastic/elasticsearch';
import 'dotenv/config'; // Load .env variables
import { MongoClient } from 'mongodb';

// MongoDB connection details
// Support both DATABASE_URL (server) and MONGODB_URI (local)
const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI;

// Extract database name from connection string or use MONGODB_DATABASE
let mongoDbName = process.env.MONGODB_DATABASE;

// If database name not provided, extract from connection string
if (!mongoDbName && mongoUri) {
  // Extract database name from URL like: mongodb://user:pass@host:port/dbname?options
  const dbMatch = mongoUri.match(/\/([^/?]+)(\?|$)/);
  if (dbMatch && dbMatch[1]) {
    mongoDbName = dbMatch[1];
  }
}

if (!mongoUri) {
  console.error('❌ Error: No MongoDB connection string found!');
  console.error('   Please set DATABASE_URL or MONGODB_URI in your .env file');
  process.exit(1);
}

if (!mongoDbName) {
  console.error('❌ Error: Could not determine database name!');
  console.error('   Please set MONGODB_DATABASE in your .env file');
  process.exit(1);
}

// Elasticsearch connection with authentication
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

// Optional env-driven suffix so the same config can target per-env indices
// (e.g. `property-dev`, `article-dev`). Empty suffix = legacy behavior.
const INDEX_SUFFIX = process.env.ELASTICSEARCH_INDEX_SUFFIX || '';
const withSuffix = (base) => (INDEX_SUFFIX ? `${base}${INDEX_SUFFIX}` : base);

// Map MongoDB collections to corresponding Elasticsearch indices
const collectionIndexMap = {
  properties: withSuffix('property'),
  clients: withSuffix('client'),
  blogposts: withSuffix('blogpost'),
  keywords: withSuffix('keyword'),
  categories: withSuffix('category'),
  users: withSuffix('user'),
  tags: withSuffix('tag'),
  faqs: withSuffix('faq'),
  menus: withSuffix('menu'),
  slugs: withSuffix('slug'),
  blogs: withSuffix('blog'),
  banners: withSuffix('banner'),
  bannertypes: withSuffix('banner-type'),
  sections: withSuffix('section'),
  roles: withSuffix('role'),
  articles: withSuffix('article'),
  media: withSuffix('media'),
  staticpages: withSuffix('static-page'),
  testimonials: withSuffix('testimonial'),
};

const BATCH_SIZE = 500; // Reduced from 5000 to avoid ES payload size limits with large docs

// Parse --since=YYYY-MM-DD or --since=YYYY-MM-DDTHH:MM:SS argument for incremental sync
const allArgs = process.argv.slice(2);
const sinceArg = allArgs.find((arg) => arg.startsWith('--since='));
const sinceDateRaw = sinceArg ? sinceArg.split('=')[1] : null;
const sinceDate = sinceDateRaw ? new Date(sinceDateRaw) : null;
if (sinceDate && isNaN(sinceDate.getTime())) {
  console.error(
    `❌ Invalid --since value: "${sinceDateRaw}". Use YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS format.`
  );
  process.exit(1);
}

// Parse --limit=N argument — cap per-collection sync to the N newest docs
// (by updatedAt desc, falling back to _id). Useful for quick smoke tests.
const limitArg = allArgs.find((arg) => arg.startsWith('--limit='));
const limitRaw = limitArg ? limitArg.split('=')[1] : null;
const limitNum = limitRaw ? parseInt(limitRaw, 10) : null;
if (limitRaw !== null && (!Number.isFinite(limitNum) || limitNum <= 0)) {
  console.error(`❌ Invalid --limit value: "${limitRaw}". Must be a positive integer.`);
  process.exit(1);
}

// Helper function to format time duration
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s ${ms % 1000}ms`;
  }
}

// Function to update data in batches
async function bulkUpdateCollections(selectedIndices = []) {
  const mongoClient = new MongoClient(mongoUri);
  const scriptStartTime = Date.now();

  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    const db = mongoClient.db(mongoDbName);

    // Filter collectionIndexMap based on selectedIndices
    const indicesToProcess =
      selectedIndices.length > 0
        ? Object.entries(collectionIndexMap).filter(([_, esIndex]) =>
            selectedIndices.includes(esIndex)
          )
        : Object.entries(collectionIndexMap);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      sinceDate
        ? '🔄 INCREMENTAL SYNC (new/updated docs only)'
        : '🚀 FULL SYNC — MONGODB TO ELASTICSEARCH'
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Processing ${indicesToProcess.length} collection(s)`);
    console.log(`📦 Batch Size: ${BATCH_SIZE}`);
    if (sinceDate) {
      console.log(`📅 Syncing documents updated on or after: ${sinceDate.toISOString()}`);
    }
    if (limitNum) {
      console.log(`🔢 Limit: ${limitNum} newest doc(s) per collection`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Iterate over each filtered MongoDB collection and its corresponding Elasticsearch index
    for (const [collectionName, esIndex] of indicesToProcess) {
      const collection = db.collection(collectionName);
      console.log(`\n📂 Collection: ${collectionName} → Index: ${esIndex}`);

      const collectionStartTime = Date.now();
      if (collectionName === 'media') {
        console.log('🚀 Phase 1: Syncing Videos first...');
        await bulkUpdateInBatches(collection, esIndex, { mimeType: { $regex: /^video/ } });
        console.log('🚀 Phase 2: Syncing the rest of the media...');
        await bulkUpdateInBatches(collection, esIndex, { mimeType: { $not: { $regex: /^video/ } } });
      } else {
        await bulkUpdateInBatches(collection, esIndex);
      }
      const collectionEndTime = Date.now();
      const collectionDuration = collectionEndTime - collectionStartTime;

      console.log(`⏱️  Collection completed in: ${formatDuration(collectionDuration)}`);
      console.log('─'.repeat(60));
    }

    const scriptEndTime = Date.now();
    const totalDuration = scriptEndTime - scriptStartTime;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SYNC COMPLETED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⏱️  Total Time: ${formatDuration(totalDuration)}`);
    console.log(`📅 Finished at: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error during bulk update:', error);
  } finally {
    await mongoClient.close();
  }
}

// Function to handle bulk update in batches
async function bulkUpdateInBatches(collection, esIndex, additionalQuery = {}) {
  const baseQuery = { status: { $ne: 'deleted' }, ...additionalQuery };

  // Build the list of passes.
  // Previously we used `$or: [{updatedAt: {$gte}}, {createdAt: {$gte}}]` in a single query,
  // but `$or` across two un-indexed date fields cannot use a per-field index — the planner
  // fell back to the `status_1` index and scanned the full non-deleted collection (~2.4M docs).
  // Split into two single-field passes so each can use its own index (updatedAt/createdAt).
  // Pass 2 excludes docs already covered by pass 1 to avoid redundant ES writes.
  const passes = [];
  if (sinceDate) {
    passes.push({
      label: 'updatedAt',
      query: { ...baseQuery, updatedAt: { $gte: sinceDate } },
    });
    passes.push({
      label: 'createdAt',
      query: {
        ...baseQuery,
        createdAt: { $gte: sinceDate },
        // Exclude docs matched by pass 1 — also catches docs missing updatedAt.
        updatedAt: { $not: { $gte: sinceDate } },
      },
    });
  } else {
    passes.push({ label: 'full', query: baseQuery });
  }

  let batch = [];
  let count = 0;
  let batchNumber = 0;

  const startTime = Date.now();
  let lastBatchTime = startTime;

  console.log(`  🔍 Querying MongoDB collection: ${collection.collectionName}...`);

  for (const pass of passes) {
    if (sinceDate) {
      console.log(`  ▶ Pass: ${pass.label} >= ${sinceDate.toISOString()}`);
    }

    let cursor = collection.find(pass.query);
    if (limitNum) {
      // When --limit is set, pull the newest docs first so "N latest" is meaningful.
      // `_id` is a secondary sort so docs missing `updatedAt` still get a stable order.
      cursor = cursor.sort({ updatedAt: -1, _id: -1 }).limit(limitNum);
    }

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const { _id, password, refreshToken, ...rest } = doc;

      const documentToSync = { ...rest, id: _id.toString() };

      // Calculate orientation for media index
      if (esIndex === 'media') {
        const w = doc.media_details?.width;
        const h = doc.media_details?.height;
        if (w && h) {
          if (w > h) documentToSync.orientation = 'landscape';
          else if (h > w) documentToSync.orientation = 'portrait';
          else documentToSync.orientation = 'square';
        } else {
          documentToSync.orientation = 'landscape'; // Default fallback
        }
      }

      // Prepare bulk update operation
      batch.push(
        { update: { _index: esIndex, _id: _id.toString() } }, // Update command
        { doc: documentToSync, doc_as_upsert: true } // Document with upsert behavior
      );

      count++;

      if (count % 100 === 0) {
        process.stdout.write(`\r  ⌛ Processing document #${count}...`);
      }

      // Once batch size reaches BATCH_SIZE, send bulk update
      if (batch.length >= BATCH_SIZE * 2) {
        batchNumber++;
        const batchStartTime = Date.now();
        const timeSinceLastBatch = batchStartTime - lastBatchTime;

        await sendBulkUpdate(batch, collection.collectionName);

        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;

        console.log(
          `  Batch #${batchNumber}: ${BATCH_SIZE} docs | Total: ${count} | ` +
            `ES: ${batchDuration}ms | Gap: ${timeSinceLastBatch}ms`
        );

        batch = []; // Reset batch after sending
        lastBatchTime = batchEndTime;
      }
    }
  }

  // Send remaining documents in the last batch (if any)
  if (batch.length > 0) {
    batchNumber++;
    const batchStartTime = Date.now();
    const timeSinceLastBatch = batchStartTime - lastBatchTime;
    const docsInBatch = batch.length / 2; // Each doc has 2 entries in batch array

    await sendBulkUpdate(batch, collection.collectionName);

    const batchEndTime = Date.now();
    const batchDuration = batchEndTime - batchStartTime;

    console.log(
      `  Batch #${batchNumber}: ${docsInBatch} docs | Total: ${count} | ` +
        `ES: ${batchDuration}ms | Gap: ${timeSinceLastBatch}ms`
    );
  }

  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  const avgTimePerDoc = count > 0 ? (totalDuration / count).toFixed(2) : 0;
  const docsPerSecond = count > 0 ? ((count / totalDuration) * 1000).toFixed(2) : 0;

  console.log(`\n  📊 Collection Statistics:`);
  console.log(`     Total Documents: ${count.toLocaleString()}`);
  console.log(`     Total Batches: ${batchNumber}`);
  console.log(`     Total Time: ${formatDuration(totalDuration)}`);
  console.log(`     Avg Time/Doc: ${avgTimePerDoc}ms`);
  console.log(`     Throughput: ${docsPerSecond} docs/sec`);
}

// Function to send bulk update to Elasticsearch
async function sendBulkUpdate(batch, collectionName) {
  try {
    const bulkResponse = await elasticsearchService.bulk({
      operations: batch,
    });

    if (bulkResponse.errors) {
      const erroredDocuments = bulkResponse.items.filter(
        (item) => item.update && item.update.error
      );
      console.error(`     ⚠️  Errors in bulk update (${erroredDocuments.length} docs)`);

      // Log first 3 errors only to avoid spam
      erroredDocuments.slice(0, 3).forEach((errorDoc, index) => {
        console.error(`     Error ${index + 1}:`, {
          id: errorDoc.update._id,
          status: errorDoc.update.status,
          error: errorDoc.update.error.type,
        });
      });
      if (erroredDocuments.length > 3) {
        console.error(`     ... and ${erroredDocuments.length - 3} more errors`);
      }
    }
  } catch (error) {
    console.error(
      `     ❌ Error during bulk update:`,
      error.message || error.meta?.body?.error || error
    );
  }
}

// Syncs live articles (liveblog / liveblog) to the 'article' ES index.
// For each article, richBlocks are fetched from the article_rich_blocks
// collection and merged before indexing — they are NOT stored in the
// article document itself.
async function bulkUpdateLiveArticles(db) {
  const articlesCol = db.collection('articles');
  const richBlocksCol = db.collection('article_rich_blocks');

  const liveTypeFilter = { type: { $in: ['liveblog', 'live_blog'] } };

  // Split incremental sync into two single-field passes so each can use its own index
  // (updatedAt/createdAt). `$or` across both fields forced a status_1 COLLSCAN on ~2.4M docs.
  const passes = [];
  if (sinceDate) {
    passes.push({
      label: 'updatedAt',
      query: { ...liveTypeFilter, updatedAt: { $gte: sinceDate } },
    });
    passes.push({
      label: 'createdAt',
      query: {
        ...liveTypeFilter,
        createdAt: { $gte: sinceDate },
        updatedAt: { $not: { $gte: sinceDate } },
      },
    });
  } else {
    passes.push({ label: 'full', query: liveTypeFilter });
  }

  let batch = [];
  let count = 0;
  let batchNumber = 0;
  const startTime = Date.now();
  let lastBatchTime = startTime;

  const flushBatch = async () => {
    if (batch.length === 0) return;

    // Fetch all richblocks for this batch of articles in one query
    const articleIds = batch.map((doc) => doc._id.toString());
    const blocks = await richBlocksCol
      .find({ articleId: { $in: articleIds }, status: { $ne: 'deleted' } })
      .sort({ order: 1 })
      .toArray();

    // Group richblocks by articleId, flattening parent-child structure.
    // Timestamp blocks are stored as parents with content blocks in metadata.children.
    // ES needs a flat array with sequential order values so convertBlocksToHTML works correctly.
    const richBlocksMap = {};
    for (const block of blocks) {
      if (!richBlocksMap[block.articleId]) richBlocksMap[block.articleId] = [];

      const children = block.metadata?.children ?? [];
      const { children: _omit, ...metadataWithoutChildren } = block.metadata ?? {};

      richBlocksMap[block.articleId].push({
        id: block._id.toString(),
        type: block.type,
        content: block.content,
        metadata: children.length > 0 ? metadataWithoutChildren : block.metadata,
        order: block.order,
        author: block.author,
        createdBy: block.createdBy,
        updatedBy: block.updatedBy,
      });

      for (const child of children) {
        richBlocksMap[block.articleId].push(child);
      }
    }

    // Reassign sequential order to each article's flat block list so global sort is correct
    for (const articleId of Object.keys(richBlocksMap)) {
      richBlocksMap[articleId].forEach((b, i) => { b.order = i + 1; });
    }

    // Build ES bulk operations
    const operations = [];
    for (const doc of batch) {
      const { _id, password, refreshToken, ...rest } = doc;
      const id = _id.toString();
      operations.push(
        { update: { _index: withSuffix('article'), _id: id } },
        {
          doc: {
            ...rest,
            id,
            richBlocks: richBlocksMap[id] ?? [],
          },
          doc_as_upsert: true,
        }
      );
    }

    batchNumber++;
    const batchStartTime = Date.now();
    const timeSinceLastBatch = batchStartTime - lastBatchTime;

    await sendBulkUpdate(operations, 'articles');

    const batchDuration = Date.now() - batchStartTime;
    console.log(
      `  Batch #${batchNumber}: ${batch.length} docs | Total: ${count} | ` +
        `ES: ${batchDuration}ms | Gap: ${timeSinceLastBatch}ms`
    );

    batch = [];
    lastBatchTime = Date.now();
  };

  for (const pass of passes) {
    if (sinceDate) {
      console.log(`  ▶ Pass: ${pass.label} >= ${sinceDate.toISOString()}`);
    }
    let cursor = articlesCol.find(pass.query);
    if (limitNum) {
      cursor = cursor.sort({ updatedAt: -1, _id: -1 }).limit(limitNum);
    }
    while (await cursor.hasNext()) {
      batch.push(await cursor.next());
      count++;
      if (batch.length >= BATCH_SIZE) await flushBatch();
    }
  }
  await flushBatch(); // remaining docs

  const totalDuration = Date.now() - startTime;
  const avgTimePerDoc = count > 0 ? (totalDuration / count).toFixed(2) : 0;
  const docsPerSecond = count > 0 ? ((count / totalDuration) * 1000).toFixed(2) : 0;

  console.log(`\n  📊 Live Articles Statistics:`);
  console.log(`     Total Documents: ${count.toLocaleString()}`);
  console.log(`     Total Batches: ${batchNumber}`);
  console.log(`     Total Time: ${formatDuration(totalDuration)}`);
  console.log(`     Avg Time/Doc: ${avgTimePerDoc}ms`);
  console.log(`     Throughput: ${docsPerSecond} docs/sec`);
}

// node src/core/elastic/mongoToElastic.mjs
//
// USAGE:
//   Full sync (all documents):
//     node src/core/elastic/mongoToElastic.mjs
//     node src/core/elastic/mongoToElastic.mjs article
//
//   Live articles (richBlocks fetched from article_rich_blocks collection):
//     node src/core/elastic/mongoToElastic.mjs livearticle
//     node src/core/elastic/mongoToElastic.mjs livearticle --since=2025-01-01
//
//   Shorts only (articles with type === 'shorts'):
//     node src/core/elastic/mongoToElastic.mjs shorts
//     node src/core/elastic/mongoToElastic.mjs shorts --since=2025-01-01
//
//   Incremental sync (only docs updated/created since a date):
//     node src/core/elastic/mongoToElastic.mjs --since=2025-01-01
//     node src/core/elastic/mongoToElastic.mjs article --since=2025-01-01
//
//   Limited sync (newest N docs per collection, sorted by updatedAt desc):
//     node src/core/elastic/mongoToElastic.mjs article --limit=100
//     node src/core/elastic/mongoToElastic.mjs shorts --limit=50
//     node src/core/elastic/mongoToElastic.mjs article --since=2025-01-01 --limit=500
//
//   Cron job example (run daily, sync last 2 days to be safe):
//     0 2 * * * cd /path/to/app && node src/core/elastic/mongoToElastic.mjs article --since=$(date -d '2 days ago' +%Y-%m-%d)

// Get indices to update from command-line arguments (exclude --since flag)
const selectedIndices = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

if (selectedIndices.includes('livearticle')) {
  // Special path: live articles need richBlocks merged from the separate collection
  const mongoClient = new MongoClient(mongoUri);
  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    const db = mongoClient.db(mongoDbName);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      sinceDate
        ? '🔄 INCREMENTAL SYNC — LIVE ARTICLES'
        : '🚀 FULL SYNC — LIVE ARTICLES → ELASTICSEARCH'
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 Batch Size: ${BATCH_SIZE}`);
    if (sinceDate) console.log(`📅 Since: ${sinceDate.toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📂 Collection: articles (live) → Index: article');
    await bulkUpdateLiveArticles(db);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ LIVE ARTICLES SYNC COMPLETED');
    console.log(`📅 Finished at: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error during live articles sync:', error);
  } finally {
    await mongoClient.close();
  }
} else if (selectedIndices.includes('shorts')) {
  // Special path: only articles with type === 'shorts'
  const mongoClient = new MongoClient(mongoUri);
  const startTime = Date.now();
  try {
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    const db = mongoClient.db(mongoDbName);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      sinceDate ? '🔄 INCREMENTAL SYNC — SHORTS' : '🚀 FULL SYNC — SHORTS → ELASTICSEARCH'
    );
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 Batch Size: ${BATCH_SIZE}`);
    if (sinceDate) console.log(`📅 Since: ${sinceDate.toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📂 Collection: articles (shorts) → Index: article');
    await bulkUpdateInBatches(db.collection('articles'), withSuffix('article'), { type: 'shorts' });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SHORTS SYNC COMPLETED');
    console.log(`⏱️  Total Time: ${formatDuration(Date.now() - startTime)}`);
    console.log(`📅 Finished at: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Error during shorts sync:', error);
  } finally {
    await mongoClient.close();
  }
} else {
  // Standard path: all other collections (or specific ones passed as args)
  bulkUpdateCollections(selectedIndices);
}
