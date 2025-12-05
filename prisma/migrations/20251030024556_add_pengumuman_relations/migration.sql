/*
  Warnings:

  - You are about to drop the column `target` on the `Pengumuman` table. All the data in the column will be lost.
  - Added the required column `dosenId` to the `Pengumuman` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pengumuman" DROP COLUMN "target",
ADD COLUMN     "dosenId" INTEGER NOT NULL,
ADD COLUMN     "kelasPerkuliahanId" INTEGER;

-- AddForeignKey
ALTER TABLE "Pengumuman" ADD CONSTRAINT "Pengumuman_dosenId_fkey" FOREIGN KEY ("dosenId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pengumuman" ADD CONSTRAINT "Pengumuman_kelasPerkuliahanId_fkey" FOREIGN KEY ("kelasPerkuliahanId") REFERENCES "KelasPerkuliahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
