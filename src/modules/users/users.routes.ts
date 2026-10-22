<<<<<<< HEAD
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

=======
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

>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
export default router