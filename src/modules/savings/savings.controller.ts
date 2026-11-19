import { Request, Response } from 'express'
import { SavingsService } from './savings.service'
import { resolveViewerScope } from '../../shared/utils/scope.utils'

const savingsService = new SavingsService()

export class SavingsController {
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const scope = await resolveViewerScope(req)
      const data = await savingsService.getSavingsDashboard(scope)
      res.status(200).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message })
    }
  }
}
