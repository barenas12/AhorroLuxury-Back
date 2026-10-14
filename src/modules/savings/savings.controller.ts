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
}