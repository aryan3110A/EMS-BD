-- Phase 1: container-level commercial, audit, notifications, amendments

ALTER TABLE "Port" ADD COLUMN IF NOT EXISTS "code" TEXT;

ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "packagingTypeId" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "packagingSizeId" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "packingDescription" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "packingSizeValue" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "packingSizeUnit" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "incoterm" TEXT NOT NULL DEFAULT 'FOB';
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "fobPrice" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "fobCurrency" TEXT DEFAULT 'USD';
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "exchangeRateAt" TIMESTAMP(3);
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "exchangeRateSource" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "exchangeRateManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "fobInrPerKg" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "totalFreight" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "freightPerMt" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "insurance" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "cifPrice" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "cnfPrice" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "originalCifCnfPrice" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "currentCifCnfPrice" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "commercialRemarks" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "containerStatus" TEXT NOT NULL DEFAULT 'PLANNED';
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "actualShipmentDate" TIMESTAMP(3);
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "dispatchStatus" TEXT NOT NULL DEFAULT 'PLANNED';

ALTER TABLE "ContractContainer"
  ADD CONSTRAINT "ContractContainer_packagingTypeId_fkey"
  FOREIGN KEY ("packagingTypeId") REFERENCES "PackagingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContractContainer"
  ADD CONSTRAINT "ContractContainer_packagingSizeId_fkey"
  FOREIGN KEY ("packagingSizeId") REFERENCES "PackagingSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ContainerCommercialAmendment" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "containerId" TEXT NOT NULL,
  "incoterm" TEXT NOT NULL,
  "previousValue" DOUBLE PRECISION NOT NULL,
  "amendedValue" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "amendedById" TEXT NOT NULL,
  "amendmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContainerCommercialAmendment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContractAuditLog" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "contractNumber" TEXT,
  "containerId" TEXT,
  "containerIndex" INTEGER,
  "fieldName" TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "changedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "targetRole" TEXT,
  "contractId" TEXT,
  "containerId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContainerCommercialAmendment_contractId_idx" ON "ContainerCommercialAmendment"("contractId");
CREATE INDEX IF NOT EXISTS "ContainerCommercialAmendment_containerId_idx" ON "ContainerCommercialAmendment"("containerId");
CREATE INDEX IF NOT EXISTS "ContractAuditLog_contractId_idx" ON "ContractAuditLog"("contractId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_targetRole_idx" ON "Notification"("targetRole");

ALTER TABLE "ContainerCommercialAmendment"
  ADD CONSTRAINT "ContainerCommercialAmendment_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContainerCommercialAmendment"
  ADD CONSTRAINT "ContainerCommercialAmendment_containerId_fkey"
  FOREIGN KEY ("containerId") REFERENCES "ContractContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContainerCommercialAmendment"
  ADD CONSTRAINT "ContainerCommercialAmendment_amendedById_fkey"
  FOREIGN KEY ("amendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContractAuditLog"
  ADD CONSTRAINT "ContractAuditLog_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractAuditLog"
  ADD CONSTRAINT "ContractAuditLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AppSetting" ("id", "key", "value", "updatedAt")
SELECT 'clphase1fobdeduction000001', 'FOB_DEDUCTION_AMOUNT', '70', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AppSetting" WHERE "key" = 'FOB_DEDUCTION_AMOUNT');
