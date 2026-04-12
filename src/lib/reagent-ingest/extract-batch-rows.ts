import { getLlmClient } from "@/lib/llm/client";
import { normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import { buildReagentBatchExtractPrompt } from "@/lib/llm/prompts/reagent-batch-extract";
import { reagentBatchExtractSchema } from "@/lib/llm/schemas";
import { fetchVerificationPages, type VerificationPage } from "@/lib/reagent-ingest/fetch-verification-pages";
import { searchReagentWeb } from "@/lib/reagent-ingest/web-search";

export type ExtractedBatchRow = {
  sourceText: string;
  name: string;
  vendor?: string | null;
  catalogNo?: string | null;
  note?: string | null;
  antibodyCompatibilityText?: string | null;
};

type ExtractBatchRowsOptions = {
  allowLlm?: boolean;
  searchWeb?: typeof searchReagentWeb;
  fetchPages?: typeof fetchVerificationPages;
};

const headerTokens = ["name", "名称", "vendor", "厂家", "company", "catalog", "货号", "cat", "species", "兼容", "宿主", "备注", "note"];

function cleanCell(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeRow(row: ExtractedBatchRow): ExtractedBatchRow | null {
  const name = cleanCell(row.name ?? "");
  if (!name) return null;
  return {
    sourceText: cleanCell(row.sourceText) ?? name,
    name,
    vendor: cleanCell(row.vendor ?? ""),
    catalogNo: cleanCell(row.catalogNo ?? ""),
    note: cleanCell(row.note ?? ""),
    antibodyCompatibilityText: cleanCell(row.antibodyCompatibilityText ?? ""),
  };
}

function looksLikeHeaderRow(columns: string[]) {
  const lowered = columns.map((item) => item.trim().toLowerCase());
  const matched = lowered.filter((item) => headerTokens.some((token) => item.includes(token))).length;
  return matched >= Math.min(2, columns.length);
}

function parseTabularText(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length || !lines.some((line) => line.includes("\t"))) {
    return [];
  }

  const parsed = lines
    .map((line, index) => {
      const columns = line.split("\t").map((cell) => cell.trim());
      if (columns.length < 2) return null;
      if (index === 0 && looksLikeHeaderRow(columns)) return null;

      const [name, vendor, catalogNo, ...rest] = columns;
      return normalizeRow({
        sourceText: line,
        name,
        vendor,
        catalogNo,
        note: rest.filter(Boolean).join(" | "),
        antibodyCompatibilityText: rest.filter(Boolean).join(" | "),
      });
    })
    .filter((row): row is ExtractedBatchRow => !!row);

  return parsed;
}

function parseLineFallback(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => normalizeRow({ sourceText: line, name: line }))
    .filter((row): row is ExtractedBatchRow => !!row);
}

const vendorByKeyword: Array<[RegExp, string]> = [
  [/\bcell signaling technology\b|\bcst\b/, "Cell Signaling Technology"],
  [/\babcam\b/, "Abcam"],
  [/\bthermo fisher\b|\binvitrogen\b/, "Invitrogen"],
  [/\bbiolegend\b/, "BioLegend"],
  [/\bsigma\b|\bmerck\b/, "Sigma-Aldrich"],
  [/\bbeyotime\b/, "Beyotime"],
  [/\byeasen\b/, "Yeasen"],
  [/\btargetmol\b/, "TargetMol"],
  [/\bmedchemexpress\b|\bmce\b/, "MedChemExpress"],
];

function inferVendorFromEvidence(evidenceText: string) {
  const lowered = evidenceText.toLowerCase();
  const matched = vendorByKeyword.find(([pattern]) => pattern.test(lowered));
  return matched?.[1] ?? null;
}

function inferCatalogFromEvidence(evidenceText: string) {
  const candidates = evidenceText.match(/\b[A-Za-z0-9][A-Za-z0-9-]{2,19}\b/g) ?? [];
  const scored = candidates
    .filter((candidate) => /\d/.test(candidate) && !/^(WB|IF|ELISA|PCR|DNA|RNA|FBS|PBS|DMEM|BMP2|RANKL)$/i.test(candidate))
    .map((candidate) => {
      let score = 0;
      if (/[-/]/.test(candidate)) score += 3;
      if (/[a-z]/.test(candidate)) score += 2;
      if (candidate.length >= 5) score += 1;
      if (/^(ab|sc|mab|a-)/i.test(candidate)) score += 3;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate ?? null;
}

function combineEvidenceText(pages: VerificationPage[], rawSnippets: string[]) {
  return [...rawSnippets, ...pages.map((page) => `${page.title} ${page.snippet} ${page.excerpt}`)].join(" ");
}

async function supplementRowWithSearch(
  row: ExtractedBatchRow,
  searchWeb: typeof searchReagentWeb,
  fetchPages: typeof fetchVerificationPages,
) {
  if (row.vendor && row.catalogNo) return row;

  try {
    const query = [row.name, row.vendor, row.catalogNo, row.note, row.antibodyCompatibilityText].filter(Boolean).join(" ");
    const results = await searchWeb(query);
    if (!results.length) return row;
    const pages = await fetchPages(results, 2);
    const evidenceText = combineEvidenceText(
      pages,
      results.map((item) => `${item.title} ${item.snippet} ${item.domain}`),
    );
    const vendor = row.vendor ?? inferVendorFromEvidence(evidenceText);
    const catalogNo = row.catalogNo ?? inferCatalogFromEvidence(evidenceText);
    return {
      ...row,
      vendor,
      catalogNo,
    };
  } catch {
    return row;
  }
}

async function parseWithLlm(rawText: string, lang: "zh" | "en") {
  const client = getLlmClient();
  const model = process.env.OPENAI_MODEL || "MiniMax-M1-80k";
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: buildReagentBatchExtractPrompt(lang),
      },
      {
        role: "user",
        content: rawText,
      },
    ],
    temperature: 0,
  });

  const rawOutput = response.output_text || "[]";
  return reagentBatchExtractSchema.parse(normalizeLlmParsedPayload(JSON.parse(rawOutput))).map((row) => ({
    sourceText: row.sourceText,
    name: row.name,
    vendor: row.vendor ?? null,
    catalogNo: row.catalogNo ?? null,
    note: row.note ?? null,
    antibodyCompatibilityText: row.antibodyCompatibilityText ?? null,
  }));
}

export async function extractBatchRows(rawText: string, lang: "zh" | "en", options?: ExtractBatchRowsOptions) {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  const searchWeb = options?.searchWeb ?? searchReagentWeb;
  const fetchPages = options?.fetchPages ?? fetchVerificationPages;

  const tabular = parseTabularText(trimmed);
  if (tabular.length) return tabular;

  if (options?.allowLlm === false) {
    const rows = parseLineFallback(trimmed);
    return Promise.all(rows.map((row) => supplementRowWithSearch(row, searchWeb, fetchPages)));
  }

  try {
    const llmRows = await parseWithLlm(trimmed, lang);
    if (llmRows.length) {
      const normalized = llmRows.map((row) => normalizeRow(row)).filter((row): row is ExtractedBatchRow => !!row);
      return Promise.all(normalized.map((row) => supplementRowWithSearch(row, searchWeb, fetchPages)));
    }
  } catch (error) {
    console.error("[reagent-batch-extract] llm extraction failed", {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const rows = parseLineFallback(trimmed);
  return Promise.all(rows.map((row) => supplementRowWithSearch(row, searchWeb, fetchPages)));
}

export function summarizeBatchText(rawText: string) {
  return rawText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" | ");
}
