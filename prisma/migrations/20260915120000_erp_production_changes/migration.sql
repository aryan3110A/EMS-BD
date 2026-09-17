-- ERP Changes 10.09.26: Production / Fulfilment separation, Wastage lots, Job Work

-- Product defaults
ALTER TABLE "Product" ALTER COLUMN "defaultUnit" SET DEFAULT 'KG';
ALTER TABLE "Product" ALTER COLUMN "allowsFullProcess" SET DEFAULT false;

-- Raw material / transfer unit defaults
ALTER TABLE "RawMaterialInward" ALTER COLUMN "inputUnit" SET DEFAULT 'KG';
ALTER TABLE "PlantTransfer" ALTER COLUMN "inputUnit" SET DEFAULT 'KG';
ALTER TABLE "ProductionInput" ALTER COLUMN "inputUnit" SET DEFAULT 'KG';

-- ProductionInput: wastage lot source
ALTER TABLE "ProductionInput" ADD COLUMN IF NOT EXISTS "wastageLotId" TEXT;

-- Cleaning / Hulling disposition columns
ALTER TABLE "CleaningWastageEntry" ADD COLUMN IF NOT EXISTS "disposition" TEXT;
ALTER TABLE "HullingWastageEntry" ADD COLUMN IF NOT EXISTS "disposition" TEXT;

-- ProductionRun metadata
ALTER TABLE "ProductionRun" ADD COLUMN IF NOT EXISTS "finalisedAt" TIMESTAMP(3);
ALTER TABLE "ProductionRun" ADD COLUMN IF NOT EXISTS "productionSource" TEXT NOT NULL DEFAULT 'IN_HOUSE';
ALTER TABLE "ProductionRun" ADD COLUMN IF NOT EXISTS "jobWorkId" TEXT;
ALTER TABLE "ProductionRun" ADD COLUMN IF NOT EXISTS "parentWastageLotId" TEXT;
ALTER TABLE "ProductionRun" ADD COLUMN IF NOT EXISTS "sampleRejectedLotId" TEXT;
ALTER TABLE "ProductionRun" ADD COLUMN IF NOT EXISTS "reprocessingCycle" INTEGER NOT NULL DEFAULT 0;

-- ProcessedOutputLot: optional run + metadata
ALTER TABLE "ProcessedOutputLot" ALTER COLUMN "productionRunId" DROP NOT NULL;
ALTER TABLE "ProcessedOutputLot" ADD COLUMN IF NOT EXISTS "productionSource" TEXT NOT NULL DEFAULT 'IN_HOUSE';
ALTER TABLE "ProcessedOutputLot" ADD COLUMN IF NOT EXISTS "jobWorkId" TEXT;
ALTER TABLE "ProcessedOutputLot" ADD COLUMN IF NOT EXISTS "parentWastageLotId" TEXT;
ALTER TABLE "ProcessedOutputLot" ADD COLUMN IF NOT EXISTS "sampleRejectedLotId" TEXT;
ALTER TABLE "ProcessedOutputLot" ADD COLUMN IF NOT EXISTS "reprocessingCycle" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "WastageLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "wastageTypeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "availableKg" DOUBLE PRECISION NOT NULL,
    "reprocessedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discardedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productionRunId" TEXT,
    "jobWorkId" TEXT,
    "parentWastageLotId" TEXT,
    "originalProductionRunId" TEXT,
    "processType" TEXT,
    "reprocessingCycle" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "productionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WastageLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WastageLot_lotNumber_key" ON "WastageLot"("lotNumber");
CREATE INDEX IF NOT EXISTS "WastageLot_productId_locationId_status_idx" ON "WastageLot"("productId", "locationId", "status");
CREATE INDEX IF NOT EXISTS "WastageLot_wastageTypeId_idx" ON "WastageLot"("wastageTypeId");
CREATE INDEX IF NOT EXISTS "WastageLot_productionRunId_idx" ON "WastageLot"("productionRunId");
CREATE INDEX IF NOT EXISTS "WastageLot_jobWorkId_idx" ON "WastageLot"("jobWorkId");

