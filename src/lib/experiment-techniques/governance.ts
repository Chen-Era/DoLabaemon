import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

import {
  demoCreateTechniqueDraft,
  demoGetTechniqueDraft,
  demoGetTechniqueRevision,
  demoListTechniqueDrafts,
  demoListTechniqueOverrides,
  demoUpdateTechniqueDraft,
  demoUpsertTechniqueOverride,
} from "@/lib/demo-store";
import { isDemoMode } from "@/lib/demo-mode";
import { createKnowledgeMutationLog } from "@/lib/knowledge/logs";
import { getPublishedTechnique } from "@/lib/experiment-techniques/runtime";
import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import {
  experimentTechniqueSchema,
  type ExperimentTechnique,
  type TechniqueRequirement,
} from "@/lib/experiment-techniques/types";
import { validateTechniqueForPublication } from "@/lib/experiment-techniques/publication";
import { prisma } from "@/lib/prisma";

type DraftSource = "CURATED" | "AI_DRAFT";
type ReviewAction = "APPROVE" | "REJECT";

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function withContentHash(
  technique: Omit<ExperimentTechnique, "contentHash"> & { contentHash?: string },
): ExperimentTechnique {
  const { contentHash: _oldHash, ...withoutHash } = technique;
  return {
    ...withoutHash,
    contentHash: createHash("sha256")
      .update(JSON.stringify(withoutHash))
      .digest("hex"),
  };
}

function draftDto<T extends { createdAt: Date | string; updatedAt: Date | string; submittedAt: Date | string | null; reviewedAt: Date | string | null }>(
  draft: T,
) {
  return {
    ...draft,
    createdAt:
      draft.createdAt instanceof Date
        ? draft.createdAt.toISOString()
        : draft.createdAt,
    updatedAt:
      draft.updatedAt instanceof Date
        ? draft.updatedAt.toISOString()
        : draft.updatedAt,
    submittedAt:
      draft.submittedAt instanceof Date
        ? draft.submittedAt.toISOString()
        : draft.submittedAt,
    reviewedAt:
      draft.reviewedAt instanceof Date
        ? draft.reviewedAt.toISOString()
        : draft.reviewedAt,
  };
}

export async function listTechniqueDrafts(labId: string) {
  if (isDemoMode()) return demoListTechniqueDrafts(labId);
  const drafts = await prisma.experimentTechniqueDraft.findMany({
    where: { labId },
    orderBy: { updatedAt: "desc" },
  });
  return drafts.map(draftDto);
}

export async function getTechniqueDraftForLab(draftId: string, labId: string) {
  if (isDemoMode()) {
    const draft = demoGetTechniqueDraft(draftId);
    return draft?.labId === labId ? draft : null;
  }
  const draft = await prisma.experimentTechniqueDraft.findFirst({
    where: { id: draftId, labId },
  });
  return draft ? draftDto(draft) : null;
}

export async function createTechniqueDraft(input: {
  labId: string;
  userId: string;
  baseCode?: string | null;
  payload?: Record<string, unknown>;
  source?: DraftSource;
}) {
  const base = input.baseCode
    ? await getPublishedTechnique(input.baseCode)
    : null;
  if (input.baseCode && !base) {
    throw new Error("BASE_TECHNIQUE_NOT_FOUND");
  }
  const payload = base
    ? {
        ...base,
        ...(input.payload ?? {}),
        status: "DRAFT",
        source: input.source ?? "CURATED",
      }
    : input.payload;
  if (!payload) throw new Error("MISSING_DRAFT_PAYLOAD");

  if (isDemoMode()) {
    return demoCreateTechniqueDraft({
      labId: input.labId,
      createdById: input.userId,
      baseCode: base?.code ?? null,
      baseRevision: base?.revision ?? null,
      status: "DRAFT",
      source: input.source ?? "CURATED",
      payload,
      reviewerId: null,
      reviewNote: "",
      submittedAt: null,
      reviewedAt: null,
    });
  }
  const draft = await prisma.experimentTechniqueDraft.create({
    data: {
      labId: input.labId,
      createdById: input.userId,
      baseCode: base?.code ?? null,
      baseRevision: base?.revision ?? null,
      status: "DRAFT",
      source: input.source ?? "CURATED",
      payload: json(payload),
    },
  });
  return draftDto(draft);
}

