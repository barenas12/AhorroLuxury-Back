import { Router } from 'express'
import { UsersController } from './users.controller'

const router = Router()
const controller = new UsersController()

router.get('/', (req, res) => controller.list(req, res))
router.get('/coordinators', (req, res) => controller.getCoordinators(req, res))
router.get('/raffle/:type', (req, res) => controller.getRaffle(req, res))

// ⚠️ Rutas de creación y actualización:
router.post('/', (req, res) => controller.create(req, res))
router.put('/:id', (req, res) => controller.update(req, res))

router.patch('/status/:documentId', (req, res) => controller.toggleStatus(req, res))
router.post('/reset-password/:documentId', (req, res) => controller.resetPassword(req, res))
router.post('/change-password', (req, res) => controller.changePasswordFirstLogin(req, res))

export default router