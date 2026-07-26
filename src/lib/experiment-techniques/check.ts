import { experimentTechniqueSchema } from "@/lib/experiment-techniques/types";
import type {
  ExperimentTechnique,
  TechniqueCheckItem,
  TechniqueCheckStatus,
  TechniqueRequirement,
} from "@/lib/experiment-techniques/types";

export type InventoryCapability = {
  id: string;
  name: string;
  capabilityTags: string[];
  searchableValues?: string[];
  available?: boolean;
};

export type TechniqueCheckResult = {
  techniqueCode: string;
  profileCode: string | null;
  status: TechniqueCheckStatus;
  items: TechniqueCheckItem[];
  reasons: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function findInventoryMatch(
  requirement: TechniqueRequirement,
  inventory: InventoryCapability[],
) {
  const requiredCapabilities = new Set(requirement.capabilityTags.map(normalize));
  const matcherValues = requirement.matcherValues.map(normalize).filter(Boolean);

  return inventory.find((item) => {
    if (item.available === false) return false;
    const itemCapabilities = new Set(item.capabilityTags.map(normalize));
    const searchable = [item.name, ...(item.searchableValues ?? [])]
      .map(normalize)
      .filter(Boolean);
    if (
      requiredCapabilities.size > 0 &&
      [...requiredCapabilities].some((tag) => itemCapabilities.has(tag))
    ) {
      return true;
    }
    if (
      requiredCapabilities.size > 0 &&
      [...requiredCapabilities].some(
        (tag) =>
          tag.length >= 3 &&
          searchable.some((value) => value === tag || value.includes(tag)),
      )
    ) {
      return true;
    }
    if (requiredCapabilities.size > 0) return false;

    return matcherValues.some((matcher) =>
      searchable.some((value) => value === matcher || value.includes(matcher)),
    );
  });
}

function unsupported(
  techniqueCode: string,
  profileCode: string | null,
  reasons: string[],
): TechniqueCheckResult {
  return {
    techniqueCode,
    profileCode,
    status: "UNSUPPORTED",
    items: [],
    reasons,
  };
}

export function evaluateTechniqueReadiness(input: {
  technique: ExperimentTechnique;
  profileCode?: string | null;
  confirmedRequirementIds?: string[];
  notApplicableRequirementIds?: string[];
  inventory?: InventoryCapability[];
}): TechniqueCheckResult {
  const {
    technique,
    profileCode = null,
    confirmedRequirementIds = [],
    notApplicableRequirementIds = [],
    inventory = [],
  } = input;
  const parsed = experimentTechniqueSchema.safeParse(technique);
  if (!parsed.success) {
    return unsupported(technique.code, profileCode, [
      "Technique content failed structural validation.",
    ]);
  }
  if (technique.status !== "PUBLISHED") {
    return unsupported(technique.code, profileCode, [
      "Technique is not in PUBLISHED status.",
    ]);
  }
  if (technique.isAbstract) {
    return unsupported(technique.code, profileCode, [
      "Technique is a navigation family; select a concrete leaf technique.",
    ]);
  }
  if (!technique.requirements.length) {
    return unsupported(technique.code, profileCode, [
      "Technique has no resource requirements; zero-rule checks are never accepted.",
    ]);
  }

  const declaredKinds = new Set(technique.requirements.map((item) => item.kind));
  const missingDimensions = (
    ["REAGENT", "CONSUMABLE", "INSTRUMENT", "SAMPLE", "CONTROL", "SOFTWARE"] as const
  ).filter((kind) => !declaredKinds.has(kind));
  if (missingDimensions.length) {
    return unsupported(technique.code, profileCode, [
      `Technique has incomplete resource dimensions: ${missingDimensions.join(", ")}.`,
    ]);
  }

  const profile = profileCode
    ? technique.profiles.find((item) => item.code === profileCode)
    : null;
  if (profileCode && !profile) {
    return unsupported(technique.code, profileCode, [
      `Unknown profile ${profileCode} for ${technique.code}.`,
    ]);
  }

  const requirements = [
    ...technique.requirements,
    ...(profile?.additionalRequirements ?? []),
  ];
  if (!requirements.some((item) => item.level === "REQUIRED")) {
    return unsupported(technique.code, profileCode, [
      "Technique has no required resources; zero-required checks are never accepted.",
    ]);
  }

  const confirmed = new Set(confirmedRequirementIds);
  const explicitlyNotApplicable = new Set(notApplicableRequirementIds);
  const items: TechniqueCheckItem[] = requirements.map((requirement) => {
    if (requirement.level === "CONDITIONAL") {
      return {
        requirementId: requirement.id,
        label: requirement.label.zh,
        kind: requirement.kind,
        level: requirement.level,
        verificationMode: requirement.verificationMode,
        state: confirmed.has(requirement.id)
          ? "CONFIRMED"
          : explicitlyNotApplicable.has(requirement.id)
            ? "NOT_APPLICABLE"
            : "UNCONFIRMED",
      };
    }

    if (requirement.verificationMode === "AUTO_INVENTORY") {
      const match = findInventoryMatch(requirement, inventory);
      return {
        requirementId: requirement.id,
        label: requirement.label.zh,
        kind: requirement.kind,
        level: requirement.level,
        verificationMode: requirement.verificationMode,
        state: match ? "MATCHED" : "MISSING",
        matchedName: match?.name,
      };
    }

    return {
      requirementId: requirement.id,
      label: requirement.label.zh,
      kind: requirement.kind,
      level: requirement.level,
      verificationMode: requirement.verificationMode,
      state: confirmed.has(requirement.id) ? "CONFIRMED" : "UNCONFIRMED",
    };
  });

  const missingAutoRequiredReagent = items.some(
    (item) =>
      item.kind === "REAGENT" &&
      item.level === "REQUIRED" &&
      item.verificationMode === "AUTO_INVENTORY" &&
      item.state === "MISSING",
  );
  if (missingAutoRequiredReagent) {
    return {
      techniqueCode: technique.code,
      profileCode,
      status: "BLOCKED",
      items,
      reasons: ["One or more automatically verifiable required reagents are missing."],
    };
  }

  const unconfirmedRequired = items.some(
    (item) =>
      item.level === "REQUIRED" &&
      (item.state === "UNCONFIRMED" || item.state === "MISSING"),
  );
  const unresolvedConditional = items.some(
    (item) =>
      item.level === "CONDITIONAL" && item.state === "UNCONFIRMED",
  );
  if (unconfirmedRequired || unresolvedConditional) {
    return {
      techniqueCode: technique.code,
      profileCode,
      status: "NEEDS_CONFIRMATION",
      items,
      reasons: [
        "Required instruments, consumables, samples, controls, software or manually verified reagents still need confirmation.",
      ],
    };
  }

  return {
    techniqueCode: technique.code,
    profileCode,
    status: "READY",
    items,
    reasons: [],
  };
}
