import { Router } from 'express'
import { UsersController } from './users.controller'

const router = Router()
const controller = new UsersController()

router.get('/', (req, res) => controller.list(req, res))
router.get('/coordinators', (req, res) => controller.getCoordinators(req, res))
router.get('/raffle/:type', (req, res) => controller.getRaffle(req, res))

router.post('/', (req, res) => controller.create(req, res))
router.put('/', (req, res) => controller.update(req, res))

// Rutas recibiendo los datos por body:
router.patch('/status', (req, res) => controller.toggleStatus(req, res))
router.post('/reset-password', (req, res) => controller.resetPassword(req, res))
router.post('/change-password', (req, res) => controller.changePasswordFirstLogin(req, res))

export default router