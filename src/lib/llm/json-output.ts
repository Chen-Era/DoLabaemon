const CLOSED_THINK_BLOCK = /<think\b[^>]*>[\s\S]*?<\/think\s*>/gi;
const UNTERMINATED_THINK_BLOCK = /<think\b[^>]*>[\s\S]*$/i;
const CODE_FENCE = /```[a-zA-Z]*\s*\n?([\s\S]*?)```/g;
const MAX_BALANCED_CANDIDATES = 8;
const MAX_REPAIR_ATTEMPTS = 12;

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

// Detect truncation: the text ends with open brackets or inside a string.
function hasUnbalancedStructure(text: string) {
  let inString = false;
  let escaped = false;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
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
    } else if (ch === "{" || ch === "[") {
      depth += 1;
    } else if (ch === "}" || ch === "]") {
      depth -= 1;
    }
  }
  return inString || depth !== 0;
}

// Models that hit their max-token budget return JSON cut off mid-stream.
// Salvage it: walk back from the end to each top-level comma, close any open
// string and bracket stack, and keep the longest fragment that parses.
function repairTruncatedJson(candidate: string): string[] {
  const trimmed = candidate.trim();
  const first = trimmed[0];
  if (first !== "{" && first !== "[") return [];

  const commaPositions: number[] = [];
  {
    let inString = false;
    let escaped = false;
    let depth = 0;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
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
      } else if (ch === "{" || ch === "[") {
        depth += 1;
      } else if (ch === "}" || ch === "]") {
        depth -= 1;
      } else if (ch === "," && depth >= 1) {
        commaPositions.push(i);
      }
    }
  }

  const cutPositions = [trimmed.length, ...commaPositions.reverse()].slice(0, MAX_REPAIR_ATTEMPTS);
  const repairs: string[] = [];

  for (const cut of cutPositions) {
    let fragment = trimmed.slice(0, cut).trimEnd();
    if (!fragment) continue;

    let inString = false;
    let escaped = false;
    const stack: string[] = [];
    for (let i = 0; i < fragment.length; i += 1) {
      const ch = fragment[i];
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
        if (stack[stack.length - 1] === ch) stack.pop();
      }
    }

    if (inString) {
      // A trailing lone backslash would escape the quote we are about to add.
      if (fragment.endsWith("\\")) fragment = fragment.slice(0, -1);
      fragment += '"';
    }
    // A fragment cut right after a key's colon ({"a":) can never parse; the
    // next attempt cuts at the preceding comma instead.
    fragment += stack.reverse().join("");
    if (fragment !== trimmed) {
      repairs.push(fragment);
    }
  }

  return repairs;
}

/**
 * Parse JSON returned by an LLM, tolerating reasoning (<think>) blocks,
 * markdown code fences, surrounding prose and trailing commas.
 * Throws an LLM_OUTPUT_NOT_JSON error when no valid JSON can be recovered.
 */
export function parseLlmJson(rawText: string): unknown {
  const cleaned = stripReasoningSegments(rawText ?? "").replace(/^\uFEFF/, "").trim();

  const seen = new Set<string>();
  const directCandidates: string[] = [];
  const pushCandidate = (list: string[]) => (candidate: string) => {
    const value = candidate.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    list.push(value);
  };

  const pushDirect = pushCandidate(directCandidates);
  pushDirect(cleaned);
  extractCodeFenceBodies(cleaned).forEach(pushDirect);
  const spanCandidates: string[] = [];
  findBalancedJsonSpans(cleaned).forEach(pushCandidate(spanCandidates));

  const parseCandidate = (candidate: string) => {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      const relaxed = removeTrailingCommas(candidate);
      if (relaxed !== candidate) {
        return JSON.parse(relaxed);
      }
      throw error;
    }
  };

  let lastError: unknown = null;
  for (const candidate of directCandidates) {
    try {
      return parseCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const truncated = hasUnbalancedStructure(cleaned);
  const tryRepairs = () => {
    for (const candidate of directCandidates) {
      for (const repaired of repairTruncatedJson(candidate)) {
        try {
          return parseCandidate(repaired);
        } catch (error) {
          lastError = error;
        }
      }
    }
    return undefined;
  };

  // Truncated output (max-token cut-off): salvage the longest parseable
  // fragment before accepting small inner spans like "[]" that would
  // otherwise win over the surrounding object. When brackets are balanced
  // overall, spans are the trustworthy extraction and go first.
  if (truncated) {
    const repairedResult = tryRepairs();
    if (repairedResult !== undefined) return repairedResult;
  }

  for (const candidate of spanCandidates) {
    try {
      return parseCandidate(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  if (!truncated) {
    const repairedResult = tryRepairs();
    if (repairedResult !== undefined) return repairedResult;
  }

  const preview = cleaned.length <= 200 ? cleaned : `${cleaned.slice(0, 200)}...`;
  const reason = lastError instanceof Error ? lastError.message : "no JSON candidate found";
  throw new Error(`LLM_OUTPUT_NOT_JSON: ${reason}; preview: ${preview || "(empty)"}`);
}