export async function submitTechniqueDraft(input: {
  draftId: string;
  labId: string;
  userId: string;
  payload?: Record<string, unknown>;
}) {
  const draft = await getTechniqueDraftForLab(input.draftId, input.labId);
  if (!draft) throw new Error("DRAFT_NOT_FOUND");
  if (draft.createdById !== input.userId) throw new Error("DRAFT_OWNER_REQUIRED");
  if (!["DRAFT", "REJECTED"].includes(draft.status)) {
    throw new Error("DRAFT_NOT_EDITABLE");
  }
  const payload = input.payload
    ? { ...(draft.payload as Record<string, unknown>), ...input.payload }
    : draft.payload;
  const structurallyComplete = experimentTechniqueSchema.safeParse({
    ...(payload as Record<string, unknown>),
    status: "IN_REVIEW",
  });
  if (!structurallyComplete.success) {
    throw new Error(`DRAFT_STRUCTURE_INVALID:${structurallyComplete.error.message}`);
  }
  const now = new Date();
  if (isDemoMode()) {
    return demoUpdateTechniqueDraft(input.draftId, {
      payload: structurallyComplete.data,
      status: "IN_REVIEW",
      submittedAt: now.toISOString(),
      reviewerId: null,
      reviewedAt: null,
      reviewNote: "",
    });
  }
  const updated = await prisma.experimentTechniqueDraft.update({
    where: { id: input.draftId },
    data: {
      payload: json(structurallyComplete.data),
      status: "IN_REVIEW",
      submittedAt: now,
      reviewerId: null,
      reviewedAt: null,
      reviewNote: "",
    },
  });
  return draftDto(updated);
}

export async function reviewTechniqueDraft(input: {
  draftId: string;
  labId: string;
  reviewerId: string;
  action: ReviewAction;
  note: string;
}) {
  const draft = await getTechniqueDraftForLab(input.draftId, input.labId);
  if (!draft) throw new Error("DRAFT_NOT_FOUND");
  if (draft.status !== "IN_REVIEW") throw new Error("DRAFT_NOT_IN_REVIEW");
  const status = input.action === "APPROVE" ? "APPROVED" : "REJECTED";
  const now = new Date();
  if (isDemoMode()) {
    return demoUpdateTechniqueDraft(input.draftId, {
      status,
      reviewerId: input.reviewerId,
      reviewNote: input.note,
      reviewedAt: now.toISOString(),
    });
  }
  const updated = await prisma.experimentTechniqueDraft.update({
    where: { id: input.draftId },
    data: {
      status,
      reviewerId: input.reviewerId,
      reviewNote: input.note,
      reviewedAt: now,
    },
  });
  return draftDto(updated);
}

function requirementData(
  requirement: TechniqueRequirement,
  techniqueId: string,
  profileId: string | null,
  sortOrder: number,
) {
  return {
    id: requirement.id,
    techniqueId,
    profileId,
    kind: requirement.kind,
    level: requirement.level,
    verificationMode: requirement.verificationMode,
    labelZh: requirement.label.zh,
    labelEn: requirement.label.en,
    capabilityTags: requirement.capabilityTags,
    matcherValues: requirement.matcherValues,
    condition: requirement.condition ? json(requirement.condition) : Prisma.JsonNull,
    sortOrder,
  };
}

function techniqueData(technique: ExperimentTechnique) {
  return {
    slug: technique.slug,
    revision: technique.revision,
    status: technique.status,
    source: technique.source,
    contentHash: technique.contentHash,
    isAbstract: technique.isAbstract,
    parentCode: technique.parentCode,
    nameZh: technique.name.zh,
    nameEn: technique.name.en,
    aliases: technique.aliases,
    categoryCode: technique.categoryCode,
    subcategoryCode: technique.subcategoryCode,
    principleZh: technique.principle.zh,
    principleEn: technique.principle.en,
    scopeZh: technique.scope.zh,
    scopeEn: technique.scope.en,
    sampleTypes: technique.sampleTypes,
    inputTypes: technique.inputTypes,
    outputTypes: technique.outputTypes,
    readoutModes: technique.readoutModes,
    throughput: technique.throughput,
    destructive: technique.destructive,
    workflowStages: json(technique.workflowStages),
    keyParameters: json(technique.keyParameters),
    qcMetrics: json(technique.qcMetrics),
    limitations: json(technique.limitations),
    troubleshooting: json(technique.troubleshooting),
    safety: json(technique.safety),
    ontologyMappings: json(technique.ontologyMappings),
    ontologyUnmappedReason: technique.ontologyUnmappedReason
      ? json(technique.ontologyUnmappedReason)
      : Prisma.JsonNull,
    reportingStandards: json(technique.reportingStandards),
    evidenceSourceIds: technique.evidenceSourceIds,
    claimEvidence: json(technique.claimEvidence),
    resolutionExamples: json(technique.resolutionExamples),
    reviewedAt: new Date(technique.reviewedAt),
    nextReviewDue: new Date(technique.nextReviewDue),
    active: true,
  };
}

