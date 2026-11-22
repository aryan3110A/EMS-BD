-- ERP Changes 22.11.26: container workflow, sampling details, production soft delete.
-- Additive only: new nullable columns / defaults, one label rename, one permission grant.

-- User: production delete permission
ALTER TABLE "User" ADD COLUMN "canDeleteProduction" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "canDeleteProduction" = true WHERE lower("email") = 'bhramanwada.prod@ems.com';

-- ContractContainer: container details, fulfilment / sampling / dispatch timestamps
ALTER TABLE "ContractContainer"
  ADD COLUMN "shippingLineName" TEXT,
  ADD COLUMN "containerDetailsRemarks" TEXT,
  ADD COLUMN "detailsUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "detailsUpdatedById" TEXT,
  ADD COLUMN "detailsCompletedAt" TIMESTAMP(3),
  ADD COLUMN "firstAllocatedAt" TIMESTAMP(3),
  ADD COLUMN "fulfilledAt" TIMESTAMP(3),
  ADD COLUMN "samplingStartedAt" TIMESTAMP(3),
  ADD COLUMN "readyForDispatchAt" TIMESTAMP(3),
  ADD COLUMN "readyForDispatchById" TEXT,
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "dispatchedById" TEXT,
  ADD COLUMN "dispatchRemarks" TEXT;

-- SampleRecord: sampling details + separate approval
ALTER TABLE "SampleRecord"
  ADD COLUMN "samplingType" TEXT,
  ADD COLUMN "sampleReference" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT;

-- ProductionRun: soft delete + output classification
ALTER TABLE "ProductionRun"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "deleteReason" TEXT,
  ADD COLUMN "outputStockCategory" TEXT;
CREATE INDEX "ProductionRun_deletedAt_idx" ON "ProductionRun"("deletedAt");

-- Backfill: existing processed lots were final output
UPDATE "ProductionRun" r SET "outputStockCategory" = 'PROCESSED_AVAILABLE'
  WHERE r."finalisedAt" IS NOT NULL AND r."outputStockCategory" IS NULL;

-- Backfill first allocation date for containers that already have allocations
UPDATE "ContractContainer" c SET "firstAllocatedAt" = a.first_at
  FROM (SELECT "containerId", min("allocationDate") AS first_at FROM "ContainerAllocation" GROUP BY "containerId") a
  WHERE a."containerId" = c.id AND c."firstAllocatedAt" IS NULL;

-- Stage 2 rejection category rename: Mati -> Barik (same row, so history keeps its quantities)
UPDATE "WastageType" SET "nameEn" = 'Barik' WHERE "code" = 'HUL-MATI';
