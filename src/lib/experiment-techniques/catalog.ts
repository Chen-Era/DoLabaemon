import { createHash } from "node:crypto";

import { advancedTechniqueBlueprints } from "@/lib/experiment-techniques/data/advanced-techniques";
import { cellTechniqueBlueprints } from "@/lib/experiment-techniques/data/cell-techniques";
import { coreTechniqueBlueprints } from "@/lib/experiment-techniques/data/core-techniques";
import type { TechniqueCategoryCode } from "@/lib/experiment-techniques/data/blueprint";
import { buildTechnique } from "@/lib/experiment-techniques/presets";
import { evidenceSourceById, evidenceSources } from "@/lib/experiment-techniques/sources";
import type { ExperimentTechnique } from "@/lib/experiment-techniques/types";
import { validateTechniqueCatalog } from "@/lib/experiment-techniques/validation";

export const techniqueCategoryLabels: Record<
  TechniqueCategoryCode,
  { zh: string; en: string }
> = {
  SAMPLE_MODELS: { zh: "样本与模型", en: "Samples and models" },
  NUCLEIC_ACID_GENETIC_ENGINEERING: {
    zh: "核酸与基因工程",
    en: "Nucleic acids and genetic engineering",
  },
  PROTEIN_IMMUNOASSAYS: { zh: "蛋白与免疫", en: "Protein and immunoassays" },
  IMAGING_HISTOLOGY: { zh: "成像与组织形态", en: "Imaging and histology" },
  CYTOMETRY_SORTING: { zh: "细胞计量", en: "Cytometry and sorting" },
  CELL_FUNCTION: { zh: "细胞功能", en: "Cell function" },
  MICROBIOLOGY_INFECTION: {
    zh: "微生物与感染",
    en: "Microbiology and infection",
  },
  ANALYTICAL_BIOPHYSICS: {
    zh: "分析化学与生物物理",
    en: "Analytical chemistry and biophysics",
  },
  SEQUENCING_OMICS: { zh: "测序与组学", en: "Sequencing and omics" },
  STRUCTURAL_BIOLOGY: { zh: "结构生物学", en: "Structural biology" },
  ANIMAL_IN_VIVO: { zh: "动物与在体", en: "Animal and in-vivo" },
  ECOLOGY_FIELD: { zh: "生态与现场实验", en: "Ecology and field experiments" },
};

export const repositoryTechniqueBlueprints = [
  ...coreTechniqueBlueprints,
  ...cellTechniqueBlueprints,
  ...advancedTechniqueBlueprints,
];

function rehashTechnique(
  technique: ExperimentTechnique,
  updates: Partial<ExperimentTechnique>,
) {
  const { contentHash: _contentHash, ...withoutHash } = {
    ...technique,
    ...updates,
  };
  return {
    ...withoutHash,
    contentHash: createHash("sha256")
      .update(JSON.stringify(withoutHash))
      .digest("hex"),
  };
}

function attachTechniqueFamilies(techniques: ExperimentTechnique[]) {
  const leaves = techniques.map((technique) =>
    technique.code === "SANDWICH_ELISA"
      ? rehashTechnique(technique, { parentCode: "ELISA" })
      : technique,
  );
  const sandwich = leaves.find((technique) => technique.code === "SANDWICH_ELISA");
  if (!sandwich) return leaves;
  const family = rehashTechnique(sandwich, {
    id: "system:ELISA",
    code: "ELISA",
    slug: "elisa",
    isAbstract: true,
    parentCode: null,
    name: {
      zh: "ELISA 技术家族",
      en: "ELISA technique family",
    },
    aliases: ["酶联免疫吸附测定", "enzyme-linked immunosorbent assay"],
    principle: {
      zh: "以固相免疫结合和酶促信号报告为共同基础的技术家族；具体结合拓扑决定直接、间接、夹心或竞争格式。",
      en: "A technique family based on solid-phase immune binding and enzyme-reported signal; binding topology distinguishes direct, indirect, sandwich and competitive formats.",
    },
    scope: {
      zh: "仅用于导航和消歧；必须选择直接、间接、夹心或竞争 ELISA 叶子技术后才能进行资源检查。",
      en: "Navigation and disambiguation only; a direct, indirect, sandwich or competitive ELISA leaf must be selected before resource checking.",
    },
    requirements: [],
    profiles: [],
  });
  return [...leaves, family];
}

function attachConfusableTechniqueExamples(
  techniques: ExperimentTechnique[],
): ExperimentTechnique[] {
  return techniques.map((technique) => {
    const neighbor =
      techniques.find(
        (candidate) =>
          candidate.code !== technique.code &&
          candidate.subcategoryCode === technique.subcategoryCode,
      ) ??
      techniques.find(
        (candidate) =>
          candidate.code !== technique.code &&
          candidate.categoryCode === technique.categoryCode,
      );
    if (!neighbor) return technique;

    const { contentHash: _contentHash, ...withoutHash } = technique;
    const augmented = {
      ...withoutHash,
      resolutionExamples: {
        ...technique.resolutionExamples,
        negative: [
          {
            query: neighbor.aliases[0] ?? neighbor.name.en,
            context: `用户明确要求${neighbor.name.zh}，而不是${technique.name.zh}。`,
            expectedCode: neighbor.code,
            excludedCode: technique.code,
            reason: `${neighbor.code} is a near-neighbor technique and must not resolve to ${technique.code}.`,
          },
        ],
      },
    };
    return {
      ...augmented,
      contentHash: createHash("sha256")
        .update(JSON.stringify(augmented))
        .digest("hex"),
    };
  });
}

export const repositoryTechniqueCatalog: ExperimentTechnique[] =
  attachConfusableTechniqueExamples(
    attachTechniqueFamilies(repositoryTechniqueBlueprints.map(buildTechnique)),
  );

export const repositoryTechniqueByCode = new Map(
  repositoryTechniqueCatalog.map((technique) => [technique.code, technique]),
);

export const repositoryTechniqueBySlug = new Map(
  repositoryTechniqueCatalog.map((technique) => [technique.slug, technique]),
);

export const repositoryCatalogValidation = validateTechniqueCatalog(
  repositoryTechniqueCatalog,
  evidenceSources,
);

export const evidenceTiersByTechnique = new Map(
  repositoryTechniqueCatalog.map((technique) => [
    technique.code,
    new Set(
      technique.evidenceSourceIds
        .map((id) => evidenceSourceById.get(id)?.tier)
        .filter((tier): tier is NonNullable<typeof tier> => Boolean(tier)),
    ),
  ]),
);
