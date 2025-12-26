-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "settings" JSONB;

-- CreateIndex
CREATE INDEX "documents_ownerId_folderId_idx" ON "documents"("ownerId", "folderId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
