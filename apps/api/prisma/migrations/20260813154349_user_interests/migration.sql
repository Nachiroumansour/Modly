-- AlterTable
ALTER TABLE "users" ADD COLUMN     "interests" "DesignCategory"[] DEFAULT ARRAY[]::"DesignCategory"[];
