import { Prisma, PrismaClient } from "@prisma/client";

import {
  repositoryCatalogValidation,
  repositoryTechniqueCatalog,
} from "../src/lib/experiment-techniques/catalog";
import { buildTechniqueEvidenceBindings } from "../src/lib/experiment-techniques/evidence-bindings";
import { evidenceSources } from "../src/lib/experiment-techniques/sources";
import type {
  ExperimentTechnique,
  TechniqueRequirement,
} from "../src/lib/experiment-techniques/types";
import { curationWarningsForTechnique } from "../src/lib/experiment-techniques/validation";

const prisma = new PrismaClient();

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
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

function techniqueData(
  technique: ExperimentTechnique,
  revision: number,
  curationWarnings: string[],
) {
  return {
    slug: technique.slug,
    revision,
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
    formalPublication: curationWarnings.length === 0,
    curationWarnings,
    active: technique.status !== "DEPRECATED",
  };
}

async function main() {
  const allowWarnings = process.argv.includes("--allow-warnings");

  if (!repositoryCatalogValidation.valid) {
    throw new Error(repositoryCatalogValidation.errors.join("\n"));
  }

  const summary = await prisma.$transaction(
    async (tx) => {
      for (const source of evidenceSources) {
        const data = {
          title: source.title,
          organization: source.organization,
          sourceType: source.sourceType,
          tier: source.tier,
          authorityScope: source.authorityScope,
          canonicalUrl: source.canonicalUrl,
          version: source.version,
          versionUri: source.versionUri,
          releaseDate: source.releaseDate,
          retrievedAt: new Date(source.retrievedAt),
          licenseId: source.licenseId,
          licenseUrl: source.licenseUrl,
          reuseMode: source.reuseMode,
          doi: source.doi,
          pmid: source.pmid,
        };
        await tx.evidenceSource.upsert({
          where: { id: source.id },
          create: { id: source.id, ...data },
          update: data,
        });
      }

      let created = 0;
      let updated = 0;
      let preservedCurated = 0;
      let formalCount = 0;
      let warningCount = 0;
      const warningEntries: Array<{ code: string; warnings: string[] }> = [];
      for (const technique of repositoryTechniqueCatalog) {
        const existing = await tx.experimentTechnique.findUnique({
          where: { code: technique.code },
        });
        if (existing?.source === "CURATED") {
          preservedCurated += 1;
          continue;
        }

        const curationWarnings = curationWarningsForTechnique(technique);
        if (curationWarnings.length) {
          warningCount += 1;
          warningEntries.push({ code: technique.code, warnings: curationWarnings });
        } else {
          formalCount += 1;
        }

        const revision =
          existing && existing.contentHash !== technique.contentHash
            ? Math.max(existing.revision + 1, technique.revision)
            : existing?.revision ?? technique.revision;
        const data = techniqueData(technique, revision, curationWarnings);
        const stored = await tx.experimentTechnique.upsert({
          where: { code: technique.code },
          create: {
            id: technique.id,
            code: technique.code,
            ...data,
          },
          update: data,
        });
        if (existing) updated += 1;
        else created += 1;

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
          if (profile.additionalRequirements.length) {
            await tx.techniqueRequirement.createMany({
              data: profile.additionalRequirements.map((requirement, index) =>
                requirementData(requirement, stored.id, storedProfile.id, index),
              ),
            });
          }
        }

        await tx.techniqueEvidenceBinding.deleteMany({
          where: { techniqueId: stored.id },
        });
        await tx.techniqueEvidenceBinding.createMany({
          data: buildTechniqueEvidenceBindings(technique).map((binding) => ({
            techniqueId: stored.id,
            evidenceSourceId: binding.evidenceSourceId,
            supportedFields: binding.supportedFields,
            claimLocator: binding.claimLocator,
          })),
        });

        const revisionExists = await tx.experimentTechniqueRevision.findUnique({
          where: {
            techniqueId_revision: {
              techniqueId: stored.id,
              revision,
            },
          },
        });
        if (!revisionExists) {
          await tx.experimentTechniqueRevision.create({
            data: {
              techniqueId: stored.id,
              revision,
              snapshot: json({ ...technique, revision }),
              contentHash: technique.contentHash,
              changeSummary: existing
                ? "Repository SYSTEM baseline synchronized."
                : "Repository SYSTEM baseline imported.",
            },
          });
        }
      }

      const activeCodes = repositoryTechniqueCatalog.map((technique) => technique.code);
      const deactivated = await tx.experimentTechnique.updateMany({
        where: {
          source: "SYSTEM",
          active: true,
          code: { notIn: activeCodes },
        },
        data: {
          active: false,
          status: "DEPRECATED",
        },
      });

      return {
        created,
        updated,
        preservedCurated,
        deactivatedSystem: deactivated.count,
        formalCount,
        warningCount,
        warningEntries,
      };
    },
    { timeout: 120_000 },
  );

  const { warningEntries, warningCount, ...counts } = summary;
  console.log(
    JSON.stringify(
      {
        techniques: repositoryTechniqueCatalog.length,
        evidenceSources: evidenceSources.length,
        ...counts,
        warningCount,
        curationWarnings: warningEntries,
      },
      null,
      2,
    ),
  );

  if (warningCount > 0) {
    if (allowWarnings) {
      console.log("SYNC COMPLETED WITH CURATION WARNINGS");
    } else {
      console.error(
        `SYNC GATED: ${warningCount} technique(s) carry curation warnings and are not formally published. ` +
          "Re-run with --allow-warnings to downgrade this gate.",
      );
      process.exitCode = 1;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
