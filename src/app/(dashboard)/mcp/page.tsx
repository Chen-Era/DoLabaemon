"use client";

import { useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/http";

type TokenItem = {
  id: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "永不过期";
}

export default function McpAccessPage() {
  const [items, setItems] = useState<TokenItem[]>([]);
  const [label, setLabel] = useState("本地实验记录助手");
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [origin, setOrigin] = useState("");

  const endpoint = useMemo(() => (origin ? `${origin}/api/mcp` : "https://dorlabaemon.era.ac.cn/api/mcp"), [origin]);
  const configuration = `{
  "mcpServers": {
    "dorlabaemon-inventory": {
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer ${secret ?? "${DORLABAEMON_MCP_TOKEN}"}"
      }
    }
  }
}`;

  async function loadTokens() {
    setLoading(true);
    try {
      const { response, data } = await requestJson<{ items?: TokenItem[]; error?: string }>("/api/mcp/tokens");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setMessage(data?.error ?? "无法加载 MCP 令牌");
        return;
      }
      setItems(data?.items ?? []);
    } catch {
      setMessage("网络异常，无法加载 MCP 令牌");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadTokens();
  }, []);

  async function createToken() {
    setSubmitting(true);
    setMessage(null);
    setSecret(null);
    try {
      const { response, data } = await requestJson<{ token?: string; item?: TokenItem; error?: string }>("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, expiresInDays }),
      });
      if (!response.ok || !data?.token || !data.item) {
        setMessage(data?.error ?? "创建令牌失败");
        return;
      }
      setSecret(data.token);
      setItems((current) => [data.item!, ...current]);
      setMessage("令牌只显示这一次。请立即复制到本地模型或受控的 Agent 密钥库。它只允许读取库存。");
    } catch {
      setMessage("网络异常，创建令牌失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeToken(tokenId: string) {
    if (!window.confirm("撤销后，使用该令牌的模型将立刻失去库存读取权限。是否继续？")) return;
    setMessage(null);
    try {
      const { response, data } = await requestJson<{ item?: TokenItem; error?: string }>("/api/mcp/tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });
      if (!response.ok || !data?.item) {
        setMessage(data?.error ?? "撤销令牌失败");
        return;
      }
      setItems((current) => current.map((item) => (item.id === tokenId ? data.item! : item)));
      setMessage("令牌已撤销。");
    } catch {
      setMessage("网络异常，撤销令牌失败");
    }
  }

  return (
    <div className="space-y-6">
      <section className="section-card space-y-4">
        <div>
          <p className="eyebrow">Dorlabaemon MCP</p>
          <h1 className="section-title">受限库存读取</h1>
          <p className="section-description">模型只能读取你有成员权限的实验室中的最小试剂字段。库存命中不等于本次实验实际使用；多候选时模型必须让你确认。</p>
        </div>
        <dl className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><dt className="text-xs text-slate-500">MCP endpoint</dt><dd className="mt-1 break-all font-mono text-sm text-slate-800">{endpoint}</dd></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><dt className="text-xs text-slate-500">可用工具</dt><dd className="mt-1 text-sm text-slate-800">实验室列表、试剂检索、WB 一抗解析</dd></div>
        </dl>
      </section>

      <section className="section-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">创建个人访问令牌</h2>
          <p className="mt-1 text-sm text-slate-600">令牌由已登录的 Dorlabaemon 用户创建，默认 30 天后到期，可随时撤销。不要把它发送到聊天消息、实验记录或 Git 仓库。</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_10rem_auto]">
          <label className="block"><span className="field-label">用途</span><input className="field-input mt-1 w-full" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} /></label>
          <label className="block"><span className="field-label">有效期</span><select className="field-input mt-1 w-full" value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))}><option value={7}>7 天</option><option value={30}>30 天</option><option value={90}>90 天</option></select></label>
          <button type="button" className="btn-primary self-end" onClick={() => void createToken()} disabled={submitting || !label.trim()}>{submitting ? "创建中…" : "创建令牌"}</button>
        </div>
        {secret ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-medium text-amber-950">仅此一次显示</p><code className="mt-2 block break-all rounded bg-white p-3 text-sm text-slate-900">{secret}</code><button type="button" className="btn-secondary mt-3" onClick={() => void navigator.clipboard.writeText(secret)}>复制令牌</button></div> : null}
        <div><p className="field-label">本地模型配置示例</p><pre className="mt-1 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{configuration}</pre></div>
      </section>

      <section className="section-card space-y-4">
        <div><h2 className="text-lg font-semibold text-slate-900">已创建令牌</h2><p className="mt-1 text-sm text-slate-600">不会再次显示完整令牌。撤销会立即阻断后续 MCP 请求。</p></div>
        {loading ? <p className="text-sm text-slate-600">加载中…</p> : items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="p-2">用途</th><th className="p-2">令牌前缀</th><th className="p-2">到期</th><th className="p-2">最近使用</th><th className="p-2">状态</th><th className="p-2">操作</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="p-2">{item.label}</td><td className="p-2 font-mono">{item.tokenPrefix}…</td><td className="p-2">{formatDate(item.expiresAt)}</td><td className="p-2">{item.lastUsedAt ? formatDate(item.lastUsedAt) : "尚未使用"}</td><td className="p-2">{item.revokedAt ? "已撤销" : "有效"}</td><td className="p-2">{item.revokedAt ? null : <button type="button" className="btn-secondary text-xs" onClick={() => void revokeToken(item.id)}>撤销</button>}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-600">尚未创建令牌。</p>}
      </section>
      {message ? <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700" role="status">{message}</p> : null}
    </div>
  );
}
