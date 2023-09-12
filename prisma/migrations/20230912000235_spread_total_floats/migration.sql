/*
  Warnings:

  - You are about to drop the column `result` on the `Matchups` table. All the data in the column will be lost.
  - You are about to alter the column `homeSpread` on the `Odds` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `awaySpread` on the `Odds` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `total` on the `Odds` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - Added the required column `status` to the `Matchups` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Matchups" DROP COLUMN "result",
ADD COLUMN     "awayScore" INTEGER,
ADD COLUMN     "homeScore" INTEGER,
ADD COLUMN     "pointsTotal" INTEGER,
ADD COLUMN     "status" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Odds" ALTER COLUMN "homeSpread" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "awaySpread" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION;
