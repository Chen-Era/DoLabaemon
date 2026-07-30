-- The inventory page always scopes records to one laboratory and normally
-- displays the newest uploads first. This index supports that hot path while
-- keeping per-lab catalog-number uniqueness unchanged.
CREATE INDEX "Reagent_labId_uploadedAt_idx" ON "Reagent"("labId", "uploadedAt");
