import express, { Application } from 'express'
import cors from 'cors'
import loginRoutes from './modules/login/login.routes'
import usersRoutes from './modules/users/users.routes'
import paymentsRoutes from './modules/payments/payments.routes'
import savingsRoutes from './modules/savings/savings.routes'

const app: Application = express()

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/login', loginRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/savings', savingsRoutes)

export default app