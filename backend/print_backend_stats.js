import dns from 'node:dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
dotenv.config()

async function showStats() {
  console.log('\n===============================================================')
  console.log('            BJP LOCAL BODY BACKEND — SYSTEM STATS              ')
  console.log('===============================================================')

  const { MONGO_VOTER_URL, MONGO_VOTER_DB_NAME, MONGO_APP_URL, MONGO_APP_DB_NAME } = process.env

  // 1. Voter DB Stats
  console.log('\n--- 🗳️ VOTER DATABASE (Read-Only Roll) ---')
  console.log(`URL: ${MONGO_VOTER_URL ? MONGO_VOTER_URL.split('@')[1] : 'Not Set'}`)
  console.log(`Database Name: ${MONGO_VOTER_DB_NAME || 'voter_db'}`)

  try {
    const voterClient = new MongoClient(MONGO_VOTER_URL, { serverSelectionTimeoutMS: 5000 })
    await voterClient.connect()
    const voterDb = voterClient.db(MONGO_VOTER_DB_NAME || 'voter_db')
    const collections = await voterDb.listCollections().toArray()

    let totalVoters = 0
    console.log(`Collections (${collections.length}):`)
    for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await voterDb.collection(col.name).countDocuments()
      totalVoters += count
      console.log(`   └─ ${col.name.padEnd(10)} : ${count.toLocaleString().padStart(10)} voters`)
    }
    console.log(`TOTAL VOTER RECORDS: ${totalVoters.toLocaleString()}`)
    await voterClient.close()
  } catch (e) {
    console.log(`🔴 Voter DB Connection Error: ${e.message}`)
  }

  // 2. Applications DB Stats
  console.log('\n--- 📝 APPLICATIONS DATABASE (Read/Write Applications) ---')
  console.log(`URL: ${MONGO_APP_URL ? MONGO_APP_URL.split('@')[1] : 'Not Set'}`)
  console.log(`Database Name: ${MONGO_APP_DB_NAME || 'bjp_localbody'}`)

  try {
    const appClient = new MongoClient(MONGO_APP_URL, { serverSelectionTimeoutMS: 5000 })
    await appClient.connect()
    const appDb = appClient.db(MONGO_APP_DB_NAME || 'bjp_localbody')
    const appsCol = appDb.collection('applications')

    const totalApps = await appsCol.countDocuments()
    const urbanCount = await appsCol.countDocuments({ body_type: 'urban' })
    const ruralCount = await appsCol.countDocuments({ body_type: 'rural' })

    console.log(`Total Submitted Applications : ${totalApps.toLocaleString()}`)
    console.log(`   ├─ Urban Local Body        : ${urbanCount.toLocaleString()}`)
    console.log(`   └─ Rural Local Body        : ${ruralCount.toLocaleString()}`)

    if (totalApps > 0) {
      const latest = await appsCol.find().sort({ submitted_at: -1 }).limit(3).toArray()
      console.log('\nRecent Applications:')
      latest.forEach((app, i) => {
        console.log(`   ${i + 1}. ID: ${app.application_id} | Mobile: ${app.mobile} | Type: ${app.body_type} | Date: ${app.submitted_at}`)
      })
    }

    await appClient.close()
  } catch (e) {
    console.log(`🔴 App DB Connection Error: ${e.message}`)
  }

  console.log('\n===============================================================\n')
}

showStats().catch(console.error)
