-- CreateTable
CREATE TABLE "entitlement_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proEnabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_overrides_userId_key" ON "entitlement_overrides"("userId");

-- CreateIndex
CREATE INDEX "entitlement_overrides_userId_idx" ON "entitlement_overrides"("userId");

-- CreateIndex
CREATE INDEX "entitlement_overrides_expiresAt_idx" ON "entitlement_overrides"("expiresAt");

-- AddForeignKey
ALTER TABLE "entitlement_overrides" ADD CONSTRAINT "entitlement_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
