"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http";
import { CUSTOM_PROVIDER_PRESET_ID, llmProviderPresets, matchProviderPreset } from "@/lib/llm/provider-presets";
import type { ReasoningEffort } from "@/lib/llm/reasoning-effort";
import { REASONING_EFFORT_LEVELS } from "@/lib/llm/reasoning-effort";

type ConfigView = {
  saved?: {
    openaiBaseUrl?: string | null;
    openaiModel?: string | null;
    openaiVisionModel?: string | null;
    searchEnabled?: boolean | null;
    searchProvider?: string | null;
    searchBaseUrl?: string | null;
    enabledSkills?: string[];
    enabledMcpServers?: string[];
    selfCheckEnabled?: boolean | null;
    autoLearnEnabled?: boolean | null;
    reasoningEffort?: ReasoningEffort | null;
    knowledgeVerifySkipEnabled?: boolean | null;
    hasOpenaiApiKey?: boolean;
    hasSearchApiKey?: boolean;
  };
  runtime?: {
    baseURL?: string | null;
    model?: string | null;
    visionModel?: string | null;
    searchEnabled?: boolean;
    searchProvider?: string | null;
    enabledSkills?: string[];
    enabledMcpServers?: string[];
    selfCheckEnabled?: boolean;
    autoLearnEnabled?: boolean;
    reasoningEffort?: ReasoningEffort;
    knowledgeVerifySkipEnabled?: boolean;
    hasApiKey?: boolean;
    hasSearchApiKey?: boolean;
  };
  error?: string;
  code?: string;
};

type FormState = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiVisionModel: string;
  searchEnabled: boolean;
  searchProvider: string;
  searchApiKey: string;
  searchBaseUrl: string;
  enabledSkills: string[];
  enabledMcpServers: string[];
  selfCheckEnabled: boolean;
  autoLearnEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  knowledgeVerifySkipEnabled: boolean;
};

type LabSummary = {
  role: "PI" | "ADMIN" | "MEMBER";
  lab: { id: string; name: string };
};

type AiPolicyView = {
  labId: string;
  role: "PI" | "ADMIN" | "MEMBER";
  canManage: boolean;
  policy: {
    allowAutoLearn: boolean;
    allowedRoles: Array<"PI" | "ADMIN" | "MEMBER">;
    enabledKnowledgeDomains: Array<"REAGENT" | "EXPERIMENT">;
  };
};

type LabLlmView = {
  labId: string;
  role: "PI" | "ADMIN" | "MEMBER";
  canManage: boolean;
  config: {
    enabled: boolean;
    configured: boolean;
    openaiBaseUrl?: string | null;
    openaiModel?: string | null;
    openaiVisionModel?: string | null;
    reasoningEffort: ReasoningEffort;
    hasOpenaiApiKey: boolean;
  };
  error?: string;
};

type LabLlmFormState = {
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiModel: string;
  openaiVisionModel: string;
  reasoningEffort: ReasoningEffort;
};

type ConnectionTestResult = {
  ok: boolean;
  model?: { ok: boolean; message: string };
  search?: { ok: boolean; message: string };
  error?: string;
};

const initialForm: FormState = {
  openaiApiKey: "",
  openaiBaseUrl: "",
  openaiModel: "",
  openaiVisionModel: "",
  searchEnabled: true,
  searchProvider: "tavily",
  searchApiKey: "",
  searchBaseUrl: "",
  enabledSkills: ["reagent-classification-curator", "experiment-type-curator", "reagent-parse-output"],
  enabledMcpServers: ["search", "fetch", "self-check"],
  selfCheckEnabled: true,
  autoLearnEnabled: false,
  reasoningEffort: "off",
  knowledgeVerifySkipEnabled: true,
};

const initialLabLlmForm: LabLlmFormState = {
  openaiApiKey: "",
  openaiBaseUrl: "",
  openaiModel: "",
  openaiVisionModel: "",
  reasoningEffort: "off",
};

const skillOptions = [
  { id: "reagent-classification-curator", label: "试剂分类" },
  { id: "experiment-type-curator", label: "实验类型" },
  { id: "reagent-parse-output", label: "结构化输出" },
];

