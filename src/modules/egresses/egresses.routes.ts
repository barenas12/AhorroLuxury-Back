import { Router } from 'express'
import { EgressesController } from './egresses.controller'

const router = Router()
const controller = new EgressesController()

router.get('/', (req, res) => controller.list(req, res))
router.post('/', (req, res) => controller.create(req, res))

export default router