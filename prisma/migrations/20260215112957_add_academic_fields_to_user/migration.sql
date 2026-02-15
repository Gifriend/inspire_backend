/*
  Warnings:

  - You are about to drop the column `semester` on the `KRS` table. All the data in the column will be lost.
  - You are about to drop the column `semester` on the `KelasPerkuliahan` table. All the data in the column will be lost.
  - You are about to drop the column `semester` on the `Nilai` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[mahasiswaId,academicYear]` on the table `KRS` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mahasiswaId,mataKuliahId,academicYear]` on the table `Nilai` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `academicYear` to the `KRS` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicYear` to the `KelasPerkuliahan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `academicYear` to the `Nilai` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "KRS_mahasiswaId_semester_key";

-- DropIndex
DROP INDEX "Nilai_mahasiswaId_mataKuliahId_semester_key";

-- AlterTable
ALTER TABLE "KRS" DROP COLUMN "semester",
ADD COLUMN     "academicYear" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "KelasPerkuliahan" DROP COLUMN "semester",
ADD COLUMN     "academicYear" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Nilai" DROP COLUMN "semester",
ADD COLUMN     "academicYear" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ipk" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "semesterTerakhir" TEXT,
ADD COLUMN     "totalSksLulus" INTEGER DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "KRS_mahasiswaId_academicYear_key" ON "KRS"("mahasiswaId", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "Nilai_mahasiswaId_mataKuliahId_academicYear_key" ON "Nilai"("mahasiswaId", "mataKuliahId", "academicYear");
