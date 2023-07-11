-- CreateTable
CREATE TABLE "PotentialMatchup" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gameDate" TEXT NOT NULL,
    "gameTime" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "league" TEXT NOT NULL,
    "gameStatus" TEXT NOT NULL,

    CONSTRAINT "PotentialMatchup_pkey" PRIMARY KEY ("id")
);
