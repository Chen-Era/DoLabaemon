"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LabsIcon } from "@/components/common/app-icons";
import { ReagentBatchForm } from "@/components/reagent/reagent-batch-form";
import { ReagentForm } from "@/components/reagent/reagent-form";
import { requestJson } from "@/lib/http";

type Lab = { role: string; lab: { id: string; name: string } };

export default function NewReagentPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void requestJson<{ items?: Lab[]; error?: string; code?: string }>("/api/labs/my")
      .then(({ response, data }) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          setError(data?.error ?? "读取实验室失败，请稍后再试。");
          setLoading(false);
          return;
        }
        const nextLabs = data?.items ?? [];
        setError(null);
        setLabs(nextLabs);
        if (nextLabs.length) {
          setLabId(nextLabs[0].lab.id);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("网络异常，暂时无法读取实验室。");
        setLoading(false);
      });
  }, []);

  const showNoLabs = !loading && !error && labs.length === 0;

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">新增试剂</h1>
            <p className="section-copy mt-1.5 max-w-2xl text-sm">填写信息，核对识别结果后确认入库。</p>
          </div>
          {showNoLabs ? null : (
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
          )}
        </div>
        {error ? <p className="danger-panel mt-4 text-sm">{error}</p> : null}
      </header>

      {showNoLabs ? (
        <section className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
            <LabsIcon className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-slate-950">你还没有加入任何实验室</h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            可以先创建自己的实验室，或使用邀请码申请加入同事的实验室；加入后即可开始录入试剂。
          </p>
          <Link href="/labs" className="button-primary mt-5">
            前往实验室
          </Link>
        </section>
      ) : labId ? (
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
