-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "designs" ADD COLUMN     "coverBlurhash" TEXT,
ADD COLUMN     "mediaCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "duration" INTEGER,
    "blurhash" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_designId_position_idx" ON "media"("designId", "position");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
