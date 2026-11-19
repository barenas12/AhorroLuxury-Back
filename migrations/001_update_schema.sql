-- 1. Tabla partners: fecha de inicio de ahorro y fecha en que quedó al día
ALTER TABLE `partners`
  ADD COLUMN `savingsStartDate` DATE NULL DEFAULT NULL AFTER `frequency`,
  ADD COLUMN `savingsUpToDateAt` DATE NULL DEFAULT NULL AFTER `statusValue`;

-- 2. Tabla loans: agregar 'Negocio' a guarantee, dueDate NULL, y columnas de flexibilidad / intereses al día
ALTER TABLE `loans`
  MODIFY COLUMN `guarantee` ENUM('Oro','Prenda','Sin Prenda','Negocio','Otro') NOT NULL DEFAULT 'Sin Prenda',
  MODIFY COLUMN `dueDate` DATE NULL DEFAULT NULL,
  ADD COLUMN `settledInterestBase` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `interestRate`,
  ADD COLUMN `interestAdjustment` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `settledInterestBase`,
  ADD COLUMN `condonedInterest` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `interestAdjustment`,
  ADD COLUMN `lastInterestUpToDateAt` DATE NULL DEFAULT NULL AFTER `termDays`;

-- 3. Nueva tabla para boletas compradas por personas externas (por afuera)
CREATE TABLE IF NOT EXISTS `raffle_external_tickets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `raffleType` TINYINT(1) NOT NULL COMMENT '1 = Rifa 1, 2 = Rifa 2',
  `ticketNumber` VARCHAR(10) NOT NULL,
  `fullName` VARCHAR(150) NOT NULL,
  `cellphone` VARCHAR(30) NOT NULL,
  `coordinatorId` INT(11) NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_raffle_ticket` (`raffleType`, `ticketNumber`),
  KEY `idx_ext_coordinator` (`coordinatorId`),
  CONSTRAINT `fk_ext_ticket_coordinator` FOREIGN KEY (`coordinatorId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Nueva tabla consolidado de recibos (ID único para 1 o múltiples pagos)
CREATE TABLE IF NOT EXISTS `payment_receipts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `receiptType` ENUM('payment','loan_payment') NOT NULL DEFAULT 'payment',
  `partnerId` INT(11) NULL DEFAULT NULL,
  `externalTicketId` INT(11) NULL DEFAULT NULL,
  `loanId` INT(11) NULL DEFAULT NULL,
  `paymentIds` JSON NOT NULL,
  `totalAmount` DECIMAL(12,2) NOT NULL,
  `paymentDate` DATE NOT NULL,
  `registeredBy` INT(11) NOT NULL,
  `observations` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  PRIMARY KEY (`id`),
  KEY `idx_receipt_partner` (`partnerId`),
  KEY `idx_receipt_ext` (`externalTicketId`),
  KEY `idx_receipt_loan` (`loanId`),
  KEY `idx_receipt_user` (`registeredBy`),
  CONSTRAINT `fk_receipt_partner` FOREIGN KEY (`partnerId`) REFERENCES `partners` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_receipt_ext` FOREIGN KEY (`externalTicketId`) REFERENCES `raffle_external_tickets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_receipt_loan` FOREIGN KEY (`loanId`) REFERENCES `loans` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_receipt_user` FOREIGN KEY (`registeredBy`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla payments: soportar externos, diferenciar rifa y vincular al recibo consolidado
ALTER TABLE `payments`
  MODIFY COLUMN `partnerId` INT(11) NULL DEFAULT NULL,
  ADD COLUMN `externalTicketId` INT(11) NULL DEFAULT NULL AFTER `partnerId`,
  ADD COLUMN `raffleType` TINYINT(1) NULL DEFAULT NULL AFTER `ticketNumber`,
  ADD COLUMN `receiptId` INT(11) NULL DEFAULT NULL AFTER `loanId`,
  ADD KEY `idx_payments_ext` (`externalTicketId`),
  ADD KEY `idx_payments_receipt` (`receiptId`),
  ADD CONSTRAINT `fk_payments_ext` FOREIGN KEY (`externalTicketId`) REFERENCES `raffle_external_tickets` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payments_receipt` FOREIGN KEY (`receiptId`) REFERENCES `payment_receipts` (`id`) ON DELETE SET NULL;
