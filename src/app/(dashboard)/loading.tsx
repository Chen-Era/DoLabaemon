export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="正在加载页面">
      <div className="page-header space-y-3">
        <div className="h-7 w-36 animate-pulse rounded-md bg-slate-200" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-slate-100" />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded-md bg-slate-200" />
        <div className="mt-5 space-y-3">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </section>
    </div>
  );
}
