-- AlterTable ElearningClassConfig: add googleClassroomId if not exists
ALTER TABLE "ElearningClassConfig" ADD COLUMN IF NOT EXISTS "googleClassroomId" TEXT;

-- CreateIndex for googleClassroomId if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'ElearningClassConfig'
      AND indexname = 'ElearningClassConfig_googleClassroomId_key'
  ) THEN
    CREATE UNIQUE INDEX "ElearningClassConfig_googleClassroomId_key"
      ON "ElearningClassConfig"("googleClassroomId");
  END IF;
END$$;

-- CreateEnum: TaskKategori
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskKategori') THEN
    CREATE TYPE "TaskKategori" AS ENUM ('TUGAS', 'UTS', 'UAS', 'KUIS', 'PARTISIPASI');
  END IF;
END$$;

-- AlterTable Assignment: add kategori and bobot
ALTER TABLE "Assignment"
  ADD COLUMN IF NOT EXISTS "kategori" "TaskKategori" NOT NULL DEFAULT 'TUGAS',
  ADD COLUMN IF NOT EXISTS "bobot"    DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable Quiz: add kategori and bobot
ALTER TABLE "Quiz"
  ADD COLUMN IF NOT EXISTS "kategori" "TaskKategori" NOT NULL DEFAULT 'KUIS',
  ADD COLUMN IF NOT EXISTS "bobot"    DOUBLE PRECISION NOT NULL DEFAULT 0;
