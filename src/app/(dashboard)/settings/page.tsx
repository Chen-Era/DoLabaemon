"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http";
import { CUSTOM_PROVIDER_PRESET_ID, llmProviderPresets, matchProviderPreset } from "@/lib/llm/provider-presets";

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
  enabledSkills: ["reagent-classification-curator", "experiment-type-curator"],
  enabledMcpServers: ["search", "fetch", "self-check"],
  selfCheckEnabled: true,
  autoLearnEnabled: false,
};

const skillOptions = [
  { id: "reagent-classification-curator", label: "试剂分类 skill" },
  { id: "experiment-type-curator", label: "实验类型 skill" },
];

const mcpOptions = [
  { id: "search", label: "Search MCP" },
  { id: "fetch", label: "Fetch MCP" },
  { id: "self-check", label: "Self Check MCP" },
];

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

  async function loadPolicy(labId: string) {
    if (!labId) return;
    const { response, data } = await requestJson<AiPolicyView>(`/api/settings/ai-policy?labId=${encodeURIComponent(labId)}`);
    if (response.ok && data) {
      setPolicy(data);
    }
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
      }
    });
  }, []);

  useEffect(() => {
    if (selectedLabId) {
      loadPolicy(selectedLabId);
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
      setMsg("配置已保存，后续模型调用将优先使用这里的设置。");
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

  return (
    <div className="space-y-6">
      <section className="app-panel-strong px-6 py-6 md:px-8">
        <p className="section-kicker">Model Settings</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">模型与联网搜索配置</h1>
        <p className="section-copy mt-3 max-w-3xl text-sm md:text-base">
          在页面中维护你自己的 API Key、模型名、视觉模型和联网搜索配置。保存后，试剂解析、批量拆行、图片识别和实验类型解析都会优先使用这里的设置。
        </p>
      </section>

      <div className="data-grid cols-2">
        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Credentials</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">模型配置</h2>
            <p className="section-copy mt-2 text-sm">密钥字段留空时保持已保存值不变；Base URL / 模型名留空时回退到环境变量。</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label">服务商模板</label>
              <select
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
              <p className="mt-1 text-xs text-slate-500">
                {llmProviderPresets.find((item) => item.id === providerPresetId)?.note
                  ?? "选择常见服务商会自动填充 Base URL 与推荐模型名，仍可手动修改。"}
              </p>
            </div>
            <div>
              <label className="field-label">OpenAI 兼容 API Key</label>
              <input
                className="input-base"
                type="password"
                placeholder={config?.saved?.hasOpenaiApiKey ? "已保存，留空则保持不变" : "输入模型 API Key"}
                value={form.openaiApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, openaiApiKey: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Base URL</label>
              <input
                className="input-base"
                placeholder="选择模板自动填充，或手动输入"
                value={form.openaiBaseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">文本模型名</label>
              <input
                className="input-base"
                placeholder="例如：gpt-4.1-mini、glm-4.6"
                value={form.openaiModel}
                onChange={(e) => setForm((prev) => ({ ...prev, openaiModel: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">视觉模型名</label>
              <input
                className="input-base"
                placeholder="例如：gpt-4.1-mini、qwen-vl-plus"
                value={form.openaiVisionModel}
                onChange={(e) => setForm((prev) => ({ ...prev, openaiVisionModel: e.target.value }))}
              />
            </div>
          </div>
        </section>

        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Web Search</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">联网搜索配置</h2>
            <p className="section-copy mt-2 text-sm">当前模型不支持原生联网时，试剂纠错会自动退回到这里配置的外部搜索服务。</p>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.searchEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, searchEnabled: e.target.checked }))}
              />
              启用联网搜索纠错
            </label>
            <div>
              <label className="field-label">搜索提供方</label>
              <select
                className="input-base"
                value={form.searchProvider}
                onChange={(e) => setForm((prev) => ({ ...prev, searchProvider: e.target.value }))}
              >
                <option value="tavily">tavily</option>
                <option value="serper">serper</option>
              </select>
            </div>
            <div>
              <label className="field-label">搜索 API Key</label>
              <input
                className="input-base"
                type="password"
                placeholder={config?.saved?.hasSearchApiKey ? "已保存，留空则保持不变" : "输入搜索 API Key"}
                value={form.searchApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, searchApiKey: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">搜索 Base URL</label>
              <input
                className="input-base"
                placeholder="可选，不填则使用默认地址"
                value={form.searchBaseUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, searchBaseUrl: e.target.value }))}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="data-grid cols-2">
        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Skills</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">运行时 Skill</h2>
            <p className="section-copy mt-2 text-sm">这些 skill 由服务器统一发布，网页端只控制本账号是否启用。</p>
          </div>
          <div className="space-y-3">
            {skillOptions.map((skill) => (
              <label key={skill.id} className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabledSkills.includes(skill.id)}
                  onChange={() => toggleListValue("enabledSkills", skill.id)}
                />
                {skill.label}
              </label>
            ))}
          </div>
        </section>

        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">MCP</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">运行时 MCP</h2>
            <p className="section-copy mt-2 text-sm">统一启用搜索、抓取与自检服务器能力。</p>
          </div>
          <div className="space-y-3">
            {mcpOptions.map((server) => (
              <label key={server.id} className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.enabledMcpServers.includes(server.id)}
                  onChange={() => toggleListValue("enabledMcpServers", server.id)}
                />
                {server.label}
              </label>
            ))}
            <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.selfCheckEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, selfCheckEnabled: e.target.checked }))}
              />
              启用自检
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.autoLearnEnabled}
                onChange={(e) => setForm((prev) => ({ ...prev, autoLearnEnabled: e.target.checked }))}
              />
              申请自动学习写回
            </label>
          </div>
        </section>
      </div>

      <section className="app-panel px-6 py-6">
        <div className="mb-5">
          <p className="section-kicker">Lab Policy</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">实验室 AI 策略</h2>
          <p className="section-copy mt-2 text-sm">是否允许自动写回正式知识由实验室策略决定，可调用不等于可写回。</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="field-label">实验室</label>
            <select className="input-base" value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)}>
              {labs.map((item) => (
                <option key={item.lab.id} value={item.lab.id}>
                  {item.lab.name} / {item.role}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
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
          <div>
            <p className="field-label">允许写回角色</p>
            <div className="space-y-2 pt-2">
              {(["PI", "ADMIN", "MEMBER"] as const).map((role) => (
                <label key={role} className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
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
                  {role}
                </label>
              ))}
            </div>
          </div>
          <button type="button" onClick={onSavePolicy} className="button-secondary" disabled={!policy?.canManage || policySaving}>
            {policySaving ? "保存中..." : "保存实验室策略"}
          </button>
        </div>
      </section>

      <section className="app-panel px-6 py-6">
        <div className="mb-5">
          <p className="section-kicker">Runtime</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">当前生效配置</h2>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">加载中...</p>
        ) : (
          <div className="data-grid">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">生效 Base URL</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.baseURL || "未设置"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">生效文本模型</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.model || "未设置"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">生效视觉模型</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.visionModel || "未设置"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">联网搜索</p>
              <p className="mt-2 text-sm text-slate-900">
                {config?.runtime?.searchEnabled ? `启用 / ${config.runtime.searchProvider || "未指定 provider"}` : "未启用"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">运行时 Skill</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.enabledSkills?.join(", ") || "未启用"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">运行时 MCP</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.enabledMcpServers?.join(", ") || "未启用"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">模型 Key</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.hasApiKey ? "已就绪" : "未配置"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">搜索 Key</p>
              <p className="mt-2 text-sm text-slate-900">{config?.runtime?.hasSearchApiKey ? "已就绪" : "未配置"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-500">自检与学习</p>
              <p className="mt-2 text-sm text-slate-900">
                {config?.runtime?.selfCheckEnabled ? "自检开启" : "自检关闭"} / {config?.runtime?.autoLearnEnabled ? "申请自动学习" : "不自动学习"}
              </p>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onSave} className="button-primary" disabled={saving}>
            {saving ? "保存中..." : "保存配置"}
          </button>
          <button type="button" onClick={onTestConnection} className="button-secondary" disabled={testing}>
            {testing ? "测试中..." : "测试连接"}
          </button>
        </div>
        {testResult ? (
          <div className="mt-4 space-y-3">
            <div className={`rounded-2xl px-4 py-3 text-sm ${testResult.model?.ok ? "success-panel" : "warning-panel"}`}>
              模型接口：{testResult.model?.message ?? "未测试"}
            </div>
            <div className={`rounded-2xl px-4 py-3 text-sm ${testResult.search?.ok ? "success-panel" : "warning-panel"}`}>
              搜索接口：{testResult.search?.message ?? "未测试"}
            </div>
          </div>
        ) : null}
        {msg ? <p className={`mt-4 text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}>{msg}</p> : null}
      </section>
    </div>
  );
}
