-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('EN_ATTENTE', 'TISSU_RECU', 'COUPE', 'COUTURE', 'FINITIONS', 'PRET', 'LIVREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('EN_ATTENTE', 'ACOMPTE', 'PAYE');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tailorId" TEXT NOT NULL,
    "designId" TEXT,
    "clientRecordId" TEXT,
    "measurementsSnapshot" JSONB,
    "note" TEXT,
    "agreedPrice" INTEGER,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "status" "OrderStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "estimatedDelivery" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_clientId_idx" ON "orders"("clientId");

-- CreateIndex
CREATE INDEX "orders_tailorId_idx" ON "orders"("tailorId");

-- CreateIndex
CREATE INDEX "order_events_orderId_idx" ON "order_events"("orderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clientRecordId_fkey" FOREIGN KEY ("clientRecordId") REFERENCES "client_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
