import dns from 'node:dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import { MongoClient } from 'mongodb'

const SOURCE_URL = 'mongodb+srv://tmisgowthaamand_db_user:UQZ0VVD9waDPex2l@cluster0.5q8xfoa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const TARGET_URL = 'mongodb+srv://sudhathiriller_db_user:j3c79W7qLGw6v2LV@cluster0.bsno3vx.mongodb.net/?appName=Cluster0'
const DB_NAME = 'voter_db'
const BATCH_SIZE = 5000

async function migrate() {
  console.log('Connecting to Source DB & Target DB...')
  const sourceClient = new MongoClient(SOURCE_URL, { maxPoolSize: 20 })
  const targetClient = new MongoClient(TARGET_URL, { maxPoolSize: 20 })

  await Promise.all([sourceClient.connect(), targetClient.connect()])
  console.log('Connected to both databases!')

  const sourceDb = sourceClient.db(DB_NAME)
  const targetDb = targetClient.db(DB_NAME)

  const collections = await sourceDb.listCollections().toArray()
  console.log(`Starting migration for ${collections.length} collections...`)

  const startTime = Date.now()

  for (const colInfo of collections) {
    const colName = colInfo.name
    const sourceCol = sourceDb.collection(colName)
    const targetCol = targetDb.collection(colName)

    const totalDocs = await sourceCol.countDocuments()
    console.log(`\n--------------------------------------------------`)
    console.log(`Migrating collection: '${colName}' (${totalDocs.toLocaleString()} documents)`)

    // 1. Copy Indexes (excluding _id_)
    try {
      const indexes = await sourceCol.indexes()
      for (const index of indexes) {
        if (index.name !== '_id_') {
          const keys = index.key
          const options = { ...index }
          delete options.key
          delete options.v
          delete options.ns
          await targetCol.createIndex(keys, options).catch(e => console.warn(`Index warning on ${colName}:`, e.message))
        }
      }
      console.log(`Indexes created/verified for '${colName}'`)
    } catch (e) {
      console.warn(`Could not copy indexes for ${colName}:`, e.message)
    }

    // 2. Copy Documents in Batches
    let copied = 0
    const cursor = sourceCol.find({}, { batchSize: BATCH_SIZE })
    let batch = []

    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      batch.push(doc)

      if (batch.length >= BATCH_SIZE) {
        try {
          await targetCol.insertMany(batch, { ordered: false })
          copied += batch.length
        } catch (err) {
          if (err.code === 11000 || err.writeErrors) {
            // Partial insert due to duplicates, count inserted
            const inserted = err.result?.nInserted || (batch.length - (err.writeErrors?.length || 0))
            copied += inserted
          } else {
            console.error(`ERROR inserting batch in ${colName}:`, err.message)
            throw err
          }
        }
        const elapsedSec = Math.round((Date.now() - startTime) / 1000)
        const pct = ((copied / totalDocs) * 100).toFixed(1)
        console.log(`[${colName}] Copied ${copied.toLocaleString()} / ${totalDocs.toLocaleString()} (${pct}%) [Elapsed: ${elapsedSec}s]`)
        batch = []
      }
    }

    if (batch.length > 0) {
      try {
        await targetCol.insertMany(batch, { ordered: false })
        copied += batch.length
      } catch (err) {
        if (err.code === 11000 || err.writeErrors) {
          const inserted = err.result?.nInserted || (batch.length - (err.writeErrors?.length || 0))
          copied += inserted
        } else {
          console.error(`ERROR inserting remaining batch in ${colName}:`, err.message)
          throw err
        }
      }
      console.log(`[${colName}] Completed! Total copied: ${copied.toLocaleString()}`)
    }
  }

  const durationMin = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
  console.log(`\n==================================================`)
  console.log(`Migration Complete! Total duration: ${durationMin} minutes.`)
  console.log(`==================================================`)

  await Promise.all([sourceClient.close(), targetClient.close()])
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