async function persistCuratedTechnique(
  technique: ExperimentTechnique,
  input: {
    labId: string;
    publisherId: string;
    changeSummary: string;
    restoredFromRevision?: number | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    for (const sourceId of technique.evidenceSourceIds) {
      const source = evidenceSourceById.get(sourceId);
      if (!source) continue;
      await tx.evidenceSource.upsert({
        where: { id: source.id },
        create: {
          ...source,
          retrievedAt: new Date(source.retrievedAt),
        },
        update: {
          ...source,
          retrievedAt: new Date(source.retrievedAt),
        },
      });
    }

    const existing = await tx.experimentTechnique.findUnique({
      where: { code: technique.code },
    });
    const stored = await tx.experimentTechnique.upsert({
      where: { code: technique.code },
      create: {
        id: existing?.id ?? `curated:${technique.code}`,
        code: technique.code,
        ...techniqueData(technique),
      },
      update: techniqueData(technique),
    });
    await tx.techniqueRequirement.deleteMany({
      where: { techniqueId: stored.id },
    });
    await tx.experimentTechniqueProfile.deleteMany({
      where: { techniqueId: stored.id },
    });
    await tx.techniqueRequirement.createMany({
      data: technique.requirements.map((requirement, index) =>
        requirementData(requirement, stored.id, null, index),
      ),
    });
    for (const profile of technique.profiles) {
      const storedProfile = await tx.experimentTechniqueProfile.create({
        data: {
          techniqueId: stored.id,
          code: profile.code,
          name: json(profile.name),
          description: json(profile.description),
        },
      });
      await tx.techniqueRequirement.createMany({
        data: profile.additionalRequirements.map((requirement, index) =>
          requirementData(requirement, stored.id, storedProfile.id, index),
        ),
      });
    }

    await tx.techniqueEvidenceBinding.deleteMany({
      where: { techniqueId: stored.id },
    });
    for (const evidenceSourceId of technique.evidenceSourceIds) {
      const claimLocators = technique.claimEvidence
        .filter((claim) => claim.evidenceSourceId === evidenceSourceId)
        .map((claim) => claim.locator);
      const supportedFields = new Set(
        technique.claimEvidence
          .filter((claim) => claim.evidenceSourceId === evidenceSourceId)
          .map((claim) => claim.fieldPath),
      );
      technique.qcMetrics.forEach((metric, index) => {
        if (metric.evidenceSourceIds.includes(evidenceSourceId)) {
          supportedFields.add(`qcMetrics[${index}]`);
        }
      });
      if (technique.safety.evidenceSourceIds.includes(evidenceSourceId)) {
        supportedFields.add("safety");
      }
      await tx.techniqueEvidenceBinding.create({
        data: {
          techniqueId: stored.id,
          evidenceSourceId,
          supportedFields: [...supportedFields],
          claimLocator: claimLocators.join(" | ") || null,
        },
      });
    }

    await tx.experimentTechniqueRevision.create({
      data: {
        techniqueId: stored.id,
        revision: technique.revision,
        snapshot: json(technique),
        contentHash: technique.contentHash,
        changeSummary: input.changeSummary,
        restoredFromRevision: input.restoredFromRevision ?? null,
        labId: input.labId,
        publishedById: input.publisherId,
      },
    });
    return stored;
  });
}

