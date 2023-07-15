/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `PotentialMatchup` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `adminUseAwayDraw` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminUseGame` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminUseHomeDraw` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminUseMoneyline` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminUseOverUnder` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `drawEligible` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PotentialMatchup" ADD COLUMN     "adminUseAwayDraw" BOOLEAN NOT NULL,
ADD COLUMN     "adminUseGame" BOOLEAN NOT NULL,
ADD COLUMN     "adminUseHomeDraw" BOOLEAN NOT NULL,
ADD COLUMN     "adminUseMoneyline" BOOLEAN NOT NULL,
ADD COLUMN     "adminUseOverUnder" BOOLEAN NOT NULL,
ADD COLUMN     "drawEligible" BOOLEAN NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PotentialMatchup_id_key" ON "PotentialMatchup"("id");
