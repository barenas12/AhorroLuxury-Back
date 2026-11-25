USE `luxury`;

-- =====================================================================
-- Migración 002: Interés de préstamos por Porcentaje (%) o Valor Fijo ($)
-- Compatible con MySQL / MariaDB (Pruebas) y TiDB Cloud (Producción)
-- =====================================================================

ALTER TABLE `loans`
  ADD COLUMN `interestMode` ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage' AFTER `interestRate`;

ALTER TABLE `loans`
  ADD COLUMN `fixedInterestAmount` DECIMAL(12,2) NULL DEFAULT NULL AFTER `interestMode`;
