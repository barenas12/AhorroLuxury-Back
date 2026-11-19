import { Request, Response, NextFunction } from 'express'

export const validatePayment = (req: Request, res: Response, next: NextFunction): void => {
  const { partnerId, externalTicketId, registeredBy, items } = req.body

  if (!registeredBy) {
    res.status(400).json({
      success: false,
      message: 'El usuario registrador es requerido.'
    })
    return
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      success: false,
      message: 'Debe ingresar al menos una fila de abono.'
    })
    return
  }

  const hasAnyExternalItem = items.some((it: any) => Boolean(it.externalTicketId))
  if (!partnerId && !externalTicketId && !hasAnyExternalItem) {
    res.status(400).json({
      success: false,
      message: 'Debe seleccionar un socio o un comprador externo de boleta.'
    })
    return
  }

  for (const it of items) {
    if (!it.concept || !it.paymentMethod || !it.paymentDate) {
      res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios de cada abono deben estar completos.'
      })
      return
    }

    const amount = Number(it.amount || 0)
    const fineAmount = it.hasFine ? Number(it.fineAmount || 0) : 0

    if (isNaN(amount) || amount < 0 || isNaN(fineAmount) || fineAmount < 0) {
      res.status(400).json({
        success: false,
        message: `El concepto "${it.concept}" contiene valores inválidos.`
      })
      return
    }

    // Permite abono = $0 siempre que exista una multa > $0 (ej. $0 abono + $50.000 multa)
    if (amount + fineAmount <= 0) {
      res.status(400).json({
        success: false,
        message: `El concepto "${it.concept}" debe tener un monto de abono o multa mayor a $0.`
      })
      return
    }
  }

  next()
}
