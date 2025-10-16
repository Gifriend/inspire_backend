-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MAHASISWA', 'DOSEN');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nim" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "gender" "Gender" NOT NULL,
    "password" TEXT NOT NULL,
    "photo" TEXT,
    "status" "Status" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prodi" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "fakultas" TEXT NOT NULL,

    CONSTRAINT "Prodi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fakultas" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kode" TEXT NOT NULL,

    CONSTRAINT "Fakultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matakuliah" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "sks" INTEGER NOT NULL,
    "prodiId" INTEGER NOT NULL,

    CONSTRAINT "Matakuliah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProdiToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ProdiToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MatakuliahToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MatakuliahToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nim_key" ON "User"("nim");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Prodi_kode_key" ON "Prodi"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Fakultas_kode_key" ON "Fakultas"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Matakuliah_kode_key" ON "Matakuliah"("kode");

-- CreateIndex
CREATE INDEX "_ProdiToUser_B_index" ON "_ProdiToUser"("B");

-- CreateIndex
CREATE INDEX "_MatakuliahToUser_B_index" ON "_MatakuliahToUser"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_id_fkey" FOREIGN KEY ("id") REFERENCES "Fakultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matakuliah" ADD CONSTRAINT "Matakuliah_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "Prodi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProdiToUser" ADD CONSTRAINT "_ProdiToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Prodi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProdiToUser" ADD CONSTRAINT "_ProdiToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MatakuliahToUser" ADD CONSTRAINT "_MatakuliahToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Matakuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MatakuliahToUser" ADD CONSTRAINT "_MatakuliahToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
