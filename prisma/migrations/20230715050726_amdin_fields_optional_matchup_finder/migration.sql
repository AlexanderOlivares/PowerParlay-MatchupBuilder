-- AlterTable
ALTER TABLE "PotentialMatchup" ALTER COLUMN "adminUseAwayDraw" DROP NOT NULL,
ALTER COLUMN "adminUseGame" DROP NOT NULL,
ALTER COLUMN "adminUseHomeDraw" DROP NOT NULL,
ALTER COLUMN "adminUseMoneyline" DROP NOT NULL,
ALTER COLUMN "adminUseOverUnder" DROP NOT NULL;
