/*
  Warnings:

  - You are about to drop the `Matchup` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PotentialMatchup` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Matchup";

-- DropTable
DROP TABLE "PotentialMatchup";

-- CreateTable
CREATE TABLE "Matchups" (
    "id" TEXT NOT NULL,
    "drawEligible" BOOLEAN NOT NULL,
    "idEvent" TEXT NOT NULL,
    "idHomeTeam" TEXT NOT NULL,
    "idAwayTeam" TEXT NOT NULL,
    "idLeague" TEXT NOT NULL,
    "strEvent" TEXT NOT NULL,
    "strLeague" TEXT NOT NULL,
    "strHomeTeam" TEXT NOT NULL,
    "strAwayTeam" TEXT NOT NULL,
    "strTimestamp" TEXT NOT NULL,
    "strThumb" TEXT NOT NULL,
    "oddsType" TEXT NOT NULL,
    "oddsScope" TEXT NOT NULL,
    "drawTeam" TEXT,
    "adminSelected" BOOLEAN NOT NULL,
    "used" BOOLEAN NOT NULL,
    "result" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "adminUnlocked" BOOLEAN NOT NULL,
    "adminCorrected" BOOLEAN NOT NULL,

    CONSTRAINT "Matchups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Odds" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "oddsGameId" INTEGER NOT NULL,
    "sportsbook" TEXT NOT NULL,
    "homeOdds" INTEGER,
    "awayOdds" INTEGER,
    "drawOdds" TEXT,
    "overOdds" TEXT,
    "underOdds" TEXT,
    "homeSpread" DECIMAL(65,30),
    "awaySpread" DECIMAL(65,30),
    "total" DECIMAL(65,30),
    "lastUpdate" TEXT NOT NULL,

    CONSTRAINT "Odds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Matchups_id_key" ON "Matchups"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Odds_id_key" ON "Odds"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Odds_matchupId_key" ON "Odds"("matchupId");

-- AddForeignKey
ALTER TABLE "Odds" ADD CONSTRAINT "Odds_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "Matchups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
