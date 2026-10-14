import { Router } from 'express'
import { SavingsController } from './savings.controller'

const router = Router()
const controller = new SavingsController()

router.get('/dashboard', (req, res) => controller.getDashboard(req, res))

export default router