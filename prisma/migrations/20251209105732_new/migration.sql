/*
  Warnings:

  - You are about to drop the column `kelasPerkuliahanId` on the `Pengumuman` table. All the data in the column will be lost.
  - You are about to drop the `Semester` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('KELAS', 'UAS', 'EVENT');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'KOORPRODI';

-- DropForeignKey
ALTER TABLE "Pengumuman" DROP CONSTRAINT "Pengumuman_kelasPerkuliahanId_fkey";

-- AlterTable
ALTER TABLE "KRS" ADD COLUMN     "kelasPerkuliahanId" INTEGER;

-- AlterTable
ALTER TABLE "Pengumuman" DROP COLUMN "kelasPerkuliahanId",
ADD COLUMN     "isGlobal" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "Semester";

-- CreateTable
CREATE TABLE "PresensiSession" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" "SessionType" NOT NULL DEFAULT 'KELAS',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "token" TEXT NOT NULL,
    "kelasPerkuliahanId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresensiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresensiRecord" (
    "id" SERIAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'TOKEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" INTEGER NOT NULL,
    "mahasiswaId" INTEGER NOT NULL,

    CONSTRAINT "PresensiRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KelasPerkuliahanToPengumuman" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_KelasPerkuliahanToPengumuman_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresensiSession_token_key" ON "PresensiSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PresensiRecord_sessionId_mahasiswaId_key" ON "PresensiRecord"("sessionId", "mahasiswaId");

-- CreateIndex
CREATE INDEX "_KelasPerkuliahanToPengumuman_B_index" ON "_KelasPerkuliahanToPengumuman"("B");

-- AddForeignKey
ALTER TABLE "PresensiSession" ADD CONSTRAINT "PresensiSession_kelasPerkuliahanId_fkey" FOREIGN KEY ("kelasPerkuliahanId") REFERENCES "KelasPerkuliahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresensiRecord" ADD CONSTRAINT "PresensiRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PresensiSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresensiRecord" ADD CONSTRAINT "PresensiRecord_mahasiswaId_fkey" FOREIGN KEY ("mahasiswaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KelasPerkuliahanToPengumuman" ADD CONSTRAINT "_KelasPerkuliahanToPengumuman_A_fkey" FOREIGN KEY ("A") REFERENCES "KelasPerkuliahan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KelasPerkuliahanToPengumuman" ADD CONSTRAINT "_KelasPerkuliahanToPengumuman_B_fkey" FOREIGN KEY ("B") REFERENCES "Pengumuman"("id") ON DELETE CASCADE ON UPDATE CASCADE;
