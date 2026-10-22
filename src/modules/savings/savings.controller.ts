<<<<<<< HEAD
import { Request, Response } from 'express'
import { SavingsService } from './savings.service'

const savingsService = new SavingsService()

export class SavingsController {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    try {
      const data = await savingsService.getSavingsDashboard()
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }
=======
import { Request, Response } from 'express'
import { SavingsService } from './savings.service'

const savingsService = new SavingsService()

export class SavingsController {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    try {
      const data = await savingsService.getSavingsDashboard()
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }
>>>>>>> 8f16c09778c148297ac3816f6f22fe65d4c1c8a4
}