import { Request, Response } from 'express'
import { DashboardService } from './dashboard.service'

const dashboardService = new DashboardService()

export class DashboardController {
  async getSummary(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getFinancialSummary()
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }
}