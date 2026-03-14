-- CreateTable
CREATE TABLE "TelegramSession" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSession_telegramId_key" ON "TelegramSession"("telegramId");
