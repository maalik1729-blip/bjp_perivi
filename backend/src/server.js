import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { connectDbs, closeDbs, isVoterDbOnline, isAppDbOnline } from './config/db.js'
import apiRoutes from './routes/index.js'
import adminRoutes from './routes/admin.js'

const app = express()

app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// CORS — allow local dev (localhost:3000, 5173), Vercel production, and all client origins simultaneously
app.use(cors({
  origin(origin, cb) {
    // Allow all incoming origins (reflects request origin with credentials enabled)
    return cb(null, true)
  },
  credentials: true,
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Clear terminal request logging for all frontend interactions
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const time = new Date().toLocaleTimeString()
    const status = res.statusCode
    const statusSymbol = status < 400 ? '✅' : '❌'

    let payloadDetails = []
    if (req.body && typeof req.body === 'object') {
      if (req.body.mobile) payloadDetails.push(`Mobile: ${req.body.mobile}`)
      if (req.body.epic_no) payloadDetails.push(`EPIC: ${req.body.epic_no}`)
      if (req.body.otp) payloadDetails.push(`OTP: ${req.body.otp}`)
      if (req.body.membership_id) payloadDetails.push(`MembershipID: ${req.body.membership_id}`)
      if (req.body.body_type) payloadDetails.push(`Type: ${req.body.body_type}`)
    }

    const detailStr = payloadDetails.length ? ` — [${payloadDetails.join(', ')}]` : ''
    console.log(`[${time}] ${statusSymbol} ${req.method} ${req.originalUrl} (${status}) ${duration}ms${detailStr}`)
  })
  next()
})

app.get('/', (req, res) =>
  res.json({
    service: 'BJP Tamil Nadu — Local Body Application API',
    status: 'ok',
    voterDb: isVoterDbOnline(),
    appDb: isAppDbOnline(),
    endpoints: ['/health', '/api/*', '/admin/api/*'],
  })
)

app.get('/health', (req, res) =>
  res.json({ ok: true, voterDb: isVoterDbOnline(), appDb: isAppDbOnline() })
)

app.use('/api', apiRoutes)
app.use('/admin/api', adminRoutes)

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }))

const PORT = process.env.PORT || 5000

function validateEnv() {
  const missing = ['MONGO_VOTER_URL', 'MONGO_APP_URL', 'SMS_API_KEY'].filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`[bjp] FATAL: missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

;(async () => {
  validateEnv()
  await connectDbs()
  const server = app.listen(PORT, () => console.log(`[bjp] API listening on http://localhost:${PORT}`))
  const shutdown = async () => { await closeDbs(); server.close(() => process.exit(0)) }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})()
