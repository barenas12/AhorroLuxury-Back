import express, { Application } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import loginRoutes from './modules/login/login.routes'
import usersRoutes from './modules/users/users.routes'
import paymentsRoutes from './modules/payments/payments.routes'
import savingsRoutes from './modules/savings/savings.routes'
import loansRoutes from './modules/loans/loans.routes'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import egressesRoutes from './modules/egresses/egresses.routes'
import { apiRateLimiter } from './shared/middlewares/rateLimit.middleware'
import { errorHandler } from './shared/middlewares/error.middleware'

const app: Application = express()

const isProduction = process.env.NODE_ENV === 'production'

// Necesario detrás de proxies inversos (Render, Railway, Vercel, Nginx) para rate limiting
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
)

const prodDefaultOrigins = ['https://ahorro-luxury-web-one.vercel.app']
const devDefaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081'
]

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const allowedOrigins = Array.from(
  new Set([
    ...prodDefaultOrigins,
    ...(isProduction ? [] : devDefaultOrigins),
    ...envOrigins
  ])
)

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin cabecera Origin (ej. healthchecks, server-to-server)
      if (!origin) return callback(null, true)
      const normalized = origin.replace(/\/+$/, '')
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true)
      }
      return callback(new Error('CORS_FORBIDDEN'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)

app.use(express.json({ limit: '100kb' }))
app.use('/api', apiRateLimiter)

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend de Ahorro Luxury activo'
  })
})

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok'
  })
})

app.use('/api/login', loginRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/savings', savingsRoutes)
app.use('/api/loans', loansRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/egresses', egressesRoutes)

app.use(errorHandler)

export default app
