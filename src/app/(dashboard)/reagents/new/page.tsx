"use client";

import { useEffect, useState } from "react";
import { ReagentBatchForm } from "@/components/reagent/reagent-batch-form";
import { ReagentForm } from "@/components/reagent/reagent-form";
import { requestJson } from "@/lib/http";

type Lab = { role: string; lab: { id: string; name: string } };

export default function NewReagentPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestJson<{ items?: Lab[]; error?: string; code?: string }>("/api/labs/my").then(({ response, data }) => {
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(data?.error ?? "加载实验室失败");
        return;
      }
      const nextLabs = data?.items ?? [];
      setError(null);
      setLabs(nextLabs);
      if (nextLabs.length) {
        setLabId(nextLabs[0].lab.id);
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <section className="app-panel-strong px-6 py-6 md:px-8">
        <p className="section-kicker">Ingestion Workspace</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">新增试剂</h1>
        <p className="section-copy mt-3 max-w-2xl text-sm md:text-base">
          按照“原始信息输入、模型解析、人工确认入库”的顺序组织录入流程，让试剂知识更容易复用。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="status-pill">1. 输入原始信息</span>
          <span className="glass-badge">2. 模型解析</span>
          <span className="glass-badge">3. 人工确认入库</span>
        </div>
      </section>

      <section className="app-panel px-6 py-6">
        <div className="max-w-md">
          <label className="field-label" htmlFor="new-reagent-lab">
            选择实验室
          </label>
          <select id="new-reagent-lab" className="input-base" value={labId} onChange={(e) => setLabId(e.target.value)}>
            {labs.map((x) => (
              <option key={x.lab.id} value={x.lab.id}>
                {x.lab.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="danger-panel mt-4 text-sm">{error}</p> : null}
      </section>

      {labId ? (
        <div className="space-y-6">
          <ReagentForm labId={labId} />
          <ReagentBatchForm labId={labId} />
        </div>
      ) : null}
    </div>
  );
}
