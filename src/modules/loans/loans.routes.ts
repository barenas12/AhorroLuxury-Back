import { Router } from 'express'
import { LoansController } from './loans.controller'
import { LoansMiddleware } from './loans.middleware'

const router = Router()
const controller = new LoansController()
const middleware = new LoansMiddleware()

router.get('/', (req, res) => controller.list(req, res))

// Se añade el middleware antes de ejecutar la función del controlador
router.post('/', middleware.validateCreate, (req, res) => controller.create(req, res))
router.post('/:id/pay', middleware.validatePayment, (req, res) => controller.registerPayment(req, res))

export default router