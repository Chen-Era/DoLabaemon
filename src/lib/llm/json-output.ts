const CLOSED_THINK_BLOCK = /<think\b[^>]*>[\s\S]*?<\/think\s*>/gi;
const UNTERMINATED_THINK_BLOCK = /<think\b[^>]*>[\s\S]*$/i;
const CODE_FENCE = /```[a-zA-Z]*\s*\n?([\s\S]*?)```/g;
const MAX_BALANCED_CANDIDATES = 8;

// Reasoning models (e.g. MiniMax-M1) may embed <think>...</think> segments in
// the answer content. They are never part of the JSON payload.
function stripReasoningSegments(text: string) {
  return text.replace(CLOSED_THINK_BLOCK, "\n").replace(UNTERMINATED_THINK_BLOCK, "");
}

function extractCodeFenceBodies(text: string) {
  const bodies: string[] = [];
  CODE_FENCE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_FENCE.exec(text)) !== null) {
    bodies.push(match[1]);
  }
  return bodies;
}

// String-aware scan: for each "{" / "[" start position, walk until the matching
// closer while respecting string literals, and collect the balanced span.
function findBalancedJsonSpans(text: string) {
  const spans: string[] = [];
  for (let start = 0; start < text.length && spans.length < MAX_BALANCED_CANDIDATES; start += 1) {
    const open = text[start];
    if (open !== "{" && open !== "[") continue;
    const stack: string[] = [open === "{" ? "}" : "]"];
    let inString = false;
    let escaped = false;
    for (let i = start + 1; i < text.length; i += 1) {
      const ch = text[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        stack.push("}");
      } else if (ch === "[") {
        stack.push("]");
      } else if (ch === "}" || ch === "]") {
        if (stack[stack.length - 1] !== ch) break;
        stack.pop();
        if (stack.length === 0) {
          spans.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }
  return spans;
}

// Drop commas that sit directly before a closing brace/bracket (outside of
// strings) — a frequent near-miss in model output.
function removeTrailingCommas(text: string) {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      result += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === ",") {
      let lookahead = i + 1;
      while (lookahead < text.length && /\s/.test(text[lookahead])) lookahead += 1;
      if (text[lookahead] === "}" || text[lookahead] === "]") continue;
    }
    result += ch;
  }
  return result;
}

/**
 * Parse JSON returned by an LLM, tolerating reasoning (<think>) blocks,
 * markdown code fences, surrounding prose and trailing commas.
 * Throws an LLM_OUTPUT_NOT_JSON error when no valid JSON can be recovered.
 */
export function parseLlmJson(rawText: string): unknown {
  const cleaned = stripReasoningSegments(rawText ?? "").replace(/^\uFEFF/, "").trim();

  const candidates: string[] = [];
  const seen = new Set<string>();
  const pushCandidate = (candidate: string) => {
    const value = candidate.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  pushCandidate(cleaned);
  extractCodeFenceBodies(cleaned).forEach(pushCandidate);
  findBalancedJsonSpans(cleaned).forEach(pushCandidate);

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
    const relaxed = removeTrailingCommas(candidate);
    if (relaxed !== candidate) {
      try {
        return JSON.parse(relaxed);
      } catch (error) {
        lastError = error;
      }
    }
  }

  const preview = cleaned.length <= 200 ? cleaned : `${cleaned.slice(0, 200)}...`;
  const reason = lastError instanceof Error ? lastError.message : "no JSON candidate found";
  throw new Error(`LLM_OUTPUT_NOT_JSON: ${reason}; preview: ${preview || "(empty)"}`);
}
