-- CreateEnum
CREATE TYPE "ElearningSetupMode" AS ENUM ('NEW', 'EXISTING');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ElearningClassConfig" (
    "id" SERIAL NOT NULL,
    "kelasPerkuliahanId" INTEGER NOT NULL,
    "setupMode" "ElearningSetupMode" NOT NULL DEFAULT 'NEW',
    "sourceKelasPerkuliahanId" INTEGER,
    "isMergedClass" BOOLEAN NOT NULL DEFAULT false,
    "createdByDosenId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElearningClassConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElearningClassConfig_kelasPerkuliahanId_key" ON "ElearningClassConfig"("kelasPerkuliahanId");

-- AddForeignKey
ALTER TABLE "ElearningClassConfig" ADD CONSTRAINT "ElearningClassConfig_kelasPerkuliahanId_fkey" FOREIGN KEY ("kelasPerkuliahanId") REFERENCES "KelasPerkuliahan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElearningClassConfig" ADD CONSTRAINT "ElearningClassConfig_sourceKelasPerkuliahanId_fkey" FOREIGN KEY ("sourceKelasPerkuliahanId") REFERENCES "KelasPerkuliahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElearningClassConfig" ADD CONSTRAINT "ElearningClassConfig_createdByDosenId_fkey" FOREIGN KEY ("createdByDosenId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
