import dns from 'node:dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import { MongoClient } from 'mongodb'

const TARGET_URL = 'mongodb+srv://sudhathiriller_db_user:j3c79W7qLGw6v2LV@cluster0.bsno3vx.mongodb.net/?appName=Cluster0'
const DB_NAME = 'voter_db'

async function verify() {
  const client = new MongoClient(TARGET_URL)
  await client.connect()
  const db = client.db(DB_NAME)

  const collections = await db.listCollections().toArray()
  console.log(`Target Database '${DB_NAME}' contains ${collections.length} collection(s):`)

  let grandTotal = 0
  for (const colInfo of collections) {
    const name = colInfo.name
    const count = await db.collection(name).countDocuments()
    grandTotal += count
    console.log(` - Collection '${name}': ${count.toLocaleString()} documents`)
  }

  console.log(`\nGrand Total in Destination DB: ${grandTotal.toLocaleString()} documents`)
  await client.close()
}

verify().catch(console.error)
