import { Router } from 'express'
import { LoansController } from './loans.controller'
import { LoansMiddleware } from './loans.middleware'

const router = Router()
const controller = new LoansController()
const middleware = new LoansMiddleware()

router.get('/', (req, res) => controller.list(req, res))
router.get('/:id/receipts', (req, res) => controller.getLoanReceipts(req, res))
router.post('/', middleware.validateCreate, (req, res) => controller.create(req, res))
router.post('/:id/pay', middleware.validatePayment, (req, res) => controller.registerPayment(req, res))
router.patch('/:id/interest', (req, res) => controller.updateInterest(req, res))

export default router
