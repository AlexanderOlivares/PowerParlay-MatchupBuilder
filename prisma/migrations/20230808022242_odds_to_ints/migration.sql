/*
  Warnings:

  - The `drawOdds` column on the `Odds` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `overOdds` column on the `Odds` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `underOdds` column on the `Odds` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Odds" DROP COLUMN "drawOdds",
ADD COLUMN     "drawOdds" INTEGER,
DROP COLUMN "overOdds",
ADD COLUMN     "overOdds" INTEGER,
DROP COLUMN "underOdds",
ADD COLUMN     "underOdds" INTEGER;
