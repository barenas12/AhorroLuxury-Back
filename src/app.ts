<<<<<<< HEAD
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

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/login', loginRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/savings', savingsRoutes)
app.use('/api/loans', loansRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/egresses', egressesRoutes)

=======
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

>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
export default app