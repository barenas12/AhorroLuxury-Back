import { Request, Response } from 'express'
import { SavingsService } from './savings.service'
import { resolveViewerScope } from '../../shared/utils/scope.utils'
import { sendControllerError } from '../../shared/middlewares/error.middleware'

const savingsService = new SavingsService()

export class SavingsController {
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const scope = resolveViewerScope(req)
      const data = await savingsService.getSavingsDashboard(scope)
      res.status(200).json({ success: true, data })
    } catch (error: unknown) {
      sendControllerError(res, error, 500)
    }
  }
}