const mcpOptions = [
  { id: "search", label: "联网检索" },
  { id: "fetch", label: "网页读取" },
  { id: "self-check", label: "结果自检" },
];

const reasoningEffortLabels: Record<ReasoningEffort, string> = {
  off: "关闭",
  low: "低",
  medium: "中",
  high: "高",
};

function isMiMoV25Model(model: string | null | undefined) {
  return /(?:xiaomi\/)?mimo-(?:v)?2\.5(?:-pro)?/.test(model?.trim().toLowerCase() ?? "");
}

const checkboxClass = "h-4 w-4 shrink-0 accent-blue-600";

function formatSaveConfigError(error?: string, code?: string) {
  switch (code) {
    case "PRISMA_CLIENT_OUTDATED":
      return "保存失败：Prisma Client 未同步最新 schema。请先执行 `npx prisma generate`，再重试保存。";
    case "DB_SCHEMA_OUTDATED":
      return "保存失败：数据库结构还没更新到最新版本。请先执行 Prisma 迁移，再重试保存。";
    case "DATABASE_UNAVAILABLE":
      return "保存失败：当前连不上数据库。请检查 DATABASE_URL、网络连通性，或确认终端代理没有影响数据库连接。";
    case "INVALID_PAYLOAD":
      return "保存失败：提交的配置格式不正确，请刷新页面后重试。";
    default:
      return error ?? "保存失败";
  }
}

function isErrorMessage(msg: string) {
  return msg.includes("失败") || msg.includes("异常") || msg.includes("未通过");
}

