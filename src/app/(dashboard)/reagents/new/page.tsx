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
    void requestJson<{ items?: Lab[]; error?: string; code?: string }>("/api/labs/my")
      .then(({ response, data }) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          setError(data?.error ?? "读取实验室失败，请稍后再试。");
          return;
        }
        const nextLabs = data?.items ?? [];
        setError(null);
        setLabs(nextLabs);
        if (nextLabs.length) {
          setLabId(nextLabs[0].lab.id);
        }
      })
      .catch(() => setError("网络异常，暂时无法读取实验室。"));
  }, []);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">新增试剂</h1>
            <p className="section-copy mt-1.5 max-w-2xl text-sm">填写信息，核对识别结果后确认入库。</p>
          </div>
          <div className="w-full max-w-xs">
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
        </div>
        {error ? <p className="danger-panel mt-4 text-sm">{error}</p> : null}
      </header>

      {labId ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">单条录入</h2>
              <p className="section-copy mt-1 text-sm">适合逐条核对名称、货号与备注。</p>
            </div>
            <ReagentForm labId={labId} />
          </section>

          <div className="subtle-divider" />

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">批量录入</h2>
              <p className="section-copy mt-1 text-sm">粘贴表格文本或图片，统一核对后入库。</p>
            </div>
            <ReagentBatchForm labId={labId} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
