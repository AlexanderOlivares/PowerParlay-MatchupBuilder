/*
  Warnings:

  - You are about to drop the column `adminUseAwayDraw` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `adminUseHomeDraw` on the `PotentialMatchup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PotentialMatchup" DROP COLUMN "adminUseAwayDraw",
DROP COLUMN "adminUseHomeDraw",
ADD COLUMN     "drawTeam" TEXT;
