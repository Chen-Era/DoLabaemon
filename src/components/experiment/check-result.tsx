import { AlertIcon, CheckIcon } from "@/components/common/app-icons";

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-md bg-stone-200">
        <div className="h-full rounded-md bg-blue-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold tabular-nums text-stone-700">{pct}%</span>
    </div>
  );
}

export function MarkerList({ items, markerClass }: { items: string[]; markerClass: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${markerClass}`} aria-hidden="true" />
          <span className="[overflow-wrap:anywhere]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({ title, count, badgeClass }: { title: string; count: number; badgeClass: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
      <span className={badgeClass}>{count}</span>
    </div>
  );
}

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
  const confidenceText = props.confidenceLabel === "HIGH" ? "高" : props.confidenceLabel === "MEDIUM" ? "中" : "低";
  const resolutionSourceText =
    props.resolutionSource === "ALIAS_MATCH"
      ? "别名匹配"
      : props.resolutionSource === "MODEL_SUGGESTION"
        ? "模型建议"
        : "直接匹配";
  const confidencePill =
    props.confidenceLabel === "HIGH"
      ? "status-pill success"
      : props.confidenceLabel === "MEDIUM"
        ? "status-pill warning"
        : "status-pill danger";
  const resolutionConfidence = typeof props.resolutionConfidence === "number" ? props.resolutionConfidence : 1;

  const tone = blocked
    ? {
        band: "border-red-200 bg-red-50",
        iconBox: "border-red-200 text-red-700",
        pill: "status-pill danger",
        label: "需要补充",
        titleClass: "text-red-800",
        bodyClass: "text-red-800",
        title: "不可开展",
        Icon: AlertIcon,
      }
    : hasWarnings
      ? {
          band: "border-amber-200 bg-amber-50",
          iconBox: "border-amber-200 text-amber-700",
          pill: "status-pill warning",
          label: "可以开展",
          titleClass: "text-amber-900",
          bodyClass: "text-amber-800",
          title: "可开展，但存在风险",
          Icon: AlertIcon,
        }
      : {
          band: "border-emerald-200 bg-emerald-50",
          iconBox: "border-emerald-200 text-emerald-700",
          pill: "status-pill success",
          label: "可以开展",
          titleClass: "text-emerald-800",
          bodyClass: "text-emerald-800",
          title: "可开展",
          Icon: CheckIcon,
        };

  const summary = blocked
    ? `当前不建议直接开展。先补齐最低必需项：${props.minMissing.join("；") || "无"}`
    : hasWarnings
      ? `最低必需项已满足，但存在风险提示：${props.warnings.join("；")}`
      : "最低必需项已满足，当前可开展。";

  const warningCount = props.warnings.length + props.compatibilityIssues.length;

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border px-4 py-4 ${tone.band}`}>
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white ${tone.iconBox}`}
          >
            <tone.Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={tone.pill}>{tone.label}</span>
            </div>
            <p className={`mt-1.5 text-lg font-semibold ${tone.titleClass}`}>{tone.title}</p>
            <p className={`mt-1 text-sm leading-6 ${tone.bodyClass}`}>{summary}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-900">检查依据</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-stone-400">匹配的实验类型</dt>
            <dd className="mt-0.5 text-xs font-medium text-stone-700 [overflow-wrap:anywhere]">
              {props.resolvedExperimentType || "无"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">匹配方式</dt>
            <dd className="mt-0.5 text-xs font-medium text-stone-700">{resolutionSourceText}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">匹配可信度</dt>
            <dd className="mt-0.5">
              <ConfidenceMeter value={resolutionConfidence} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-400">结论可信度</dt>
            <dd className="mt-0.5">
              <span className={confidencePill}>{confidenceText}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="subtle-divider" />

      <section>
        <SectionHeading
          title="缺失必需项"
          count={props.minMissing.length}
          badgeClass={props.minMissing.length ? "status-pill danger" : "glass-badge"}
        />
        {props.minMissing.length ? (
          <MarkerList items={props.minMissing} markerClass="bg-red-600" />
        ) : (
          <p className="text-sm text-stone-400">无缺失，最低必需项已满足。</p>
        )}
      </section>

      <div className="subtle-divider" />

      <section>
        <SectionHeading title="推荐补充" count={props.recommendedMissing.length} badgeClass="glass-badge" />
        {props.recommendedMissing.length ? (
          <MarkerList items={props.recommendedMissing} markerClass="bg-amber-500" />
        ) : (
          <p className="text-sm text-stone-400">暂无推荐补充项。</p>
        )}
      </section>

      <div className="subtle-divider" />

      <section>
        <SectionHeading
          title="警告与提示"
          count={warningCount}
          badgeClass={warningCount ? "status-pill warning" : "glass-badge"}
        />
        {props.warnings.length ? <MarkerList items={props.warnings} markerClass="bg-amber-600" /> : null}
        {props.compatibilityIssues.length ? (
          <div className={props.warnings.length ? "mt-3" : ""}>
            <p className="mb-1.5 text-xs font-semibold text-stone-500">一二抗兼容性</p>
            <MarkerList items={props.compatibilityIssues} markerClass="bg-red-600" />
          </div>
        ) : null}
        {!warningCount ? <p className="text-sm text-stone-400">无警告与兼容性问题。</p> : null}
      </section>
    </div>
  );
}