CREATE TABLE IF NOT EXISTS "ProductionWastageDisposition" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "wastageTypeId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "action" TEXT NOT NULL,
    "wastageLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionWastageDisposition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionWastageDisposition_productionRunId_wastageTypeId_key"
  ON "ProductionWastageDisposition"("productionRunId", "wastageTypeId");
CREATE INDEX IF NOT EXISTS "ProductionWastageDisposition_productionRunId_idx"
  ON "ProductionWastageDisposition"("productionRunId");

CREATE TABLE IF NOT EXISTS "JobWorker" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobWorker_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobWorker_code_key" ON "JobWorker"("code");
CREATE INDEX IF NOT EXISTS "JobWorker_isActive_idx" ON "JobWorker"("isActive");

CREATE TABLE IF NOT EXISTS "JobWork" (
    "id" TEXT NOT NULL,
    "jobWorkNumber" TEXT NOT NULL,
    "jobWorkerId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closeVarianceKg" DOUBLE PRECISION,
    "closeVarianceReason" TEXT,
    "remarks" TEXT,
    "totalSentKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProcessedInputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netProcessedOutputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWastageKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastageAlert" BOOLEAN NOT NULL DEFAULT false,
    "processResultEnteredAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobWork_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobWork_jobWorkNumber_key" ON "JobWork"("jobWorkNumber");
CREATE INDEX IF NOT EXISTS "JobWork_status_idx" ON "JobWork"("status");
CREATE INDEX IF NOT EXISTS "JobWork_productId_idx" ON "JobWork"("productId");
CREATE INDEX IF NOT EXISTS "JobWork_jobWorkerId_idx" ON "JobWork"("jobWorkerId");
CREATE INDEX IF NOT EXISTS "JobWork_startDate_idx" ON "JobWork"("startDate");

CREATE TABLE IF NOT EXISTS "JobWorkOutward" (
    "id" TEXT NOT NULL,
    "outwardNumber" TEXT NOT NULL,
    "jobWorkId" TEXT NOT NULL,
    "outwardDate" TIMESTAMP(3) NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "numberOfBags" INTEGER,
    "truckNumber" TEXT,
    "challanNumber" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobWorkOutward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobWorkOutward_outwardNumber_key" ON "JobWorkOutward"("outwardNumber");
CREATE INDEX IF NOT EXISTS "JobWorkOutward_jobWorkId_idx" ON "JobWorkOutward"("jobWorkId");

CREATE TABLE IF NOT EXISTS "JobWorkInward" (
    "id" TEXT NOT NULL,
    "inwardNumber" TEXT NOT NULL,
    "jobWorkId" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "receivingLocationId" TEXT NOT NULL,
    "truckNumber" TEXT,
    "challanNumber" TEXT,
    "remarks" TEXT,
    "receivedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobWorkInward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobWorkInward_inwardNumber_key" ON "JobWorkInward"("inwardNumber");
CREATE INDEX IF NOT EXISTS "JobWorkInward_jobWorkId_idx" ON "JobWorkInward"("jobWorkId");

CREATE TABLE IF NOT EXISTS "JobWorkInwardLine" (
    "id" TEXT NOT NULL,
    "inwardId" TEXT NOT NULL,
    "returnCategory" TEXT NOT NULL,
    "wastageTypeId" TEXT,
    "productId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "numberOfBags" INTEGER,
    "remarks" TEXT,
    CONSTRAINT "JobWorkInwardLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JobWorkInwardLine_inwardId_idx" ON "JobWorkInwardLine"("inwardId");
CREATE INDEX IF NOT EXISTS "JobWorkInwardLine_returnCategory_idx" ON "JobWorkInwardLine"("returnCategory");

CREATE TABLE IF NOT EXISTS "JobWorkWastageDisposition" (
    "id" TEXT NOT NULL,
    "jobWorkId" TEXT NOT NULL,
    "wastageTypeId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "disposition" TEXT NOT NULL,
    CONSTRAINT "JobWorkWastageDisposition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobWorkWastageDisposition_jobWorkId_wastageTypeId_key"
  ON "JobWorkWastageDisposition"("jobWorkId", "wastageTypeId");

-- Foreign keys (IF NOT EXISTS via DO blocks for idempotency)
DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_wastageLotId_fkey"
    FOREIGN KEY ("wastageLotId") REFERENCES "WastageLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WastageLot" ADD CONSTRAINT "WastageLot_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WastageLot" ADD CONSTRAINT "WastageLot_wastageTypeId_fkey"
    FOREIGN KEY ("wastageTypeId") REFERENCES "WastageType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WastageLot" ADD CONSTRAINT "WastageLot_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WastageLot" ADD CONSTRAINT "WastageLot_productionRunId_fkey"
    FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WastageLot" ADD CONSTRAINT "WastageLot_jobWorkId_fkey"
    FOREIGN KEY ("jobWorkId") REFERENCES "JobWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "WastageLot" ADD CONSTRAINT "WastageLot_parentWastageLotId_fkey"
    FOREIGN KEY ("parentWastageLotId") REFERENCES "WastageLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionWastageDisposition" ADD CONSTRAINT "ProductionWastageDisposition_productionRunId_fkey"
    FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionWastageDisposition" ADD CONSTRAINT "ProductionWastageDisposition_wastageLotId_fkey"
    FOREIGN KEY ("wastageLotId") REFERENCES "WastageLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_jobWorkId_fkey"
    FOREIGN KEY ("jobWorkId") REFERENCES "JobWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_parentWastageLotId_fkey"
    FOREIGN KEY ("parentWastageLotId") REFERENCES "WastageLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProcessedOutputLot" ADD CONSTRAINT "ProcessedOutputLot_jobWorkId_fkey"
    FOREIGN KEY ("jobWorkId") REFERENCES "JobWork"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProcessedOutputLot" ADD CONSTRAINT "ProcessedOutputLot_parentWastageLotId_fkey"
    FOREIGN KEY ("parentWastageLotId") REFERENCES "WastageLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ProcessedOutputLot_jobWorkId_idx" ON "ProcessedOutputLot"("jobWorkId");
CREATE INDEX IF NOT EXISTS "ProcessedOutputLot_productionSource_idx" ON "ProcessedOutputLot"("productionSource");
CREATE INDEX IF NOT EXISTS "ProductionRun_jobWorkId_idx" ON "ProductionRun"("jobWorkId");
CREATE INDEX IF NOT EXISTS "ProductionInput_wastageLotId_idx" ON "ProductionInput"("wastageLotId");

DO $$ BEGIN
  ALTER TABLE "JobWork" ADD CONSTRAINT "JobWork_jobWorkerId_fkey"
    FOREIGN KEY ("jobWorkerId") REFERENCES "JobWorker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWork" ADD CONSTRAINT "JobWork_sourceLocationId_fkey"
    FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWork" ADD CONSTRAINT "JobWork_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWork" ADD CONSTRAINT "JobWork_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWork" ADD CONSTRAINT "JobWork_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobWorkOutward" ADD CONSTRAINT "JobWorkOutward_jobWorkId_fkey"
    FOREIGN KEY ("jobWorkId") REFERENCES "JobWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWorkOutward" ADD CONSTRAINT "JobWorkOutward_sourceLocationId_fkey"
    FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWorkOutward" ADD CONSTRAINT "JobWorkOutward_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobWorkInward" ADD CONSTRAINT "JobWorkInward_jobWorkId_fkey"
    FOREIGN KEY ("jobWorkId") REFERENCES "JobWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWorkInward" ADD CONSTRAINT "JobWorkInward_receivingLocationId_fkey"
    FOREIGN KEY ("receivingLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWorkInward" ADD CONSTRAINT "JobWorkInward_receivedById_fkey"
    FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobWorkInwardLine" ADD CONSTRAINT "JobWorkInwardLine_inwardId_fkey"
    FOREIGN KEY ("inwardId") REFERENCES "JobWorkInward"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWorkInwardLine" ADD CONSTRAINT "JobWorkInwardLine_wastageTypeId_fkey"
    FOREIGN KEY ("wastageTypeId") REFERENCES "WastageType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "JobWorkWastageDisposition" ADD CONSTRAINT "JobWorkWastageDisposition_jobWorkId_fkey"
    FOREIGN KEY ("jobWorkId") REFERENCES "JobWork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "JobWorkWastageDisposition" ADD CONSTRAINT "JobWorkWastageDisposition_wastageTypeId_fkey"
    FOREIGN KEY ("wastageTypeId") REFERENCES "WastageType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
