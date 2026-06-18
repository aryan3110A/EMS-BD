-- Per-container shipment fields
ALTER TABLE "ContractContainer" ADD COLUMN "destinationPortId" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN "expectedShipmentDate" TIMESTAMP(3);
ALTER TABLE "ContractContainer" ADD COLUMN "shipmentMonth" TEXT;
ALTER TABLE "ContractContainer" ADD COLUMN "shipmentYear" INTEGER;
ALTER TABLE "ContractContainer" ADD COLUMN "shipmentHalf" TEXT;

ALTER TABLE "ContractContainer"
  ADD CONSTRAINT "ContractContainer_destinationPortId_fkey"
  FOREIGN KEY ("destinationPortId") REFERENCES "Port"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContractContainer_destinationPortId_idx" ON "ContractContainer"("destinationPortId");
