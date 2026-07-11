-- CreateEnum
CREATE TYPE "MeasurementSource" AS ENUM ('MANUELLE', 'IA');

-- CreateTable
CREATE TABLE "client_records" (
    "id" TEXT NOT NULL,
    "tailorId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "stylePref" TEXT,
    "tissuPref" TEXT,
    "coupePref" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" TEXT NOT NULL,
    "clientRecordId" TEXT NOT NULL,
    "source" "MeasurementSource" NOT NULL DEFAULT 'MANUELLE',
    "tourPoitrine" DOUBLE PRECISION,
    "tourTaille" DOUBLE PRECISION,
    "tourHanches" DOUBLE PRECISION,
    "largeurEpaules" DOUBLE PRECISION,
    "longueurBras" DOUBLE PRECISION,
    "tourBras" DOUBLE PRECISION,
    "tourCou" DOUBLE PRECISION,
    "entrejambe" DOUBLE PRECISION,
    "longueurJambe" DOUBLE PRECISION,
    "longueurBoubou" DOUBLE PRECISION,
    "longueurChemise" DOUBLE PRECISION,
    "tourCuisse" DOUBLE PRECISION,
    "tourPoignet" DOUBLE PRECISION,
    "carrureDos" DOUBLE PRECISION,
    "longueurManche" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_records_tailorId_idx" ON "client_records"("tailorId");

-- CreateIndex
CREATE INDEX "measurements_clientRecordId_idx" ON "measurements"("clientRecordId");

-- AddForeignKey
ALTER TABLE "client_records" ADD CONSTRAINT "client_records_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_records" ADD CONSTRAINT "client_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_clientRecordId_fkey" FOREIGN KEY ("clientRecordId") REFERENCES "client_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
