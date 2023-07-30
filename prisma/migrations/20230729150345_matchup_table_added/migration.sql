-- CreateTable
CREATE TABLE "Matchup" (
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
    "adminSelected" BOOLEAN NOT NULL,
    "oddsGameId" TEXT NOT NULL,
    "homeOdds" TEXT NOT NULL,
    "awayOdds" TEXT NOT NULL,
    "drawOdds" TEXT NOT NULL,
    "lastOddsUpdate" TEXT NOT NULL,
    "oddsHistory" JSONB NOT NULL,
    "oddsType" TEXT NOT NULL,
    "oddsScope" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL,
    "adminUnlocked" BOOLEAN NOT NULL,
    "adminCorrected" BOOLEAN NOT NULL,
    "homeSelected" INTEGER NOT NULL,
    "awaySelected" INTEGER NOT NULL,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Matchup_id_key" ON "Matchup"("id");
