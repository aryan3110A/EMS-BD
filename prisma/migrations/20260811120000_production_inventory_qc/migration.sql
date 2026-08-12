-- Production / Inventory / QC: Product flags + new domain tables

-- ─── Product new columns ─────────────────────────────────────────────────────

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "defaultUnit" TEXT NOT NULL DEFAULT 'MT';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "allowsFullProcess" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "allowsSortex" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "samplingNormallyApplicable" BOOLEAN NOT NULL DEFAULT false;

-- ─── Lookup / master tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Supplier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InwardType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiresDesc" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InwardType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WastageType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameLocal" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WastageType_pkey" PRIMARY KEY ("id")
);

-- ─── Raw material inward & inventory ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RawMaterialInward" (
    "id" TEXT NOT NULL,
    "inwardNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "inwardDate" TIMESTAMP(3) NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "numberOfBags" INTEGER NOT NULL DEFAULT 0,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "inputUnit" TEXT NOT NULL DEFAULT 'MT',
    "price" DOUBLE PRECISION,
    "inwardTypeId" TEXT NOT NULL,
    "otherTypeDesc" TEXT,
    "locationId" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawMaterialInward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryBalance" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "stockCategory" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryLedgerEntry" (
    "id" TEXT NOT NULL,
    "txnNumber" TEXT NOT NULL,
    "txnType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stockCategory" TEXT NOT NULL,
    "sourceLocationId" TEXT,
    "destLocationId" TEXT,
    "quantityInKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantityOutKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceKg" DOUBLE PRECISION,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- ─── Production run & wastage ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ProductionRun" (
    "id" TEXT NOT NULL,
    "productionNumber" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "completionDate" TIMESTAMP(3),
    "daysSpanned" INTEGER,
    "totalInputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cleaningWastageKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hullingInputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hullingWastageKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hullingWastagePct" DOUBLE PRECISION,
    "netOutputKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocatedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storedProcessedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastageAlert" BOOLEAN NOT NULL DEFAULT false,
    "cleaningFinalizedAt" TIMESTAMP(3),
    "hullingFinalizedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CleaningWastageEntry" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "wastageTypeId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "inputUnit" TEXT NOT NULL DEFAULT 'KG',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningWastageEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HullingWastageEntry" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "wastageTypeId" TEXT NOT NULL,
    "numberOfBags" DOUBLE PRECISION,
    "weightPerBagKg" DOUBLE PRECISION,
    "directQtyKg" DOUBLE PRECISION,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "inputUnit" TEXT NOT NULL DEFAULT 'KG',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HullingWastageEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProcessedOutputLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "availableKg" DOUBLE PRECISION NOT NULL,
    "reservedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "completionDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedOutputLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ContainerAllocation" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT,
    "processedLotId" TEXT,
    "contractId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "containerProductId" TEXT,
    "productId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "allocationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SampleRecord" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "allocationId" TEXT,
    "productionRunId" TEXT,
    "processedLotId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_SAMPLING',
    "collectionDate" TIMESTAMP(3),
    "testingAgency" TEXT,
    "resultDate" TIMESTAMP(3),
    "result" TEXT,
    "reportReference" TEXT,
    "reportPath" TEXT,
    "remarks" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SampleRejectedLot" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "availableKg" DOUBLE PRECISION NOT NULL,
    "reprocessedKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transferredKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plantId" TEXT NOT NULL,
    "productionRunId" TEXT,
    "contractId" TEXT,
    "containerId" TEXT,
    "sampleRecordId" TEXT,
    "failureDate" TIMESTAMP(3) NOT NULL,
    "failureRemarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE_FOR_SORTEX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleRejectedLot_pkey" PRIMARY KEY ("id")
);

-- ProductionInput after SampleRejectedLot / ProcessedOutputLot (optional FKs)
CREATE TABLE IF NOT EXISTS "ProductionInput" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "inputDate" TIMESTAMP(3) NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "inwardId" TEXT,
    "stockCategory" TEXT NOT NULL DEFAULT 'NORMAL_RAW_MATERIAL',
    "rejectedLotId" TEXT,
    "processedLotId" TEXT,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "inputUnit" TEXT NOT NULL DEFAULT 'MT',
    "isAdditional" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionInput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlantTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destLocationId" TEXT NOT NULL,
    "stockCategory" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "processedLotId" TEXT,
    "rejectedLotId" TEXT,
    "productionRunId" TEXT,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "inputUnit" TEXT NOT NULL DEFAULT 'MT',
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "dispatchDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "receivedById" TEXT,
    "linkedInwardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductionAuditLog" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordNumber" TEXT,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionAuditLog_pkey" PRIMARY KEY ("id")
);

