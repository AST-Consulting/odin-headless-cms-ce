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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📅 START DATE CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Fallback if --since=YYYY-MM-DD is not passed via CLI
const DEFAULT_START_DATE = '2025-12-01'; // Format: YYYY-MM-DD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

// Helper function to get start and end of a day in UTC
function getDayBounds(dateString) {
    const date = new Date(dateString);
    const startOfDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999));
    return { startOfDay, endOfDay };
}

// Helper function to add days to a date
function addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Helper function to format date for display
function formatDate(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

// Function to update data day by day
async function bulkUpdateCollections(selectedIndices = [], dateField = 'publishedAt') {
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

        const today = new Date().toISOString().split('T')[0];

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📅 DAY-BY-DAY SYNC (Daily Incremental Sync)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 Processing ${indicesToProcess.length} collection(s)`);
        console.log(`📅 Date Field: ${dateField}`);
        console.log(`📅 Start Date: ${START_DATE}`);
        console.log(`📅 End Date: ${today} (today)`);
        console.log(`🔄 Processing: ONE DAY AT A TIME`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Iterate over each filtered MongoDB collection and its corresponding Elasticsearch index
        for (const [collectionName, esIndex] of indicesToProcess) {
            const collection = db.collection(collectionName);
            console.log(`\n📂 Collection: ${collectionName} → Index: ${esIndex}`);
            console.log('─'.repeat(70));

            const collectionStartTime = Date.now();
            await syncDayByDay(collection, esIndex, dateField);
            const collectionEndTime = Date.now();
            const collectionDuration = collectionEndTime - collectionStartTime;

            console.log(`\n⏱️  Collection completed in: ${formatDuration(collectionDuration)}`);
            console.log('═'.repeat(70));
        }

        const scriptEndTime = Date.now();
        const totalDuration = scriptEndTime - scriptStartTime;

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SYNC COMPLETED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Total Time: ${formatDuration(totalDuration)}`);
        console.log(`📅 Finished at: ${new Date().toISOString()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error during bulk update:', error);
    } finally {
        await mongoClient.close();
    }
}

// Function to sync data DAY BY DAY
// ✅ Processes one complete day at a time
// ✅ No batching - fetches ALL documents for each day
// ✅ Easier to resume and track progress
// ✅ Perfect for daily incremental syncs
async function syncDayByDay(collection, esIndex, dateField = 'publishedAt') {
    let currentDate = START_DATE;
    const today = new Date().toISOString().split('T')[0];

    let totalDocuments = 0;
    let totalDays = 0;
    let daysWithData = 0;
    let daysWithoutData = 0;

    const startTime = Date.now();

    // Process each day from START_DATE to today
    while (currentDate <= today) {
        totalDays++;
        const dayStartTime = Date.now();

        // Get start and end of the current day
        const { startOfDay, endOfDay } = getDayBounds(currentDate);

        // Query for all documents published on this day
        const query = {
            status: { $ne: 'deleted' },
            [dateField]: {
                $gte: startOfDay,
                $lte: endOfDay,
                $exists: true
            }
        };

        // Fetch ALL documents for this day (no limit, no batching)
        const queryStartTime = Date.now();
        const docs = await collection
            .find(query)
            .sort({ [dateField]: -1 }) // Newest first within the day
            .toArray();
        const queryEndTime = Date.now();
        const queryDuration = queryEndTime - queryStartTime;

        if (docs.length === 0) {
            // No data for this day
            daysWithoutData++;
            console.log(`  📅 ${currentDate}: No data (${queryDuration}ms)`);

            // Move to next day
            currentDate = addDays(currentDate, 1);
            continue;
        }

        // We have data! Process all documents for this day
        daysWithData++;
        const batch = [];

        for (const doc of docs) {
            const { _id, password, refreshToken, seo, ...rest } = doc;

            // Prepare bulk update operation
            batch.push(
                { update: { _index: esIndex, _id: _id.toString() } }, // Update command
                { doc: rest, doc_as_upsert: true } // Document with upsert behavior
            );
        }

        // Send bulk update to Elasticsearch for this entire day
        const esStartTime = Date.now();
        await sendBulkUpdate(batch, collection.collectionName);
        const esEndTime = Date.now();
        const esDuration = esEndTime - esStartTime;

        const dayEndTime = Date.now();
        const dayDuration = dayEndTime - dayStartTime;

        totalDocuments += docs.length;

        // Display day summary
        console.log(`  📅 ${currentDate}: ${docs.length.toLocaleString()} docs | ` +
            `Query: ${queryDuration}ms | ES: ${esDuration}ms | ` +
            `Total: ${dayDuration}ms`);

        // Move to next day
        currentDate = addDays(currentDate, 1);
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const avgTimePerDoc = totalDocuments > 0 ? (totalDuration / totalDocuments).toFixed(2) : 0;
    const docsPerSecond = totalDocuments > 0 ? ((totalDocuments / totalDuration) * 1000).toFixed(2) : 0;
    const avgDocsPerDay = daysWithData > 0 ? (totalDocuments / daysWithData).toFixed(0) : 0;

    console.log(`\n  📊 Summary Statistics:`);
    console.log(`     Total Days Processed: ${totalDays}`);
    console.log(`     Days with Data: ${daysWithData} ✅`);
    console.log(`     Days without Data: ${daysWithoutData} ⊝`);
    console.log(`     Total Documents: ${totalDocuments.toLocaleString()}`);
    console.log(`     Avg Docs/Day: ${avgDocsPerDay}`);
    console.log(`     Total Time: ${formatDuration(totalDuration)}`);
    console.log(`     Avg Time/Doc: ${avgTimePerDoc}ms`);
    console.log(`     Throughput: ${docsPerSecond} docs/sec`);
}

// Function to send bulk update to Elasticsearch
async function sendBulkUpdate(batch, collectionName) {
    if (batch.length === 0) return;

    try {
        const bulkResponse = await elasticsearchService.bulk({
            refresh: true,
            body: batch,
        });

        if (bulkResponse.errors) {
            const erroredDocuments = bulkResponse.items.filter(
                (item) => item.update && item.update.error
            );
            console.error(`     ⚠️  Errors: ${erroredDocuments.length} docs failed`);

            // Log first 2 errors only
            erroredDocuments.slice(0, 2).forEach((errorDoc, index) => {
                console.error(`     Error ${index + 1}: ${errorDoc.update.error.type} (ID: ${errorDoc.update._id})`);
            });
            if (erroredDocuments.length > 2) {
                console.error(`     ... and ${erroredDocuments.length - 2} more errors`);
            }
        }
    } catch (error) {
        console.error(`     ❌ Bulk update failed:`, error.message);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USAGE:
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sync all collections day-by-day from DEFAULT_START_DATE to today:
//   node src/core/elastic/mongoToElasticDailySync.mjs
//
// Sync from a specific date (overrides DEFAULT_START_DATE):
//   node src/core/elastic/mongoToElasticDailySync.mjs --since=2025-01-01
//   node src/core/elastic/mongoToElasticDailySync.mjs article --since=2025-01-01
//
// Sync specific index with default date field (publishedAt):
//   node src/core/elastic/mongoToElasticDailySync.mjs article
//
// Sync with custom date field:
//   node src/core/elastic/mongoToElasticDailySync.mjs article createdAt
//   node src/core/elastic/mongoToElasticDailySync.mjs blogpost updatedAt
//
// Cron job example (run daily, sync from yesterday):
//   0 2 * * * cd /path/to/app && node src/core/elastic/mongoToElasticDailySync.mjs article --since=$(date -d 'yesterday' +%Y-%m-%d)
//
// ⚠️  IMPORTANT NOTES:
// 1. Pass --since=YYYY-MM-DD to set the start date via CLI (preferred)
//    Or modify DEFAULT_START_DATE constant at top of file as fallback
// 2. Create index on date field for better performance:
//    db.articles.createIndex({ publishedAt: 1 })
// 3. Script will process ONE DAY AT A TIME from start date to today
// 4. Each day's documents are fetched in a single query (no batching)
// 5. Perfect for daily incremental syncs - just run daily!
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Parse command-line arguments
const rawArgs = process.argv.slice(2);

// Extract --since=YYYY-MM-DD flag
const sinceFlag = rawArgs.find(arg => arg.startsWith('--since='));
const START_DATE = sinceFlag ? sinceFlag.split('=')[1] : DEFAULT_START_DATE;

// Remaining args (no flags)
const args = rawArgs.filter(arg => !arg.startsWith('--'));

// Figure out which arguments are indices and which is the date field
const commonDateFields = ['publishedat', 'createdat', 'updatedat', 'date', 'timestamp'];
let dateField = 'publishedAt'; // Default
let selectedIndices = [];

if (args.length > 0) {
    const lastArg = args[args.length - 1].toLowerCase();
    if (commonDateFields.includes(lastArg) || lastArg.includes('date') || lastArg.includes('time')) {
        // Last arg is likely a date field
        dateField = args[args.length - 1];
        selectedIndices = args.slice(0, -1);
    } else {
        // All args are indices
        selectedIndices = args;
    }
}

console.log(`\n📋 Configuration:`);
console.log(`   Indices: ${selectedIndices.length > 0 ? selectedIndices.join(', ') : 'ALL'}`);
console.log(`   Date Field: ${dateField}`);
console.log(`   Start Date: ${START_DATE}${sinceFlag ? ' (from --since arg)' : ' (default fallback)'}`);
console.log(`   Strategy: Day-by-Day (No Batching)\n`);

// Run the day-by-day sync process
bulkUpdateCollections(selectedIndices, dateField);
