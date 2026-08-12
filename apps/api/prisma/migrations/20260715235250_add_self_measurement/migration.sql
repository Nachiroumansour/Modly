-- CreateTable
CREATE TABLE "self_measurements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "self_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "self_measurements_userId_key" ON "self_measurements"("userId");

-- AddForeignKey
ALTER TABLE "self_measurements" ADD CONSTRAINT "self_measurements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
