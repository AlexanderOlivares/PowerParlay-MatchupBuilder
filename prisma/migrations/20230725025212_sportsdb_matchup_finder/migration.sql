/*
  Warnings:

  - You are about to drop the column `eventId` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `gameDate` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `gameStatus` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `gameTime` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `league` on the `PotentialMatchup` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `PotentialMatchup` table. All the data in the column will be lost.
  - Added the required column `idAwayTeam` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idEvent` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idHomeTeam` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idLeague` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strAwayTeam` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strEvent` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strHomeTeam` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strLeague` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strThumb` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `strTimestamp` to the `PotentialMatchup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PotentialMatchup" DROP COLUMN "eventId",
DROP COLUMN "gameDate",
DROP COLUMN "gameStatus",
DROP COLUMN "gameTime",
DROP COLUMN "league",
DROP COLUMN "name",
ADD COLUMN     "idAwayTeam" TEXT NOT NULL,
ADD COLUMN     "idEvent" TEXT NOT NULL,
ADD COLUMN     "idHomeTeam" TEXT NOT NULL,
ADD COLUMN     "idLeague" TEXT NOT NULL,
ADD COLUMN     "strAwayTeam" TEXT NOT NULL,
ADD COLUMN     "strEvent" TEXT NOT NULL,
ADD COLUMN     "strHomeTeam" TEXT NOT NULL,
ADD COLUMN     "strLeague" TEXT NOT NULL,
ADD COLUMN     "strThumb" TEXT NOT NULL,
ADD COLUMN     "strTimestamp" TEXT NOT NULL;
