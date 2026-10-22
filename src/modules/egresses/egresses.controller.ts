import { Request, Response } from 'express'
import { EgressesService } from './egresses.service'

const egressesService = new EgressesService()

export class EgressesController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const data = await egressesService.getAllEgresses()
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      await egressesService.createEgress(req.body)
      res.status(201).json({ success: true, message: 'Egreso registrado exitosamente.' })
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message }) // Aquí arrojará el error de fondos insuficientes
    }
  }
}