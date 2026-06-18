-- CreateTable
CREATE TABLE "ContractContainer" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "containerIndex" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "processingType" TEXT,
    "specification" TEXT,
    "productRemarks" TEXT,
    "quantityMt" DOUBLE PRECISION,
    "containerNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractContainer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractContainer_contractId_containerIndex_key" ON "ContractContainer"("contractId", "containerIndex");

-- CreateIndex
CREATE INDEX "ContractContainer_contractId_idx" ON "ContractContainer"("contractId");

-- AddForeignKey
ALTER TABLE "ContractContainer" ADD CONSTRAINT "ContractContainer_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractContainer" ADD CONSTRAINT "ContractContainer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractContainer" ADD CONSTRAINT "ContractContainer_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
