-- AlterEnum
ALTER TYPE "OfferProvider" ADD VALUE 'SERPAPI';

-- AlterTable
ALTER TABLE "FlightOfferSnapshot" ALTER COLUMN "provider" SET DEFAULT 'SERPAPI';

-- AlterTable
ALTER TABLE "HotelOfferSnapshot" ALTER COLUMN "provider" SET DEFAULT 'SERPAPI';
