/*
  Warnings:

  - The values [MALE,FEMALE] on the enum `Gender` will be removed. If these variants are still used in the database, this will fail.
  - The values [ACTIVE,INACTIVE] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `fakultas` on the `Prodi` table. All the data in the column will be lost.
  - You are about to drop the `_MatakuliahToUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ProdiToUser` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[nip]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Fakultas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jenisMK` to the `Matakuliah` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kurikulumId` to the `Matakuliah` table without a default value. This is not possible if the table is not empty.
  - Added the required column `semester` to the `Matakuliah` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Matakuliah` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fakultasId` to the `Prodi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jenjang` to the `Prodi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Prodi` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fakultasId` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StatusMataKuliah" AS ENUM ('AKTIF', 'NON_AKTIF');

-- CreateEnum
CREATE TYPE "StatusKRS" AS ENUM ('DRAFT', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "StatusNilai" AS ENUM ('BELUM_ADA', 'SUDAH_ADA');

-- AlterEnum
BEGIN;
CREATE TYPE "Gender_new" AS ENUM ('LAKI_LAKI', 'PEREMPUAN');
ALTER TABLE "User" ALTER COLUMN "gender" TYPE "Gender_new" USING ("gender"::text::"Gender_new");
ALTER TYPE "Gender" RENAME TO "Gender_old";
ALTER TYPE "Gender_new" RENAME TO "Gender";
DROP TYPE "Gender_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('AKTIF', 'CUTI', 'NON_AKTIF', 'LULUS', 'DROP_OUT');
ALTER TABLE "User" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "Status_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_id_fkey";

-- DropForeignKey
ALTER TABLE "_MatakuliahToUser" DROP CONSTRAINT "_MatakuliahToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_MatakuliahToUser" DROP CONSTRAINT "_MatakuliahToUser_B_fkey";

-- DropForeignKey
ALTER TABLE "_ProdiToUser" DROP CONSTRAINT "_ProdiToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProdiToUser" DROP CONSTRAINT "_ProdiToUser_B_fkey";

-- AlterTable
ALTER TABLE "Fakultas" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "dekan" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Matakuliah" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deskripsi" TEXT,
ADD COLUMN     "jenisMK" TEXT NOT NULL,
ADD COLUMN     "kurikulumId" INTEGER NOT NULL,
ADD COLUMN     "semester" INTEGER NOT NULL,
ADD COLUMN     "silabus" TEXT,
ADD COLUMN     "status" "StatusMataKuliah" NOT NULL DEFAULT 'AKTIF',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Prodi" DROP COLUMN "fakultas",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fakultasId" INTEGER NOT NULL,
ADD COLUMN     "jenjang" TEXT NOT NULL,
ADD COLUMN     "kaprodi" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alamat" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fakultasId" INTEGER NOT NULL,
ADD COLUMN     "nip" TEXT,
ADD COLUMN     "prodiId" INTEGER,
ADD COLUMN     "tanggalLahir" TIMESTAMP(3),
ADD COLUMN     "telepon" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "nim" DROP NOT NULL,
ALTER COLUMN "nim" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "_MatakuliahToUser";

-- DropTable
DROP TABLE "_ProdiToUser";

-- CreateTable
CREATE TABLE "Kurikulum" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "status" "StatusMataKuliah" NOT NULL DEFAULT 'AKTIF',
    "prodiId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kurikulum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrasyaratMK" (
    "id" SERIAL NOT NULL,
    "mataKuliahId" INTEGER NOT NULL,
    "mataKuliahPrasyaratId" INTEGER NOT NULL,

    CONSTRAINT "PrasyaratMK_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KelasPerkuliahan" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kapasitas" INTEGER NOT NULL,
    "ruangan" TEXT,
    "jadwal" TEXT,
    "semester" TEXT NOT NULL,
    "mataKuliahId" INTEGER NOT NULL,
    "dosenId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KelasPerkuliahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KRS" (
    "id" SERIAL NOT NULL,
    "semester" TEXT NOT NULL,
    "status" "StatusKRS" NOT NULL DEFAULT 'DRAFT',
    "totalSKS" INTEGER NOT NULL DEFAULT 0,
    "tanggalPengajuan" TIMESTAMP(3),
    "tanggalPersetujuan" TIMESTAMP(3),
    "catatanDosen" TEXT,
    "mahasiswaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KRS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nilai" (
    "id" SERIAL NOT NULL,
    "nilaiTugas" DOUBLE PRECISION DEFAULT 0,
    "nilaiUTS" DOUBLE PRECISION DEFAULT 0,
    "nilaiUAS" DOUBLE PRECISION DEFAULT 0,
    "nilaiAkhir" DOUBLE PRECISION DEFAULT 0,
    "nilaiHuruf" TEXT,
    "indeksNilai" DOUBLE PRECISION,
    "status" "StatusNilai" NOT NULL DEFAULT 'BELUM_ADA',
    "semester" TEXT NOT NULL,
    "mahasiswaId" INTEGER NOT NULL,
    "mataKuliahId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skripsi" (
    "id" SERIAL NOT NULL,
    "judul" TEXT NOT NULL,
    "abstrak" TEXT,
    "statusPengajuan" TEXT NOT NULL DEFAULT 'DRAFT',
    "tanggalPengajuan" TIMESTAMP(3),
    "tanggalSidang" TIMESTAMP(3),
    "nilaiAkhir" DOUBLE PRECISION,
    "mahasiswaId" INTEGER NOT NULL,
    "pembimbingUtamaId" INTEGER NOT NULL,
    "coPembimbingId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skripsi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "tahunAkademik" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMP(3) NOT NULL,
    "tanggalSelesai" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TIDAK_AKTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pengumuman" (
    "id" SERIAL NOT NULL,
    "judul" TEXT NOT NULL,
    "isi" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "prioritas" TEXT NOT NULL DEFAULT 'NORMAL',
    "target" TEXT NOT NULL,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pengumuman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_KRSToKelasPerkuliahan" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_KRSToKelasPerkuliahan_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrasyaratMK_mataKuliahId_mataKuliahPrasyaratId_key" ON "PrasyaratMK"("mataKuliahId", "mataKuliahPrasyaratId");

-- CreateIndex
CREATE UNIQUE INDEX "KelasPerkuliahan_kode_key" ON "KelasPerkuliahan"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "KRS_mahasiswaId_semester_key" ON "KRS"("mahasiswaId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Nilai_mahasiswaId_mataKuliahId_semester_key" ON "Nilai"("mahasiswaId", "mataKuliahId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Skripsi_mahasiswaId_key" ON "Skripsi"("mahasiswaId");

-- CreateIndex
CREATE UNIQUE INDEX "Semester_nama_key" ON "Semester"("nama");

-- CreateIndex
CREATE INDEX "_KRSToKelasPerkuliahan_B_index" ON "_KRSToKelasPerkuliahan"("B");

-- CreateIndex
CREATE UNIQUE INDEX "User_nip_key" ON "User"("nip");

-- AddForeignKey
ALTER TABLE "Prodi" ADD CONSTRAINT "Prodi_fakultasId_fkey" FOREIGN KEY ("fakultasId") REFERENCES "Fakultas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_fakultasId_fkey" FOREIGN KEY ("fakultasId") REFERENCES "Fakultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "Prodi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kurikulum" ADD CONSTRAINT "Kurikulum_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "Prodi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matakuliah" ADD CONSTRAINT "Matakuliah_kurikulumId_fkey" FOREIGN KEY ("kurikulumId") REFERENCES "Kurikulum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrasyaratMK" ADD CONSTRAINT "PrasyaratMK_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "Matakuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrasyaratMK" ADD CONSTRAINT "PrasyaratMK_mataKuliahPrasyaratId_fkey" FOREIGN KEY ("mataKuliahPrasyaratId") REFERENCES "Matakuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KelasPerkuliahan" ADD CONSTRAINT "KelasPerkuliahan_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "Matakuliah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KelasPerkuliahan" ADD CONSTRAINT "KelasPerkuliahan_dosenId_fkey" FOREIGN KEY ("dosenId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KRS" ADD CONSTRAINT "KRS_mahasiswaId_fkey" FOREIGN KEY ("mahasiswaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nilai" ADD CONSTRAINT "Nilai_mahasiswaId_fkey" FOREIGN KEY ("mahasiswaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nilai" ADD CONSTRAINT "Nilai_mataKuliahId_fkey" FOREIGN KEY ("mataKuliahId") REFERENCES "Matakuliah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skripsi" ADD CONSTRAINT "Skripsi_mahasiswaId_fkey" FOREIGN KEY ("mahasiswaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skripsi" ADD CONSTRAINT "Skripsi_pembimbingUtamaId_fkey" FOREIGN KEY ("pembimbingUtamaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skripsi" ADD CONSTRAINT "Skripsi_coPembimbingId_fkey" FOREIGN KEY ("coPembimbingId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KRSToKelasPerkuliahan" ADD CONSTRAINT "_KRSToKelasPerkuliahan_A_fkey" FOREIGN KEY ("A") REFERENCES "KRS"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_KRSToKelasPerkuliahan" ADD CONSTRAINT "_KRSToKelasPerkuliahan_B_fkey" FOREIGN KEY ("B") REFERENCES "KelasPerkuliahan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
