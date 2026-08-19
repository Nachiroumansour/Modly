-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('INSPIRATION', 'ORIGINAL');

-- AlterTable
ALTER TABLE "designs" ADD COLUMN     "postType" "PostType" NOT NULL DEFAULT 'INSPIRATION',
ADD COLUMN     "sourceCredit" TEXT;
