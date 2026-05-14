import { MongoClient } from 'mongodb';
import 'dotenv/config';

const mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI;
const envDbName = process.env.MONGODB_DATABASE;

async function checkMongo() {
    const client = new MongoClient(mongoUri);
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const adminDb = client.db().admin();
        const dbs = await adminDb.listDatabases();
        console.log('\nAvailable Databases:');
        dbs.databases.forEach(db => console.log(` - ${db.name}`));

        // Check the database from connection string
        const urlMatch = mongoUri.match(/\/([^/?]+)(\?|$)/);
        const urlDbName = urlMatch ? urlMatch[1] : null;

        const dbNamesToCheck = [envDbName, urlDbName].filter(Boolean);
        const uniqueDbNames = [...new Set(dbNamesToCheck)];

        for (const dbName of uniqueDbNames) {
            console.log(`\n--- Checking Database: ${dbName} ---`);
            const db = client.db(dbName);
            const collections = await db.listCollections().toArray();
            if (collections.length === 0) {
                console.log('No collections found.');
                continue;
            }

            for (const col of collections) {
                const count = await db.collection(col.name).countDocuments();
                if (col.name.includes('menu')) {
                    console.log(` * ${col.name}: ${count} documents`);
                    if (count > 0) {
                        const sample = await db.collection(col.name).findOne();
                        console.log('Sample document keys:', Object.keys(sample));
                        console.log('Sample document status:', sample.status);
                    }
                } else if (count > 0) {
                    // Only show other non-empty collections
                    // console.log(`   ${col.name}: ${count} documents`);
                }
            }
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await client.close();
    }
}

checkMongo();
