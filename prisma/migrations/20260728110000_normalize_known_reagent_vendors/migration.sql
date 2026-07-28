-- Normalize the common mixed-language supplier variants already stored in
-- inventory. New uploads use the same canonical vocabulary in application code.
UPDATE "Reagent" SET "vendor" = '普诺赛 Procell' WHERE "vendor" ~* 'procell|普诺赛';
UPDATE "Reagent" SET "vendor" = '雅酶 Epizyme' WHERE "vendor" ~* 'epizyme|雅酶';
UPDATE "Reagent" SET "vendor" = '翌圣生物 Yeasen' WHERE "vendor" ~* 'yeasen|翌圣';
UPDATE "Reagent" SET "vendor" = '索莱宝 Solarbio' WHERE "vendor" ~* 'solarbio|索莱宝';
UPDATE "Reagent" SET "vendor" = '雷根 Leagene' WHERE "vendor" ~* 'leagene|雷根';
UPDATE "Reagent" SET "vendor" = '源叶生物' WHERE "vendor" ~* '源叶';
UPDATE "Reagent" SET "vendor" = 'Cell Signaling Technology' WHERE LOWER("vendor") IN ('cst', 'cell signaling technology');
UPDATE "Reagent" SET "vendor" = 'MedChemExpress' WHERE LOWER("vendor") IN ('mce', 'medchemexpress');
UPDATE "Reagent" SET "vendor" = '伯仪生物 ACE' WHERE "vendor" ~* '伯仪生物|ace biotechnology';
UPDATE "Reagent" SET "vendor" = '吉凯基因 GeneChem' WHERE "vendor" ~* '吉凯|genechem';
UPDATE "Reagent" SET "vendor" = '吉满生物 Genomeditech' WHERE "vendor" ~* '吉满|genomeditech';
UPDATE "Reagent" SET "vendor" = 'Cloud-Clone（云克隆）' WHERE "vendor" ~* '云克隆|cloud-clone';
