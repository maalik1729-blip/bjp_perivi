import dns from 'node:dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import { MongoClient } from 'mongodb'

const SOURCE_URL = 'mongodb+srv://tmisgowthaamand_db_user:UQZ0VVD9waDPex2l@cluster0.5q8xfoa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
const DB_NAME = 'voter_db'

async function inspect() {
  console.log('Connecting to Source DB...')
  const client = new MongoClient(SOURCE_URL)
  await client.connect()
  console.log('Connected!')

  const db = client.db(DB_NAME)
  const collections = await db.listCollections().toArray()

  console.log(`Found ${collections.length} collection(s) in '${DB_NAME}':`)
  let totalDocs = 0

  for (const colInfo of collections) {
    const name = colInfo.name
    const count = await db.collection(name).countDocuments()
    totalDocs += count
    console.log(` - Collection '${name}': ${count} documents`)
  }

  console.log(`Total documents across all collections: ${totalDocs}`)
  await client.close()
}

inspect().catch(err => {
  console.error('Inspection failed:', err)
  process.exit(1)
})
