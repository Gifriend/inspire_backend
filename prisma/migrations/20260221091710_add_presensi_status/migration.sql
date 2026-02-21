-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'ALPHA');

-- AlterTable
ALTER TABLE "PresensiRecord" ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'HADIR';