-- ─── Unique indexes ──────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "Supplier_code_key" ON "Supplier"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLocation_code_key" ON "InventoryLocation"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "InwardType_code_key" ON "InwardType"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "WastageType_code_key" ON "WastageType"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "RawMaterialInward_inwardNumber_key" ON "RawMaterialInward"("inwardNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBalance_productId_locationId_stockCategory_key" ON "InventoryBalance"("productId", "locationId", "stockCategory");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryLedgerEntry_txnNumber_key" ON "InventoryLedgerEntry"("txnNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionRun_productionNumber_key" ON "ProductionRun"("productionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CleaningWastageEntry_productionRunId_wastageTypeId_key" ON "CleaningWastageEntry"("productionRunId", "wastageTypeId");
CREATE UNIQUE INDEX IF NOT EXISTS "HullingWastageEntry_productionRunId_wastageTypeId_key" ON "HullingWastageEntry"("productionRunId", "wastageTypeId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProcessedOutputLot_lotNumber_key" ON "ProcessedOutputLot"("lotNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "SampleRejectedLot_lotNumber_key" ON "SampleRejectedLot"("lotNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PlantTransfer_transferNumber_key" ON "PlantTransfer"("transferNumber");

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "Supplier_isActive_idx" ON "Supplier"("isActive");
CREATE INDEX IF NOT EXISTS "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");
CREATE INDEX IF NOT EXISTS "WastageType_stage_isActive_idx" ON "WastageType"("stage", "isActive");

CREATE INDEX IF NOT EXISTS "RawMaterialInward_inwardDate_idx" ON "RawMaterialInward"("inwardDate");
CREATE INDEX IF NOT EXISTS "RawMaterialInward_supplierId_idx" ON "RawMaterialInward"("supplierId");
CREATE INDEX IF NOT EXISTS "RawMaterialInward_productId_idx" ON "RawMaterialInward"("productId");
CREATE INDEX IF NOT EXISTS "RawMaterialInward_locationId_idx" ON "RawMaterialInward"("locationId");
CREATE INDEX IF NOT EXISTS "RawMaterialInward_truckNumber_idx" ON "RawMaterialInward"("truckNumber");

CREATE INDEX IF NOT EXISTS "InventoryBalance_stockCategory_idx" ON "InventoryBalance"("stockCategory");

CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_productId_stockCategory_idx" ON "InventoryLedgerEntry"("productId", "stockCategory");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_txnType_idx" ON "InventoryLedgerEntry"("txnType");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_createdAt_idx" ON "InventoryLedgerEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryLedgerEntry_referenceId_idx" ON "InventoryLedgerEntry"("referenceId");

CREATE INDEX IF NOT EXISTS "ProductionRun_status_idx" ON "ProductionRun"("status");
CREATE INDEX IF NOT EXISTS "ProductionRun_plantId_idx" ON "ProductionRun"("plantId");
CREATE INDEX IF NOT EXISTS "ProductionRun_productId_idx" ON "ProductionRun"("productId");
CREATE INDEX IF NOT EXISTS "ProductionRun_startDate_idx" ON "ProductionRun"("startDate");
CREATE INDEX IF NOT EXISTS "ProductionRun_wastageAlert_idx" ON "ProductionRun"("wastageAlert");

CREATE INDEX IF NOT EXISTS "ProductionInput_productionRunId_idx" ON "ProductionInput"("productionRunId");

CREATE INDEX IF NOT EXISTS "ProcessedOutputLot_productId_plantId_status_idx" ON "ProcessedOutputLot"("productId", "plantId", "status");
CREATE INDEX IF NOT EXISTS "ProcessedOutputLot_productionRunId_idx" ON "ProcessedOutputLot"("productionRunId");

CREATE INDEX IF NOT EXISTS "ContainerAllocation_contractId_containerId_idx" ON "ContainerAllocation"("contractId", "containerId");
CREATE INDEX IF NOT EXISTS "ContainerAllocation_productionRunId_idx" ON "ContainerAllocation"("productionRunId");
CREATE INDEX IF NOT EXISTS "ContainerAllocation_productId_idx" ON "ContainerAllocation"("productId");

CREATE INDEX IF NOT EXISTS "SampleRecord_containerId_idx" ON "SampleRecord"("containerId");
CREATE INDEX IF NOT EXISTS "SampleRecord_status_idx" ON "SampleRecord"("status");
CREATE INDEX IF NOT EXISTS "SampleRecord_contractId_idx" ON "SampleRecord"("contractId");

CREATE INDEX IF NOT EXISTS "SampleRejectedLot_status_idx" ON "SampleRejectedLot"("status");
CREATE INDEX IF NOT EXISTS "SampleRejectedLot_productId_plantId_idx" ON "SampleRejectedLot"("productId", "plantId");

CREATE INDEX IF NOT EXISTS "PlantTransfer_status_idx" ON "PlantTransfer"("status");
CREATE INDEX IF NOT EXISTS "PlantTransfer_sourceLocationId_idx" ON "PlantTransfer"("sourceLocationId");
CREATE INDEX IF NOT EXISTS "PlantTransfer_destLocationId_idx" ON "PlantTransfer"("destLocationId");

CREATE INDEX IF NOT EXISTS "ProductionAuditLog_module_idx" ON "ProductionAuditLog"("module");
CREATE INDEX IF NOT EXISTS "ProductionAuditLog_recordNumber_idx" ON "ProductionAuditLog"("recordNumber");
CREATE INDEX IF NOT EXISTS "ProductionAuditLog_createdAt_idx" ON "ProductionAuditLog"("createdAt");

-- ─── Foreign keys ────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "RawMaterialInward" ADD CONSTRAINT "RawMaterialInward_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RawMaterialInward" ADD CONSTRAINT "RawMaterialInward_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RawMaterialInward" ADD CONSTRAINT "RawMaterialInward_inwardTypeId_fkey" FOREIGN KEY ("inwardTypeId") REFERENCES "InwardType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RawMaterialInward" ADD CONSTRAINT "RawMaterialInward_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RawMaterialInward" ADD CONSTRAINT "RawMaterialInward_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RawMaterialInward" ADD CONSTRAINT "RawMaterialInward_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_destLocationId_fkey" FOREIGN KEY ("destLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionRun" ADD CONSTRAINT "ProductionRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CleaningWastageEntry" ADD CONSTRAINT "CleaningWastageEntry_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CleaningWastageEntry" ADD CONSTRAINT "CleaningWastageEntry_wastageTypeId_fkey" FOREIGN KEY ("wastageTypeId") REFERENCES "WastageType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HullingWastageEntry" ADD CONSTRAINT "HullingWastageEntry_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "HullingWastageEntry" ADD CONSTRAINT "HullingWastageEntry_wastageTypeId_fkey" FOREIGN KEY ("wastageTypeId") REFERENCES "WastageType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProcessedOutputLot" ADD CONSTRAINT "ProcessedOutputLot_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProcessedOutputLot" ADD CONSTRAINT "ProcessedOutputLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProcessedOutputLot" ADD CONSTRAINT "ProcessedOutputLot_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ContainerAllocation" ADD CONSTRAINT "ContainerAllocation_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContainerAllocation" ADD CONSTRAINT "ContainerAllocation_processedLotId_fkey" FOREIGN KEY ("processedLotId") REFERENCES "ProcessedOutputLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ContainerAllocation" ADD CONSTRAINT "ContainerAllocation_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "ContainerAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_processedLotId_fkey" FOREIGN KEY ("processedLotId") REFERENCES "ProcessedOutputLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRecord" ADD CONSTRAINT "SampleRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SampleRejectedLot" ADD CONSTRAINT "SampleRejectedLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRejectedLot" ADD CONSTRAINT "SampleRejectedLot_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRejectedLot" ADD CONSTRAINT "SampleRejectedLot_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SampleRejectedLot" ADD CONSTRAINT "SampleRejectedLot_sampleRecordId_fkey" FOREIGN KEY ("sampleRecordId") REFERENCES "SampleRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_inwardId_fkey" FOREIGN KEY ("inwardId") REFERENCES "RawMaterialInward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_rejectedLotId_fkey" FOREIGN KEY ("rejectedLotId") REFERENCES "SampleRejectedLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_processedLotId_fkey" FOREIGN KEY ("processedLotId") REFERENCES "ProcessedOutputLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductionInput" ADD CONSTRAINT "ProductionInput_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_destLocationId_fkey" FOREIGN KEY ("destLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_processedLotId_fkey" FOREIGN KEY ("processedLotId") REFERENCES "ProcessedOutputLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_rejectedLotId_fkey" FOREIGN KEY ("rejectedLotId") REFERENCES "SampleRejectedLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "ProductionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlantTransfer" ADD CONSTRAINT "PlantTransfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductionAuditLog" ADD CONSTRAINT "ProductionAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
