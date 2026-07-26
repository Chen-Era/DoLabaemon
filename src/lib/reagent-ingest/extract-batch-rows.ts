import { generateLlmText, getLlmClient } from "@/lib/llm/client";
import { parseLlmJson } from "@/lib/llm/json-output";
import { coerceReagentBatchExtractRows, normalizeLlmParsedPayload } from "@/lib/llm/normalize";
import type { RuntimeLlmConfig } from "@/lib/llm/runtime-config";
import { buildReagentBatchExtractPrompt } from "@/lib/llm/prompts/reagent-batch-extract";
import { reagentBatchExtractSchema } from "@/lib/llm/schemas";
import { cleanUrlText } from "@/lib/url/clean-url";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { withTimeout } from "@/lib/async/with-timeout";
import { fetchVerificationPages, type VerificationPage } from "@/lib/reagent-ingest/fetch-verification-pages";
import { searchReagentWeb } from "@/lib/reagent-ingest/web-search";

export type BatchRowSupplementation = {
  attemptedSearch: boolean;
  searchStatus: "not_needed" | "no_results" | "filled_from_search" | "evidence_inconclusive" | "request_failed";
  vendorInferred: boolean;
  catalogInferred: boolean;
  pageCount: number;
};

export type ExtractedBatchRow = {
  sourceText: string;
  name: string;
  vendor?: string | null;
  catalogNo?: string | null;
  note?: string | null;
  antibodyCompatibilityText?: string | null;
  supplementation?: BatchRowSupplementation;
};

type ExtractBatchRowsOptions = {
  allowLlm?: boolean;
  searchWeb?: (query: string) => ReturnType<typeof searchReagentWeb>;
  fetchPages?: typeof fetchVerificationPages;
  llmConfig?: RuntimeLlmConfig;
};

const headerTokens = ["name", "名称", "vendor", "厂家", "company", "catalog", "货号", "cat", "species", "兼容", "宿主", "备注", "note"];
const headerFieldAliases = {
  name: ["name", "名称", "产品名称", "试剂名称", "reagent", "product", "品名"],
  vendor: ["vendor", "厂家", "品牌", "供应商", "company", "manufacturer", "brand"],
  catalogNo: ["catalog", "catalogno", "catalognumber", "货号", "货号编号", "cat", "catno", "货号no", "产品编号", "订货号"],
  note: ["note", "备注", "说明", "用途", "稀释", "dilution", "application", "comment"],
  antibodyCompatibilityText: ["species", "宿主", "兼容", "适用种属", "reactivity", "host", "hostspecies", "targetspecies"],
} as const;

type HeaderField = keyof typeof headerFieldAliases;
type HeaderMapping = Partial<Record<HeaderField, number>>;
const BATCH_ROW_SUPPLEMENT_CONCURRENCY = 3;
const BATCH_EXTRACT_TIMEOUT_MS = 45000;

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

function normalizeHeaderCell(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-:/()]+/g, "");
}

function findHeaderMapping(columns: string[]): HeaderMapping | null {
  const mapping: HeaderMapping = {};

  for (const [index, column] of columns.entries()) {
    const normalized = normalizeHeaderCell(column);
    if (!normalized) continue;

    for (const field of Object.keys(headerFieldAliases) as HeaderField[]) {
      if (mapping[field] !== undefined) continue;
      const aliases = headerFieldAliases[field];
      if (aliases.some((alias) => normalized.includes(normalizeHeaderCell(alias)))) {
        mapping[field] = index;
        break;
      }
    }
  }

  const matchedFieldCount = Object.keys(mapping).length;
  return matchedFieldCount >= 2 && mapping.name !== undefined ? mapping : null;
}

function getCell(columns: string[], index: number | undefined) {
  if (index === undefined) return null;
  return cleanCell(columns[index] ?? "");
}

function joinParts(parts: Array<string | null | undefined>) {
  const cleaned = parts.map((part) => cleanCell(part ?? "")).filter(Boolean);
  return cleaned.length ? cleaned.join(" | ") : null;
}

