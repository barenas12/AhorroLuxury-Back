import express, { Application } from 'express'
import cors from 'cors'
import loginRoutes from './modules/login/login.routes'
import usersRoutes from './modules/users/users.routes'
import paymentsRoutes from './modules/payments/payments.routes'
import savingsRoutes from './modules/savings/savings.routes'
import loansRoutes from './modules/loans/loans.routes'
import dashboardRoutes from './modules/dashboard/dashboard.routes'
import egressesRoutes from './modules/egresses/egresses.routes'

const app: Application = express()

const defaultAllowedOrigins = [
  'https://ahorro-luxury-web-one.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081'
]

const envOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean)

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]))

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin cabecera Origin (ej. healthchecks, Postman, server-to-server)
      if (!origin) return callback(null, true)
      const normalized = origin.replace(/\/+$/, '')
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true)
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
)

app.use(express.json())

app.use('/api/login', loginRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/savings', savingsRoutes)
app.use('/api/loans', loansRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/egresses', egressesRoutes)

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend de Ahorro Luxury activo'
  })
})

export default app