export async function publishTechniqueDraft(input: {
  draftId: string;
  labId: string;
  publisherId: string;
}) {
  const draft = await getTechniqueDraftForLab(input.draftId, input.labId);
  if (!draft) throw new Error("DRAFT_NOT_FOUND");
  if (draft.status !== "APPROVED") throw new Error("DRAFT_NOT_APPROVED");

  const parsed = experimentTechniqueSchema.safeParse(draft.payload);
  if (!parsed.success) throw new Error(`DRAFT_STRUCTURE_INVALID:${parsed.error.message}`);
  const existing = await getPublishedTechnique(parsed.data.code);
  const revision = existing
    ? Math.max(existing.revision + 1, (draft.baseRevision ?? 0) + 1)
    : 1;
  const technique = withContentHash({
    ...parsed.data,
    id: existing?.id ?? `curated:${parsed.data.code}`,
    revision,
    status: "PUBLISHED",
    source: "CURATED",
    reviewedAt: new Date().toISOString(),
    nextReviewDue: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const gate = validateTechniqueForPublication(technique);
  if (!gate.publishable) {
    throw new Error(`PUBLICATION_GATE_FAILED:${gate.errors.join(" | ")}`);
  }

  if (isDemoMode()) {
    demoUpsertTechniqueOverride(technique, {
      changeSummary: `Published approved draft ${input.draftId}.`,
      labId: input.labId,
      publishedById: input.publisherId,
    });
    demoUpdateTechniqueDraft(input.draftId, {
      payload: technique,
      reviewerId: input.publisherId,
    });
  } else {
    await persistCuratedTechnique(technique, {
      labId: input.labId,
      publisherId: input.publisherId,
      changeSummary: `Published approved draft ${input.draftId}.`,
    });
  }
  await createKnowledgeMutationLog({
    labId: input.labId,
    userId: input.publisherId,
    flowType: "PUBLISH_TECHNIQUE_REVISION",
    domain: "EXPERIMENT_TECHNIQUE",
    entityKey: technique.code,
    status: "APPLIED",
    beforeData: existing,
    afterData: technique,
    evidenceSummary: technique.evidenceSourceIds,
  });
  return technique;
}

export async function rollbackTechniqueRevision(input: {
  labId: string;
  code: string;
  targetRevision: number;
  publisherId: string;
}) {
  if (isDemoMode()) {
    const currentOverride =
      demoListTechniqueOverrides().find(
        (technique) => technique.code === input.code,
      ) ?? null;
    if (!currentOverride) throw new Error("TECHNIQUE_NOT_FOUND");
    const target = demoGetTechniqueRevision(input.code, input.targetRevision);
    if (!target) throw new Error("REVISION_NOT_FOUND");
    const parsed = experimentTechniqueSchema.safeParse(target.snapshot);
    if (!parsed.success) throw new Error("REVISION_SNAPSHOT_INVALID");
    const restored = withContentHash({
      ...parsed.data,
      id: currentOverride.id,
      revision: currentOverride.revision + 1,
      status: "PUBLISHED",
      source: "CURATED",
      reviewedAt: new Date().toISOString(),
      nextReviewDue: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
    const gate = validateTechniqueForPublication(restored);
    if (!gate.publishable) {
      throw new Error(`PUBLICATION_GATE_FAILED:${gate.errors.join(" | ")}`);
    }
    demoUpsertTechniqueOverride(restored, {
      changeSummary: `Restored revision ${input.targetRevision} as a new immutable revision.`,
      restoredFromRevision: input.targetRevision,
      labId: input.labId,
      publishedById: input.publisherId,
    });
    // createKnowledgeMutationLog routes to demoCreateKnowledgeMutationLog under
    // DEMO_MODE internally, so it is safe to call on the demo path as well.
    await createKnowledgeMutationLog({
      labId: input.labId,
      userId: input.publisherId,
      flowType: "ROLLBACK_TECHNIQUE_REVISION",
      domain: "EXPERIMENT_TECHNIQUE",
      entityKey: restored.code,
      status: "APPLIED",
      beforeData: currentOverride,
      afterData: restored,
      evidenceSummary: restored.evidenceSourceIds,
    });
    return restored;
  }
  const current = await prisma.experimentTechnique.findUnique({
    where: { code: input.code },
  });
  if (!current) throw new Error("TECHNIQUE_NOT_FOUND");
  const target = await prisma.experimentTechniqueRevision.findUnique({
    where: {
      techniqueId_revision: {
        techniqueId: current.id,
        revision: input.targetRevision,
      },
    },
  });
  if (!target) throw new Error("REVISION_NOT_FOUND");
  const parsed = experimentTechniqueSchema.safeParse(target.snapshot);
  if (!parsed.success) throw new Error("REVISION_SNAPSHOT_INVALID");
  const restored = withContentHash({
    ...parsed.data,
    id: current.id,
    revision: current.revision + 1,
    status: "PUBLISHED",
    source: "CURATED",
    reviewedAt: new Date().toISOString(),
    nextReviewDue: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  });
  const gate = validateTechniqueForPublication(restored);
  if (!gate.publishable) {
    throw new Error(`PUBLICATION_GATE_FAILED:${gate.errors.join(" | ")}`);
  }
  await persistCuratedTechnique(restored, {
    labId: input.labId,
    publisherId: input.publisherId,
    changeSummary: `Restored revision ${input.targetRevision} as a new immutable revision.`,
    restoredFromRevision: input.targetRevision,
  });
  await createKnowledgeMutationLog({
    labId: input.labId,
    userId: input.publisherId,
    flowType: "ROLLBACK_TECHNIQUE_REVISION",
    domain: "EXPERIMENT_TECHNIQUE",
    entityKey: restored.code,
    status: "APPLIED",
    beforeData: current,
    afterData: restored,
    evidenceSummary: restored.evidenceSourceIds,
  });
  return restored;
}