function parseTabularText(rawText: string): ExtractedBatchRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length || !lines.some((line) => line.includes("\t"))) {
    return [];
  }

  const firstColumns = lines[0]?.split("\t").map((cell) => cell.trim()) ?? [];
  const headerMapping = findHeaderMapping(firstColumns);

  if (headerMapping) {
    const usedIndexes = new Set(Object.values(headerMapping));
    return lines
      .slice(1)
      .map((line) => {
        const columns = line.split("\t").map((cell) => cell.trim());
        if (columns.length < 2) return null;

        const extraParts = columns.filter((cell, index) => !usedIndexes.has(index) && cleanCell(cell));
        const note = joinParts([getCell(columns, headerMapping.note), ...extraParts]);
        const compatibility = getCell(columns, headerMapping.antibodyCompatibilityText) ?? note;

        return normalizeRow({
          sourceText: line,
          name: getCell(columns, headerMapping.name) ?? "",
          vendor: getCell(columns, headerMapping.vendor),
          catalogNo: getCell(columns, headerMapping.catalogNo),
          note,
          antibodyCompatibilityText: compatibility,
        });
      })
      .filter((row): row is ExtractedBatchRow => !!row);
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
): Promise<ExtractedBatchRow> {
  if (row.vendor && row.catalogNo) {
    return {
      ...row,
      supplementation: {
        attemptedSearch: false,
        searchStatus: "not_needed",
        vendorInferred: false,
        catalogInferred: false,
        pageCount: 0,
      },
    };
  }

  try {
    const query = [row.name, row.vendor, row.catalogNo, row.note, row.antibodyCompatibilityText].filter(Boolean).join(" ");
    const results = await searchWeb(query);
    if (!results.length) {
      return {
        ...row,
        supplementation: {
          attemptedSearch: true,
          searchStatus: "no_results",
          vendorInferred: false,
          catalogInferred: false,
          pageCount: 0,
        },
      };
    }
    const pages = await fetchPages(results, 2);
    const evidenceText = combineEvidenceText(
      pages,
      results.map((item) => `${item.title} ${item.snippet} ${item.domain}`),
    );
    const vendor = row.vendor ?? inferVendorFromEvidence(evidenceText);
    const catalogNo = row.catalogNo ?? inferCatalogFromEvidence(evidenceText);
    const vendorInferred = !row.vendor && !!vendor;
    const catalogInferred = !row.catalogNo && !!catalogNo;
    return {
      ...row,
      vendor,
      catalogNo,
      supplementation: {
        attemptedSearch: true,
        searchStatus: vendorInferred || catalogInferred ? "filled_from_search" : "evidence_inconclusive",
        vendorInferred,
        catalogInferred,
        pageCount: pages.length,
      },
    };
  } catch {
    return {
      ...row,
      supplementation: {
        attemptedSearch: true,
        searchStatus: "request_failed",
        vendorInferred: false,
        catalogInferred: false,
        pageCount: 0,
      },
    };
  }
}

async function supplementRowsWithSearch(
  rows: ExtractedBatchRow[],
  searchWeb: typeof searchReagentWeb,
  fetchPages: typeof fetchVerificationPages,
): Promise<ExtractedBatchRow[]> {
  return mapWithConcurrency(rows, BATCH_ROW_SUPPLEMENT_CONCURRENCY, async (row) => supplementRowWithSearch(row, searchWeb, fetchPages));
}

async function parseWithLlm(rawText: string, lang: "zh" | "en", llmConfig?: RuntimeLlmConfig) {
  const client = getLlmClient({ apiKey: llmConfig?.apiKey, baseURL: llmConfig?.baseURL });
  const model = llmConfig?.model || process.env.OPENAI_MODEL || "MiniMax-M1-80k";
  const result = await withTimeout(generateLlmText(client, { baseURL: cleanUrlText(llmConfig?.baseURL) ?? cleanUrlText(process.env.OPENAI_BASE_URL), thinkingEnabled: llmConfig?.thinkingEnabled }, {
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
  }), BATCH_EXTRACT_TIMEOUT_MS, "BATCH_EXTRACT");

  const rawOutput = result.text || "[]";
  return reagentBatchExtractSchema.parse(coerceReagentBatchExtractRows(normalizeLlmParsedPayload(parseLlmJson(rawOutput)))).map((row) => ({
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
  const llmConfig = options?.llmConfig;
  const searchWeb =
    options?.searchWeb ??
    ((query: string) =>
      searchReagentWeb(query, {
        enabled: llmConfig?.searchEnabled,
        provider: llmConfig?.searchProvider,
        apiKey: llmConfig?.searchApiKey,
        baseURL: llmConfig?.searchBaseURL,
      }));
  const fetchPages = options?.fetchPages ?? fetchVerificationPages;

  const tabular = parseTabularText(trimmed);
  if (tabular.length) return tabular;

  if (options?.allowLlm === false) {
    const rows = parseLineFallback(trimmed);
    return supplementRowsWithSearch(rows, searchWeb, fetchPages);
  }

  try {
    const llmRows = await parseWithLlm(trimmed, lang, llmConfig);
    if (llmRows.length) {
      const normalized = llmRows.map((row) => normalizeRow(row)).filter((row): row is ExtractedBatchRow => !!row);
      return supplementRowsWithSearch(normalized, searchWeb, fetchPages);
    }
  } catch (error) {
    console.error("[reagent-batch-extract] llm extraction failed", {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  const rows = parseLineFallback(trimmed);
  return supplementRowsWithSearch(rows, searchWeb, fetchPages);
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
