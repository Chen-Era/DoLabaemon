import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { techniqueCategoryLabels } from "@/lib/experiment-techniques/catalog";
import { toPlainLanguageTechniqueScope } from "@/lib/experiment-techniques/presentation";
import { validateTechniqueForPublication } from "@/lib/experiment-techniques/publication";
import {
  getPublishedTechnique,
  listPublishedTechniques,
} from "@/lib/experiment-techniques/runtime";
import { evidenceSourceById } from "@/lib/experiment-techniques/sources";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const requirementKindLabels: Record<string, string> = {
  REAGENT: "试剂",
  CONSUMABLE: "耗材",
  INSTRUMENT: "仪器",
  SAMPLE: "样本",
  CONTROL: "对照",
  SOFTWARE: "软件",
};

export default async function TechniqueDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "zh";
  const localize = (zh: string, en: string) => (locale === "en" ? en : zh);
  await requireUser();
  const { code } = await params;
  const technique = await getPublishedTechnique(decodeURIComponent(code));
  if (!technique) notFound();
  const sources = technique.evidenceSourceIds
    .map((id) => evidenceSourceById.get(id))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));
  const publicationGate = validateTechniqueForPublication(technique);
  const related = (await listPublishedTechniques())
    .filter(
      (item) =>
        item.code !== technique.code &&
        item.categoryCode === technique.categoryCode,
    )
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/knowledge" className="text-sm font-semibold text-teal-700 hover:text-teal-900">
          {localize("← 返回技术图谱", "← Back to technique map")}
        </Link>
      </div>

      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-3 py-1 font-mono text-xs text-teal-100">
                {technique.code} · r{technique.revision}
              </span>
              <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">
                {technique.status}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {technique.name[locale]}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400">
              {technique.aliases.join(" · ")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm">
            <p className="font-semibold text-white">
              {techniqueCategoryLabels[technique.categoryCode][locale]}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-xs">
              <dt className="text-slate-500">{localize("子分类", "Subcategory")}</dt>
              <dd className="text-right text-slate-300">{technique.subcategoryCode}</dd>
              <dt className="text-slate-500">{localize("通量", "Throughput")}</dt>
              <dd className="text-right text-slate-300">{technique.throughput}</dd>
              <dt className="text-slate-500">{localize("风险", "Risk")}</dt>
              <dd className="text-right text-slate-300">{technique.safety.riskLevel}</dd>
              <dt className="text-slate-500">{localize("破坏性", "Destructive")}</dt>
              <dd className="text-right text-slate-300">{technique.destructive ? localize("是", "Yes") : localize("否", "No")}</dd>
            </dl>
          </div>
        </div>
      </header>

      {!publicationGate.publishable ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{localize("正式发布证据门禁尚未完全满足", "The publication evidence gate is not fully satisfied")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {publicationGate.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-6">
          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("这项实验怎么做、能做什么", "How this technique works and what it can do")}</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{localize("实验怎么做", "How it works")}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{technique.principle[locale]}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{localize("适合解决什么问题", "What it helps answer")}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{locale === "en" ? technique.scope.en : toPlainLanguageTechniqueScope(technique.scope.zh)}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <TagBlock title={localize("样本", "Samples")} values={technique.sampleTypes} />
              <TagBlock title={localize("输入", "Inputs")} values={technique.inputTypes} />
              <TagBlock title={localize("输出 / 读出", "Outputs / readouts")} values={[...technique.outputTypes, ...technique.readoutModes]} />
            </div>
          </section>

          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("结构化工作流", "Structured workflow")}</h2>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              {technique.workflowStages.map((stage) => (
                <li key={stage.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                    {stage.order}
                  </span>
                  <p className="mt-3 font-semibold text-slate-900">{stage.label[locale]}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{stage.objective[locale]}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("资源要求", "Resource requirements")}</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-3">{localize("类型", "Type")}</th>
                    <th className="px-3 py-3">{localize("要求", "Requirement")}</th>
                    <th className="px-3 py-3">{localize("级别", "Level")}</th>
                    <th className="px-3 py-3">{localize("验证", "Verification")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {technique.requirements.map((requirement) => (
                    <tr key={requirement.id}>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">
                        {localize(requirementKindLabels[requirement.kind], requirement.kind.toLowerCase())}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-slate-800">{requirement.label[locale]}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{requirement.level}</td>
                      <td className="px-3 py-3 text-slate-600">{requirement.verificationMode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {technique.profiles.length ? (
            <section className="app-panel p-5">
              <h2 className="text-lg font-semibold text-slate-950">{localize("应用 Profile", "Application profiles")}</h2>
              <div className="mt-4 space-y-3">
                {technique.profiles.map((profile) => (
                  <article key={profile.code} className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                    <p className="font-mono text-xs font-semibold text-violet-700">{profile.code}</p>
                    <h3 className="mt-1 font-semibold text-slate-900">{profile.name[locale]}</h3>
                    <p className="mt-2 text-sm text-slate-600">{profile.description[locale]}</p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {profile.additionalRequirements.map((item) => (
                        <li key={item.id}>{item.label[locale]}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("QC、局限与故障排查", "QC, limitations, and troubleshooting")}</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="font-semibold text-emerald-900">{localize("质量控制", "Quality control")}</p>
                {technique.qcMetrics.map((metric) => (
                  <div key={metric.id} className="mt-3">
                    <p className="text-sm font-semibold text-slate-800">{metric.label[locale]}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{metric.acceptance[locale]}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{localize("局限", "Limitations")}</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  {technique.limitations[locale].map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <p className="font-semibold text-amber-900">{localize("故障排查", "Troubleshooting")}</p>
                {technique.troubleshooting.map((item) => (
                  <div key={item.symptom[locale]} className="mt-3 text-sm">
                    <p className="font-semibold text-slate-800">{item.symptom[locale]}</p>
                    <p className="mt-1 leading-6 text-slate-600">{item.action[locale]}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>

        <aside className="space-y-6">
          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("安全", "Safety")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{localize("生物安全", "Biosafety")}</dt>
                <dd className="font-semibold text-slate-800">{technique.safety.biosafetyLevel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">{localize("风险等级", "Risk level")}</dt>
                <dd className="font-semibold text-slate-800">{technique.safety.riskLevel}</dd>
              </div>
            </dl>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
              {technique.safety.hazards.map((hazard) => <li key={hazard}>{hazard}</li>)}
            </ul>
            <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm leading-6 text-rose-800">
              {technique.safety.waste[locale]}
            </p>
          </section>

          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("需要记录的关键参数", "Key parameters to record")}</h2>
            <div className="mt-4 space-y-3">
              {technique.keyParameters.map((parameter) => (
                <div key={parameter.id} className="border-l-2 border-teal-500 pl-3">
                  <p className="text-sm font-semibold text-slate-900">{parameter.label[locale]}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{parameter.recordingRule[locale]}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("证据与外部 SOP", "Evidence and external SOPs")}</h2>
            <div className="mt-4 space-y-3">
              {sources.map((source) => (
                <a
                  key={source.id}
                  href={source.versionUri}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-slate-200 p-3 transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{source.title}</p>
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                      {source.tier}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{source.version} · {source.licenseId}</p>
                  {source.doi ? <p className="mt-1 break-all font-mono text-[10px] text-teal-700">{source.doi}</p> : null}
                </a>
              ))}
            </div>
          </section>

          <section className="app-panel p-5">
            <h2 className="text-lg font-semibold text-slate-950">{localize("相关技术", "Related techniques")}</h2>
            <div className="mt-3 grid gap-2">
              {related.map((item) => (
                <Link
                  key={item.code}
                  href={`/knowledge/techniques/${encodeURIComponent(item.code)}`}
                  className="rounded-lg border border-slate-200 px-3 py-2 hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <p className="font-mono text-[10px] text-teal-700">{item.code}</p>
                  <p className="text-sm font-semibold text-slate-800">{item.name[locale]}</p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function TagBlock({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...new Set(values)].map((value) => (
          <span key={value} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
