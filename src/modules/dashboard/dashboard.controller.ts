import { Request, Response } from 'express'
import { DashboardService } from './dashboard.service'
import { resolveViewerScope } from '../../shared/utils/scope.utils'
import { sendControllerError } from '../../shared/middlewares/error.middleware'

const dashboardService = new DashboardService()

export class DashboardController {
  async getSummary(_req: Request, res: Response): Promise<void> {
    try {
      const data = await dashboardService.getFinancialSummary()
      res.status(200).json({ success: true, data })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }

  async getPersonalSummary(req: Request, res: Response): Promise<void> {
    try {
      const scope = resolveViewerScope(req)
      const data = await dashboardService.getPersonalSummary(scope)
      res.status(200).json({ success: true, data })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }
}
