// 模型推理等级。off 等价于旧的"深度思考关闭"；low/medium/high 在支持分级的
// 平台上透传 effort，只支持开关的平台按 关闭/开启 处理（见 client.ts 注释）。
// 该模块不依赖任何服务端包，设置页（客户端组件）也可安全引用。
export const REASONING_EFFORT_LEVELS = ["off", "low", "medium", "high"] as const;

export type ReasoningEffort = (typeof REASONING_EFFORT_LEVELS)[number];

export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "off";

export function normalizeReasoningEffort(value: string | null | undefined): ReasoningEffort | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return (REASONING_EFFORT_LEVELS as readonly string[]).includes(normalized) ? (normalized as ReasoningEffort) : null;
}

// Demo-store data is JSON and therefore does not receive Prisma migrations.
// Keep this conversion here (rather than at each caller) so an account that
// used the former boolean switch keeps the same effective behaviour after an
// upgrade.
export function reasoningEffortFromLegacyConfig(value?: {
  reasoningEffort?: string | null;
  thinkingEnabled?: boolean | null;
} | null): ReasoningEffort | null {
  const selected = normalizeReasoningEffort(value?.reasoningEffort);
  if (selected) return selected;
  if (value?.thinkingEnabled === true) return "medium";
  if (value?.thinkingEnabled === false) return "off";
  return null;
}

// 兼容旧的环境变量开关：LLM_REASONING_EFFORT 未设置时，LLM_THINKING_ENABLED=true
// 视为 medium，false 视为 off，让已部署环境的升级不改变既有行为。
export function envReasoningEffort(): ReasoningEffort | null {
  const direct = normalizeReasoningEffort(process.env.LLM_REASONING_EFFORT);
  if (direct) return direct;
  if (process.env.LLM_REASONING_EFFORT === undefined && process.env.LLM_THINKING_ENABLED !== undefined) {
    return process.env.LLM_THINKING_ENABLED !== "false" ? "medium" : "off";
  }
  return null;
}
