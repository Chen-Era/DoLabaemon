export function CheckResult(props: {
  status: string;
  confidenceLabel: string;
  minMissing: string[];
  recommendedMissing: string[];
  warnings: string[];
  compatibilityIssues: string[];
  resolvedExperimentType?: string | null;
  resolutionSource?: string | null;
  resolutionConfidence?: number | null;
}) {
  const blocked = props.status === "BLOCKED";
  const hasWarnings = props.warnings.length > 0;
  const statusText = blocked ? "未通过" : "通过";
  const confidenceText = props.confidenceLabel === "HIGH" ? "高" : props.confidenceLabel === "MEDIUM" ? "中" : "低";
  const tone = blocked
    ? "border-red-200 bg-red-50 text-red-700"
    : hasWarnings
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const title = blocked ? "不可开展" : hasWarnings ? "可尝试但有风险" : "可开展";
  const summary = blocked
    ? `当前不建议直接开展。先补齐最低必需项：${props.minMissing.join("；") || "无"}`
    : hasWarnings
      ? `最低必需项已满足，但存在风险提示：${props.warnings.join("；")}`
      : "最低必需项已满足，当前可开展。";

  const cards = [
    { title: "归一实验类型", value: props.resolvedExperimentType || "无" },
    { title: "解析来源", value: props.resolutionSource || "DIRECT" },
    {
      title: "解析置信度",
      value: typeof props.resolutionConfidence === "number" ? props.resolutionConfidence.toFixed(2) : "1.00",
    },
    { title: "系统状态", value: statusText },
    { title: "结论可信度", value: confidenceText },
    { title: "最低必需缺失", value: props.minMissing.length ? props.minMissing.join("；") : "无" },
    { title: "推荐补充缺失", value: props.recommendedMissing.length ? props.recommendedMissing.join("；") : "无" },
    { title: "风险提示", value: props.warnings.length ? props.warnings.join("；") : "无" },
    { title: "一二抗兼容性", value: props.compatibilityIssues.length ? props.compatibilityIssues.join("；") : "无" },
  ];

  return (
    <div className="space-y-4">
      <div className={`rounded-[24px] border px-5 py-5 ${tone}`}>
        <p className="text-sm font-semibold tracking-[0.16em] uppercase">Conclusion</p>
        <p className="mt-3 text-2xl font-semibold">{title}</p>
        <p className="mt-3 text-sm leading-7">{summary}</p>
      </div>

      <div className="data-grid">
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
            <p className="text-slate-500">{card.title}</p>
            <p className="mt-3 leading-7 text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
