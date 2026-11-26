import { Request, Response } from 'express'
import { EgressesService } from './egresses.service'
import { sendControllerError } from '../../shared/middlewares/error.middleware'
import { AppError } from '../../shared/errors/AppError'

const egressesService = new EgressesService()

export class EgressesController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const data = await egressesService.getAllEgresses()
      res.status(200).json({ success: true, data })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.authUser) {
        throw new AppError('Sesión requerida.', 401)
      }
      await egressesService.createEgress({
        ...req.body,
        registeredBy: req.authUser.id
      })
      res.status(201).json({ success: true, message: 'Egreso registrado exitosamente.' })
    } catch (error: unknown) {
      sendControllerError(res, error, 400)
    }
  }
}
