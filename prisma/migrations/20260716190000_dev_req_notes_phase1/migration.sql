-- Module A: Developer Requirement Notes schema foundation

-- Packaging master enrichment
ALTER TABLE "PackagingType" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "PackagingSize" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Contract: other payment method
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "otherPaymentMethod" TEXT;

-- Container: seals, invoice/payment, production hooks, default status
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "factorySealNo" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "shippingLineSealNo" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "invoiceAmount" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "paymentReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_RAISED';
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "receivedAmount" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "remainingAmount" DOUBLE PRECISION;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "paymentRemarks" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "productionUnitId" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN IF NOT EXISTS "productionRemarks" TEXT;

-- Soft-migrate legacy PLANNED -> DRAFT where appropriate
UPDATE "ContractContainer" SET "containerStatus" = 'DRAFT' WHERE "containerStatus" = 'PLANNED';

CREATE INDEX IF NOT EXISTS "ContractContainer_paymentStatus_idx" ON "ContractContainer"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Contract_createdById_idx" ON "Contract"("createdById");

-- Multi-product rows inside a container
CREATE TABLE IF NOT EXISTS "ContractContainerProduct" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "productIndex" INTEGER NOT NULL DEFAULT 1,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "processingType" TEXT,
    "specification" TEXT,
    "quantityMt" DOUBLE PRECISION NOT NULL,
    "packagingTypeId" TEXT,
    "packagingSizeId" TEXT,
    "packingDescription" TEXT,
    "packingSizeValue" DOUBLE PRECISION,
    "packingSizeUnit" TEXT,
    "productRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractContainerProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContractContainerProduct_containerId_productIndex_key" ON "ContractContainerProduct"("containerId", "productIndex");
CREATE INDEX IF NOT EXISTS "ContractContainerProduct_contractId_idx" ON "ContractContainerProduct"("contractId");
CREATE INDEX IF NOT EXISTS "ContractContainerProduct_containerId_idx" ON "ContractContainerProduct"("containerId");
CREATE INDEX IF NOT EXISTS "ContractContainerProduct_productId_idx" ON "ContractContainerProduct"("productId");

DO $$ BEGIN
  ALTER TABLE "ContractContainerProduct" ADD CONSTRAINT "ContractContainerProduct_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ContractContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractContainerProduct" ADD CONSTRAINT "ContractContainerProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractContainerProduct" ADD CONSTRAINT "ContractContainerProduct_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractContainerProduct" ADD CONSTRAINT "ContractContainerProduct_packagingTypeId_fkey" FOREIGN KEY ("packagingTypeId") REFERENCES "PackagingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractContainerProduct" ADD CONSTRAINT "ContractContainerProduct_packagingSizeId_fkey" FOREIGN KEY ("packagingSizeId") REFERENCES "PackagingSize"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill one product row per existing container
INSERT INTO "ContractContainerProduct" (
  "id", "contractId", "containerId", "productIndex", "productId", "productVariantId",
  "processingType", "specification", "quantityMt", "packagingTypeId", "packagingSizeId",
  "packingDescription", "packingSizeValue", "packingSizeUnit", "productRemarks", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  c."contractId",
  c."id",
  1,
  c."productId",
  c."productVariantId",
  c."processingType",
  c."specification",
  COALESCE(c."quantityMt", 0),
  c."packagingTypeId",
  c."packagingSizeId",
  c."packingDescription",
  c."packingSizeValue",
  c."packingSizeUnit",
  c."productRemarks",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ContractContainer" c
WHERE NOT EXISTS (
  SELECT 1 FROM "ContractContainerProduct" p WHERE p."containerId" = c."id"
);

-- Salesperson attribution
CREATE TABLE IF NOT EXISTS "ContractSalesAttribution" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "salespersonId" TEXT NOT NULL,
    "contributionPct" DOUBLE PRECISION,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContractSalesAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContractSalesAttribution_contractId_salespersonId_key" ON "ContractSalesAttribution"("contractId", "salespersonId");
CREATE INDEX IF NOT EXISTS "ContractSalesAttribution_contractId_idx" ON "ContractSalesAttribution"("contractId");
CREATE INDEX IF NOT EXISTS "ContractSalesAttribution_salespersonId_idx" ON "ContractSalesAttribution"("salespersonId");

DO $$ BEGIN
  ALTER TABLE "ContractSalesAttribution" ADD CONSTRAINT "ContractSalesAttribution_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractSalesAttribution" ADD CONSTRAINT "ContractSalesAttribution_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContractSalesAttribution" ADD CONSTRAINT "ContractSalesAttribution_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill attributions from legacy salespersonId
INSERT INTO "ContractSalesAttribution" ("id", "contractId", "salespersonId", "createdAt")
SELECT gen_random_uuid()::text, c."id", c."salespersonId", CURRENT_TIMESTAMP
FROM "Contract" c
WHERE c."salespersonId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ContractSalesAttribution" a
    WHERE a."contractId" = c."id" AND a."salespersonId" = c."salespersonId"
  );

-- Container status history
CREATE TABLE IF NOT EXISTS "ContainerStatusHistory" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "updatedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContainerStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContainerStatusHistory_containerId_idx" ON "ContainerStatusHistory"("containerId");
CREATE INDEX IF NOT EXISTS "ContainerStatusHistory_contractId_idx" ON "ContainerStatusHistory"("contractId");

DO $$ BEGIN
  ALTER TABLE "ContainerStatusHistory" ADD CONSTRAINT "ContainerStatusHistory_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "ContractContainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContainerStatusHistory" ADD CONSTRAINT "ContainerStatusHistory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Commercial amendment extras
ALTER TABLE "ContainerCommercialAmendment" ADD COLUMN IF NOT EXISTS "priceType" TEXT NOT NULL DEFAULT 'CIF_CNF';
ALTER TABLE "ContainerCommercialAmendment" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

-- Notification extras
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "oldValue" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "newValue" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "changedById" TEXT;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
