<<<<<<< HEAD
import { Router } from 'express'
import { SavingsController } from './savings.controller'

const router = Router()
const controller = new SavingsController()

router.get('/dashboard', (req, res) => controller.getDashboard(req, res))

=======
import { Router } from 'express'
import { SavingsController } from './savings.controller'

const router = Router()
const controller = new SavingsController()

router.get('/dashboard', (req, res) => controller.getDashboard(req, res))

>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
export default router