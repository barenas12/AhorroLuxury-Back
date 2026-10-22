<<<<<<< HEAD
import { Router } from 'express'
import { PaymentsController } from './payments.controller'
import { validatePayment } from './payments.middleware'

const router = Router()
const controller = new PaymentsController()

router.get('/', (req, res) => controller.list(req, res))
router.get('/partners', (req, res) => controller.getPartners(req, res))
router.post('/', validatePayment, (req, res) => controller.create(req, res))

=======
import { Router } from 'express'
import { PaymentsController } from './payments.controller'
import { validatePayment } from './payments.middleware'

const router = Router()
const controller = new PaymentsController()

router.get('/', (req, res) => controller.list(req, res))
router.get('/partners', (req, res) => controller.getPartners(req, res))
router.post('/', validatePayment, (req, res) => controller.create(req, res))

>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
export default router