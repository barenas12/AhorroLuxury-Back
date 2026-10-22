import { Router } from 'express'
import { PaymentsController } from './payments.controller'
import { validatePayment } from './payments.middleware'

const router = Router()
const controller = new PaymentsController()

router.get('/', (req, res) => controller.list(req, res))
router.get('/partners', (req, res) => controller.getPartners(req, res))
router.post('/', validatePayment, (req, res) => controller.create(req, res))

export default router