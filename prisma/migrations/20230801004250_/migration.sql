/*
  Warnings:

  - You are about to drop the column `adminUseMoneyline` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `adminUseOverUnder` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `adminUseSpread` on the `PotentialMatchup` table. All the data in the column will be lost.
  - Added the required column `oddsScope` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `oddsType` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Matchup" ALTER COLUMN "drawOdds" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PotentialMatchup" DROP COLUMN "adminUseMoneyline",
DROP COLUMN "adminUseOverUnder",
DROP COLUMN "adminUseSpread",
ADD COLUMN     "oddsScope" TEXT NOT NULL,
ADD COLUMN     "oddsType" TEXT NOT NULL;
