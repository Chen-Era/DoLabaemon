-- Treat an omitted genotype as wild type and normalize existing cage cards.
UPDATE "AnimalCage" SET "genotype" = 'WT' WHERE "genotype" IS NULL OR btrim("genotype") = '';

ALTER TABLE "AnimalCage" ALTER COLUMN "genotype" SET DEFAULT 'WT';
ALTER TABLE "AnimalCage" ALTER COLUMN "genotype" SET NOT NULL;
