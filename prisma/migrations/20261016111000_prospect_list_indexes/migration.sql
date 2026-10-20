-- CreateIndex
CREATE INDEX "Prospect_ownerUserId_createdAt_idx" ON "Prospect"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Prospect_ownerUserId_source_idx" ON "Prospect"("ownerUserId", "source");
