-- CreateEnum
CREATE TYPE "DesignCategory" AS ENUM ('BOUBOU', 'ROBE', 'ENSEMBLE', 'ENFANT', 'MARIAGE', 'TABASKI', 'KORITE', 'MAGAL');

-- CreateTable
CREATE TABLE "designs" (
    "id" TEXT NOT NULL,
    "tailorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DesignCategory" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarksCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "tailorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "designs_category_idx" ON "designs"("category");

-- CreateIndex
CREATE INDEX "designs_tailorId_idx" ON "designs"("tailorId");

-- CreateIndex
CREATE UNIQUE INDEX "likes_userId_designId_key" ON "likes"("userId", "designId");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_designId_key" ON "bookmarks"("userId", "designId");

-- CreateIndex
CREATE INDEX "comments_designId_idx" ON "comments"("designId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_tailorId_key" ON "follows"("followerId", "tailorId");

-- AddForeignKey
ALTER TABLE "designs" ADD CONSTRAINT "designs_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_designId_fkey" FOREIGN KEY ("designId") REFERENCES "designs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
