import { ElasticsearchService } from '@nestjs/elasticsearch';
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
const elasticsearchService = new ElasticsearchService({
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
};

const BATCH_SIZE = 5000; // Set batch size to 5000

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

        // Filter collectionIndexMap based on selectedIndices.
        // CLI args are base names (`article`); map values are already suffixed — so
        // compare after re-suffixing the CLI args to stay consistent.
        const selectedSuffixed = selectedIndices.map(withSuffix);
        const indicesToProcess =
            selectedIndices.length > 0
                ? Object.entries(collectionIndexMap).filter(([_, esIndex]) =>
                    selectedSuffixed.includes(esIndex)
                )
                : Object.entries(collectionIndexMap);

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 CURSOR-BASED PAGINATION (lastId Method)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 Processing ${indicesToProcess.length} collection(s)`);
        console.log(`📦 Batch Size: ${BATCH_SIZE}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Iterate over each filtered MongoDB collection and its corresponding Elasticsearch index
        for (const [collectionName, esIndex] of indicesToProcess) {
            const collection = db.collection(collectionName);
            console.log(`\n📂 Collection: ${collectionName} → Index: ${esIndex}`);

            const collectionStartTime = Date.now();
            await bulkUpdateInBatches(collection, esIndex);
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

// Function to handle bulk update in batches using CURSOR-BASED PAGINATION with lastId
// ✅ O(1) Query Performance - Works same for millions or billions of records
// ✅ Uses indexed _id field with $gt operator
// ✅ No skip/limit - each query is independent and fast
async function bulkUpdateInBatches(collection, esIndex) {
    let batch = [];
    let count = 0;
    let lastId = null; // Track the last processed _id for cursor-based pagination
    let hasMore = true;
    let batchNumber = 0;

    const startTime = Date.now();
    let lastBatchTime = startTime;

    while (hasMore) {
        batchNumber++;
        const batchStartTime = Date.now();

        // Build query with cursor-based pagination
        const query = { status: { $ne: 'deleted' } };

        // If we have a lastId, fetch documents greater than that ID
        if (lastId) {
            query._id = { $gt: lastId };
        }

        // Fetch batch using find with limit - much faster than skip!
        // This query is O(1) because _id is indexed and we're using $gt
        const queryStartTime = Date.now();
        const docs = await collection
            .find(query)
            .sort({ _id: 1 }) // Sort by _id ascending
            .limit(BATCH_SIZE)
            .toArray();
        const queryEndTime = Date.now();
        const queryDuration = queryEndTime - queryStartTime;

        // If no more documents, we're done
        if (docs.length === 0) {
            hasMore = false;
            break;
        }

        // Process each document
        for (const doc of docs) {
            const { _id, password, refreshToken, seo, ...rest } = doc;

            // Prepare bulk update operation
            batch.push(
                { update: { _index: esIndex, _id: _id.toString() } }, // Update command
                { doc: rest, doc_as_upsert: true } // Document with upsert behavior
            );

            count++;
            lastId = _id; // Update lastId for next iteration
        }

        // Send bulk update for this batch
        const esStartTime = Date.now();
        await sendBulkUpdate(batch, collection.collectionName);
        const esEndTime = Date.now();
        const esDuration = esEndTime - esStartTime;

        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;
        const timeSinceLastBatch = batchStartTime - lastBatchTime;

        // Detailed timing information
        console.log(`  Batch #${batchNumber}: ${docs.length} docs | Total: ${count} | ` +
            `Query: ${queryDuration}ms | ES: ${esDuration}ms | ` +
            `Total: ${batchDuration}ms | Gap: ${timeSinceLastBatch}ms`);

        batch = []; // Reset batch after sending
        lastBatchTime = batchEndTime;

        // If we got fewer documents than BATCH_SIZE, we've reached the end
        if (docs.length < BATCH_SIZE) {
            hasMore = false;
        }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const avgTimePerDoc = count > 0 ? (totalDuration / count).toFixed(2) : 0;
    const docsPerSecond = count > 0 ? ((count / totalDuration) * 1000).toFixed(2) : 0;

    console.log(`\n  📊 Collection Statistics:`);
    console.log(`     Total Documents: ${count}`);
    console.log(`     Total Batches: ${batchNumber}`);
    console.log(`     Total Time: ${formatDuration(totalDuration)}`);
    console.log(`     Avg Time/Doc: ${avgTimePerDoc}ms`);
    console.log(`     Throughput: ${docsPerSecond} docs/sec`);
}

// Function to send bulk update to Elasticsearch
async function sendBulkUpdate(batch, collectionName) {
    try {
        const bulkResponse = await elasticsearchService.bulk({
            refresh: true,
            body: batch,
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
        console.error(`     ❌ Error during bulk update:`, error.message);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USAGE:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sync all collections:
//   node src/core/elastic/mongoToElasticByLastId.mjs
//
// Sync specific index:
//   node src/core/elastic/mongoToElasticByLastId.mjs article
//
// Sync multiple indices:
//   node src/core/elastic/mongoToElasticByLastId.mjs article blogpost
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get indices to update from command-line arguments
const selectedIndices = process.argv.slice(2);

// Run the bulk update process
bulkUpdateCollections(selectedIndices);