function roleLabel(role: "PI" | "ADMIN" | "MEMBER") {
  if (role === "PI") return "负责人";
  if (role === "ADMIN") return "管理员";
  return "成员";
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [providerPresetId, setProviderPresetId] = useState<string>(CUSTOM_PROVIDER_PRESET_ID);
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [policy, setPolicy] = useState<AiPolicyView | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [labLlm, setLabLlm] = useState<LabLlmView | null>(null);
  const [labLlmForm, setLabLlmForm] = useState<LabLlmFormState>(initialLabLlmForm);
  const [labLlmSaving, setLabLlmSaving] = useState(false);

  function toggleListValue(field: "enabledSkills" | "enabledMcpServers", value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((item) => item !== value) : [...prev[field], value],
    }));
  }

  function applyProviderPreset(id: string) {
    setProviderPresetId(id);
    if (id === CUSTOM_PROVIDER_PRESET_ID) return;
    const preset = llmProviderPresets.find((item) => item.id === id);
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      openaiBaseUrl: preset.baseUrl,
      openaiModel: preset.model ?? prev.openaiModel,
      openaiVisionModel: preset.visionModel ?? prev.openaiVisionModel,
    }));
  }

  function onBaseUrlChange(value: string) {
    setForm((prev) => ({ ...prev, openaiBaseUrl: value }));
    setProviderPresetId(matchProviderPreset(value)?.id ?? CUSTOM_PROVIDER_PRESET_ID);
  }

  function onSelectedLabChange(labId: string) {
    setSelectedLabId(labId);
    setPolicy(null);
    setLabLlm(null);
    setLabLlmForm(initialLabLlmForm);
  }

  async function loadPolicy(labId: string) {
    if (!labId) return;
    const { response, data } = await requestJson<AiPolicyView>(`/api/settings/ai-policy?labId=${encodeURIComponent(labId)}`);
    if (response.ok && data) {
      setPolicy(data);
    }
  }

  async function loadLabLlm(labId: string) {
    if (!labId) return;
    const { response, data } = await requestJson<LabLlmView>(`/api/settings/lab-llm?labId=${encodeURIComponent(labId)}`);
    if (!response.ok || !data) {
      setLabLlm(null);
      return;
    }
    setLabLlm(data);
    setLabLlmForm({
      openaiApiKey: "",
      openaiBaseUrl: data.config.openaiBaseUrl ?? "",
      openaiModel: data.config.openaiModel ?? "",
      openaiVisionModel: data.config.openaiVisionModel ?? "",
      reasoningEffort: data.config.reasoningEffort ?? "off",
    });
  }

  async function loadConfig() {
    setLoading(true);
    try {
      const { response, data } = await requestJson<ConfigView>("/api/settings/llm");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "加载配置失败");
        return;
      }
      const current = data ?? {};
      setConfig(current);
      setForm({
        openaiApiKey: "",
        openaiBaseUrl: current.saved?.openaiBaseUrl ?? "",
        openaiModel: current.saved?.openaiModel ?? "",
        openaiVisionModel: current.saved?.openaiVisionModel ?? "",
        searchEnabled: current.saved?.searchEnabled ?? current.runtime?.searchEnabled ?? true,
        searchProvider: current.saved?.searchProvider ?? current.runtime?.searchProvider ?? "tavily",
        searchApiKey: "",
        searchBaseUrl: current.saved?.searchBaseUrl ?? "",
        enabledSkills: current.saved?.enabledSkills ?? current.runtime?.enabledSkills ?? initialForm.enabledSkills,
        enabledMcpServers: current.saved?.enabledMcpServers ?? current.runtime?.enabledMcpServers ?? initialForm.enabledMcpServers,
        selfCheckEnabled: current.saved?.selfCheckEnabled ?? current.runtime?.selfCheckEnabled ?? true,
        autoLearnEnabled: current.saved?.autoLearnEnabled ?? current.runtime?.autoLearnEnabled ?? false,
        reasoningEffort: current.saved?.reasoningEffort ?? current.runtime?.reasoningEffort ?? "off",
        knowledgeVerifySkipEnabled: current.saved?.knowledgeVerifySkipEnabled ?? current.runtime?.knowledgeVerifySkipEnabled ?? true,
      });
      setProviderPresetId(matchProviderPreset(current.saved?.openaiBaseUrl)?.id ?? CUSTOM_PROVIDER_PRESET_ID);
      setMsg(null);
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
    requestJson<{ items: LabSummary[] }>("/api/labs/my").then(({ data }) => {
      const items = data?.items ?? [];
      setLabs(items);
      const nextLabId = items[0]?.lab.id ?? "";
      setSelectedLabId(nextLabId);
      if (nextLabId) {
        loadPolicy(nextLabId);
        loadLabLlm(nextLabId);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedLabId) {
      loadPolicy(selectedLabId);
      loadLabLlm(selectedLabId);
    }
  }, [selectedLabId]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const { response, data } = await requestJson<ConfigView>("/api/settings/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(formatSaveConfigError(data?.error, data?.code));
        return;
      }
      setConfig(data);
      setForm((prev) => ({ ...prev, openaiApiKey: "", searchApiKey: "" }));
      setMsg("个人配置已保存；它会优先于当前实验室的公用模型。");
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function onSavePolicy() {
    if (!selectedLabId || !policy?.policy) return;
    setPolicySaving(true);
    setMsg(null);
    try {
      const { response, data } = await requestJson<AiPolicyView>("/api/settings/ai-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId: selectedLabId,
          ...policy.policy,
        }),
      });
      if (!response.ok) {
        setMsg("实验室 AI 策略保存失败");
        return;
      }
      setPolicy(data ?? null);
      setMsg("实验室 AI 策略已保存。");
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setPolicySaving(false);
    }
  }

  async function onSaveLabLlm() {
    if (!selectedLabId) return;
    setLabLlmSaving(true);
    setMsg(null);
    try {
      const { response, data } = await requestJson<LabLlmView>("/api/settings/lab-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId: selectedLabId, ...labLlmForm, isEnabled: true }),
      });
      if (!response.ok || !data) {
        setMsg(data?.error ?? "实验室公用模型保存失败");
        return;
      }
      setLabLlm(data);
      setLabLlmForm((prev) => ({ ...prev, openaiApiKey: "" }));
      setMsg("实验室公用模型已保存；未配置个人 API Key 的成员将直接使用它。");
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setLabLlmSaving(false);
    }
  }

  async function onRemoveLabLlm() {
    if (!selectedLabId || !window.confirm("确定移除该实验室的公用模型吗？成员将恢复使用个人或服务器默认配置。")) return;
    setLabLlmSaving(true);
    setMsg(null);
    try {
      const { response, data } = await requestJson<LabLlmView>(`/api/settings/lab-llm?labId=${encodeURIComponent(selectedLabId)}`, {
        method: "DELETE",
      });
      if (!response.ok || !data) {
        setMsg(data?.error ?? "移除实验室公用模型失败");
        return;
      }
      setLabLlm(data);
      setLabLlmForm(initialLabLlmForm);
      setMsg("实验室公用模型已移除。");
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setLabLlmSaving(false);
    }
  }

  async function onTestConnection() {
    setTesting(true);
    setMsg(null);
    setTestResult(null);
    try {
      const { response, data } = await requestJson<ConnectionTestResult>("/api/settings/llm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMsg(data?.error ?? "测试连接失败");
        return;
      }
      const result = data ?? { ok: false, error: "测试结果为空" };
      setTestResult(result);
      setMsg(result.ok ? "测试连接成功" : "测试完成，但存在未通过项");
    } catch {
      setMsg("网络异常，请稍后重试");
    } finally {
      setTesting(false);
    }
  }

  const runtime = config?.runtime;
  const selectedModel = form.openaiModel || runtime?.model;
  const usesBinaryThinking = isMiMoV25Model(selectedModel);

  return (
    <div className="space-y-6">
      <section className="page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">模型与联网配置</h1>
        <p className="section-copy mt-1.5 max-w-3xl text-sm">生效顺序：个人模型配置 → 当前实验室公用模型 → 服务器默认模型。</p>
      </section>

      <section className="app-panel px-4 py-3">
        {loading ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-5 w-56" />
            <div className="skeleton h-5 w-24" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-slate-700">
              <span className="text-slate-400">文本模型</span>{" "}
              <span className="font-medium">{runtime?.model || "未设置"}</span>
            </span>
            <span className="max-w-full truncate text-slate-700 [overflow-wrap:anywhere]">
              <span className="text-slate-400">服务地址</span>{" "}
              <span className="font-medium">{runtime?.baseURL || "未设置"}</span>
            </span>
            <span className={runtime?.hasApiKey ? "status-pill success" : "status-pill warning"}>
              {runtime?.hasApiKey ? "模型密钥已就绪" : "模型密钥未配置"}
            </span>
            {runtime?.searchEnabled ? (
              <span className={runtime?.hasSearchApiKey ? "status-pill" : "status-pill warning"}>
                已启用联网搜索 / {runtime?.searchProvider || "未指定服务商"}{runtime?.hasSearchApiKey ? "" : "（缺少密钥）"}
              </span>
            ) : (
              <span className="glass-badge">联网搜索未启用</span>
            )}
          </div>
        )}
      </section>

      <div className="data-grid cols-2">
        <section className="app-panel px-5 py-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">个人模型配置</h2>
            <p className="section-copy mt-1 text-sm">密钥留空会保留已保存的值；服务地址和模型名留空则使用环境变量。</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="provider-preset">服务商模板</label>
              <select
                id="provider-preset"
                className="input-base"
                value={providerPresetId}
                onChange={(e) => applyProviderPreset(e.target.value)}
              >
                <option value={CUSTOM_PROVIDER_PRESET_ID}>自定义（手动填写）</option>
                {llmProviderPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                {llmProviderPresets.find((item) => item.id === providerPresetId)?.note
                  ?? "选择常见服务商会自动填充服务地址与推荐模型名，仍可手动修改。"}
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="openai-api-key">模型 API 密钥</label>
              <input
                id="openai-api-key"
                className="input-base"
                type="password"
                placeholder={config?.saved?.hasOpenaiApiKey ? "已保存，留空则保持不变" : "输入模型 API 密钥"}
                value={form.openaiApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="openai-base-url">服务地址</label>
              <input
                id="openai-base-url"
                className="input-base"
                placeholder="选择模板自动填充，或手动输入"
                value={form.openaiBaseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
              />
            </div>
            <div className="data-grid cols-2">
              <div>
                <label className="field-label" htmlFor="openai-model">文本模型名</label>
                <input
                  id="openai-model"
                  className="input-base"
                  placeholder="例如：gpt-4.1-mini、glm-4.6"
                  value={form.openaiModel}
                  onChange={(e) => setForm((prev) => ({ ...prev, openaiModel: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="openai-vision-model">视觉模型名</label>
                <input
                  id="openai-vision-model"
                  className="input-base"
                  placeholder="例如：gpt-4.1-mini、qwen-vl-plus"
                  value={form.openaiVisionModel}
                  onChange={(e) => setForm((prev) => ({ ...prev, openaiVisionModel: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="app-panel px-5 py-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">联网搜索配置</h2>
            <p className="section-copy mt-1 text-sm">模型不支持原生联网时，试剂纠错会自动退回这里配置的外部搜索服务。</p>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={form.searchEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, searchEnabled: e.target.checked }))}
              />
              启用联网搜索纠错
            </label>
            <div>
              <label className="field-label" htmlFor="search-provider">搜索提供方</label>
              <select
                id="search-provider"
                className="input-base"
                value={form.searchProvider}
                onChange={(e) => setForm((prev) => ({ ...prev, searchProvider: e.target.value }))}
              >
                <option value="tavily">tavily</option>
                <option value="serper">serper</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="search-api-key">搜索 API 密钥</label>
              <input
                id="search-api-key"
                className="input-base"
                type="password"
                placeholder={config?.saved?.hasSearchApiKey ? "已保存，留空则保持不变" : "输入搜索 API 密钥"}
                value={form.searchApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, searchApiKey: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="search-base-url">搜索服务地址</label>
              <input
                id="search-base-url"
                className="input-base"
                placeholder="可选，不填则使用默认地址"
                value={form.searchBaseUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, searchBaseUrl: e.target.value }))}
              />
            </div>
          </div>
        </section>
      </div>

      <section className="app-panel px-5 py-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">可用能力</h2>
          <p className="section-copy mt-1 text-sm">这里仅控制当前账号是否启用服务器提供的能力。</p>
        </div>
        <div className="data-grid cols-2">
          <div className="space-y-2.5">
            <p className="field-label">解析能力</p>
            {skillOptions.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={form.enabledSkills.includes(skill.id)}
                  onChange={() => toggleListValue("enabledSkills", skill.id)}
                />
                {skill.label}
              </label>
            ))}
          </div>
          <div className="space-y-2.5">
            <p className="field-label">联网与自检</p>
            {mcpOptions.map((server) => (
              <label key={server.id} className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={form.enabledMcpServers.includes(server.id)}
                  onChange={() => toggleListValue("enabledMcpServers", server.id)}
                />
                {server.label}
              </label>
            ))}
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={form.selfCheckEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, selfCheckEnabled: e.target.checked }))}
              />
              启用自检
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className={checkboxClass}
                checked={form.autoLearnEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, autoLearnEnabled: e.target.checked }))}
              />
              申请自动学习写回
            </label>
            <div className="pt-1">
              <p className="text-sm text-slate-700">模型推理等级</p>
              <div className={`mt-1.5 grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 ${usesBinaryThinking ? "grid-cols-2" : "grid-cols-4"}`}>
                {(usesBinaryThinking ? (["off", "medium"] as const) : REASONING_EFFORT_LEVELS).map((level) => {
                  const active = usesBinaryThinking && level === "medium" ? form.reasoningEffort !== "off" : form.reasoningEffort === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((prev) => ({ ...prev, reasoningEffort: level }))}
                      className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "border-slate-200 bg-white text-blue-700 shadow-sm"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {usesBinaryThinking && level === "medium" ? "开启（默认强度）" : reasoningEffortLabels[level]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {usesBinaryThinking
                  ? "MiMo V2.5 Pro 官方 API 只支持思考开关；开启后由模型采用默认强度。"
                  : "等级越高，推理模型思考越充分、解析更稳但更慢。OpenAI / OpenRouter 支持分级，通义千问映射为思考预算，其余平台按关闭/开启处理；MiniMax M1、Kimi K3 等固有推理模型不能关闭。"}
              </p>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                className={`${checkboxClass} mt-0.5`}
                checked={form.knowledgeVerifySkipEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, knowledgeVerifySkipEnabled: e.target.checked }))}
              />
              <span>
                知识库高置信时跳过联网验证
                <span className="mt-0.5 block text-xs text-slate-400">
                  本地试剂知识库高置信命中时直接使用知识库结果，省去联网搜索验证的等待。
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="app-panel px-5 py-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">实验室 AI 策略</h2>
          <p className="section-copy mt-1 text-sm">是否允许自动写回正式知识由实验室策略决定，可调用不等于可写回。</p>
        </div>
        <div className="space-y-4">
          <div className="max-w-sm">
            <label className="field-label" htmlFor="policy-lab">实验室</label>
            <select id="policy-lab" className="input-base" value={selectedLabId} onChange={(e) => onSelectedLabChange(e.target.value)}>
              {labs.map((item) => (
                <option key={item.lab.id} value={item.lab.id}>
                  {item.lab.name} / {roleLabel(item.role)}
                </option>
              ))}
            </select>
          </div>
          <div className="data-grid cols-2">
            <div className="space-y-2.5">
              <p className="field-label">写回开关</p>
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={policy?.policy.allowAutoLearn ?? false}
                  disabled={!policy?.canManage}
                  onChange={(e) =>
                    setPolicy((prev) =>
                      prev
                        ? {
                            ...prev,
                            policy: {
                              ...prev.policy,
                              allowAutoLearn: e.target.checked,
                            },
                          }
                        : prev,
                    )
                  }
                />
                允许自动学习写回正式知识
              </label>
            </div>
            <div className="space-y-2.5">
              <p className="field-label">允许写回角色</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {(["PI", "ADMIN", "MEMBER"] as const).map((role) => (
                  <label key={role} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={policy?.policy.allowedRoles.includes(role) ?? false}
                      disabled={!policy?.canManage}
                      onChange={(e) =>
                        setPolicy((prev) =>
                          prev
                            ? {
                                ...prev,
                                policy: {
                                  ...prev.policy,
                                  allowedRoles: e.target.checked
                                    ? [...prev.policy.allowedRoles, role]
                                    : prev.policy.allowedRoles.filter((item) => item !== role),
                                },
                              }
                            : prev,
                        )
                      }
                    />
                    {roleLabel(role)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div>
            <button type="button" onClick={onSavePolicy} className="button-secondary" disabled={!policy?.canManage || policySaving}>
              {policySaving ? "保存中..." : "保存实验室策略"}
            </button>
          </div>
        </div>
      </section>

      <section className="app-panel px-5 py-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">实验室公用大模型</h2>
          <p className="section-copy mt-1 text-sm">
            由负责人或管理员维护。密钥会在服务器端加密保存；未配置个人 API Key 的成员可直接使用，且无法读取或导出密钥。
          </p>
        </div>
        <div className="mb-4 max-w-sm">
          <label className="field-label" htmlFor="lab-llm-lab">配置实验室</label>
          <select
            id="lab-llm-lab"
            className="input-base"
            value={selectedLabId}
            disabled={!labs.length}
            onChange={(e) => onSelectedLabChange(e.target.value)}
          >
            {labs.length ? labs.map((item) => (
              <option key={item.lab.id} value={item.lab.id}>
                {item.lab.name} / {roleLabel(item.role)}
              </option>
            )) : <option value="">暂无可用实验室</option>}
          </select>
          <p className="field-hint">公用模型只保存到这里选定的实验室，不会影响其他实验室。</p>
        </div>
        {!selectedLabId ? (
          <p className="text-sm text-slate-500">请先选择一个实验室。</p>
        ) : labLlm?.canManage ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={labLlm.config.configured ? "status-pill success" : "status-pill warning"}>
                {labLlm.config.configured ? "公用模型已就绪" : "尚未配置公用模型"}
              </span>
              <span className="text-slate-500">适用于：{labs.find((item) => item.lab.id === selectedLabId)?.lab.name ?? "当前实验室"}</span>
            </div>
            <div className="data-grid cols-2">
              <div>
                <label className="field-label" htmlFor="lab-openai-api-key">模型 API 密钥</label>
                <input
                  id="lab-openai-api-key"
                  className="input-base"
                  type="password"
                  placeholder={labLlm.config.hasOpenaiApiKey ? "已加密保存，留空则保持不变" : "输入实验室公用 API 密钥"}
                  value={labLlmForm.openaiApiKey}
                  onChange={(e) => setLabLlmForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="lab-openai-base-url">服务地址</label>
                <input
                  id="lab-openai-base-url"
                  className="input-base"
                  placeholder="可选，不填使用服务商默认地址"
                  value={labLlmForm.openaiBaseUrl}
                  onChange={(e) => setLabLlmForm((prev) => ({ ...prev, openaiBaseUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="lab-openai-model">文本模型</label>
                <input
                  id="lab-openai-model"
                  className="input-base"
                  placeholder="例如 gpt-4.1-mini"
                  value={labLlmForm.openaiModel}
                  onChange={(e) => setLabLlmForm((prev) => ({ ...prev, openaiModel: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="lab-openai-vision-model">视觉模型</label>
                <input
                  id="lab-openai-vision-model"
                  className="input-base"
                  placeholder="可选，留空则使用文本模型"
                  value={labLlmForm.openaiVisionModel}
                  onChange={(e) => setLabLlmForm((prev) => ({ ...prev, openaiVisionModel: e.target.value }))}
                />
              </div>
            </div>
            <div className="max-w-sm">
              <label className="field-label" htmlFor="lab-reasoning-effort">模型推理等级</label>
              <select
                id="lab-reasoning-effort"
                className="input-base"
                value={labLlmForm.reasoningEffort}
                onChange={(e) => setLabLlmForm((prev) => ({ ...prev, reasoningEffort: e.target.value as ReasoningEffort }))}
              >
                {REASONING_EFFORT_LEVELS.map((level) => <option key={level} value={level}>{reasoningEffortLabels[level]}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onSaveLabLlm} className="button-primary" disabled={labLlmSaving}>
                {labLlmSaving ? "保存中..." : "保存公用模型"}
              </button>
              {labLlm.config.hasOpenaiApiKey ? (
                <button type="button" onClick={onRemoveLabLlm} className="button-secondary" disabled={labLlmSaving}>
                  移除公用模型
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={labLlm?.config.configured ? "status-pill success" : "status-pill warning"}>
              {labLlm?.config.configured ? `可直接使用：${labLlm.config.openaiModel}` : "负责人或管理员尚未配置公用模型"}
            </span>
            <span className="text-slate-500">
              {labLlm?.config.configured ? "成员无需填写个人模型密钥。" : "配置完成后，成员即可直接使用，无需填写个人模型密钥。"}
            </span>
          </div>
        )}
      </section>

      <section className="app-panel px-5 py-5">
        <h2 className="text-base font-semibold text-slate-900">当前生效配置</h2>
        {loading ? (
          <div className="data-grid cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-14" />
            ))}
          </div>
        ) : (
          <dl className="data-grid cols-2 mt-4">
            {[
              ["生效文本模型", runtime?.model || "未设置"],
              ["生效视觉模型", runtime?.visionModel || "未设置"],
              ["推理等级", reasoningEffortLabels[runtime?.reasoningEffort ?? "off"]],
              ["联网搜索", runtime?.searchEnabled ? `启用 / ${runtime.searchProvider || "未指定服务商"}` : "未启用"],
              ["已启用能力", `${runtime?.enabledSkills?.length ?? 0} 项解析能力，${runtime?.enabledMcpServers?.length ?? 0} 项工具能力`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="app-panel px-5 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onSave} className="button-primary" disabled={saving}>
            {saving ? "保存中..." : "保存配置"}
          </button>
          <button type="button" onClick={onTestConnection} className="button-secondary" disabled={testing}>
            {testing ? "测试中..." : "测试连接"}
          </button>
        </div>
        {testResult ? (
          <div className="mt-4 space-y-2">
            <div className={`px-3 py-2.5 text-sm ${testResult.model?.ok ? "success-panel" : "warning-panel"}`}>
              模型接口：{testResult.model?.message ?? "未测试"}
            </div>
            <div className={`px-3 py-2.5 text-sm ${testResult.search?.ok ? "success-panel" : "warning-panel"}`}>
              搜索接口：{testResult.search?.message ?? "未测试"}
            </div>
          </div>
        ) : null}
        {msg ? (
          <p className={`mt-4 px-3 py-2.5 text-sm ${isErrorMessage(msg) ? "danger-panel" : "success-panel"}`}>{msg}</p>
        ) : null}
      </section>
    </div>
  );
}
