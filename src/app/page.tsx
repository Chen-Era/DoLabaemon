import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { isDemoMode } from "@/lib/demo-mode";

export default function Home() {
  const demoMode = isDemoMode();
  const primaryHref = demoMode ? "/labs" : "/login";
  const primaryLabel = demoMode ? "进入演示" : "进入系统";

  const steps = [
    {
      step: "01",
      title: "整理试剂",
      copy: "把名称、货号和备注快速导入到统一工作区，建立实验资产的单一入口。",
    },
    {
      step: "02",
      title: "结构化确认",
      copy: "结合模型解析与人工确认，把试剂转成可筛选、可判断的结构化知识。",
    },
    {
      step: "03",
      title: "实验判定",
      copy: "围绕 WB、qPCR、IF 等场景检查最低必需项、推荐补充项与风险提示。",
    },
    {
      step: "04",
      title: "共享协作",
      copy: "实验室成员共享库存视图与判定语境，同时保留实验室之间的数据隔离。",
    },
  ];

  const screens = [
    {
      label: "Reagents",
      title: "试剂清单与快速筛选",
      copy: "围绕名称、货号、标签和靶点快速定位库存，适合开题和排实验前做准备审查。",
    },
    {
      label: "Experiment Check",
      title: "规则优先的实验准备判断",
      copy: "把实验项目、研究方向和前置条件转为结构化判断结果，让缺失项与风险一眼可见。",
    },
    {
      label: "Labs",
      title: "面向团队的协作工作区",
      copy: "实验室可共享库存资产、邀请成员并围绕同一套实验准备语言协作。",
    },
  ];

  const trustItems = ["规则判定优先", "人工确认入库", "实验室数据隔离"];

  return (
    <main className="app-shell pb-16 pt-6">
      <div className="page-container">
        <section className="app-panel-strong px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <BrandLogo />
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              <span className="status-pill">Autonomous Reagent Readiness</span>
              <Link href="/labs" className="glass-badge">
                查看工作区
              </Link>
            </div>
          </div>
        </section>

        <section className="hero-grid mt-8">
          <div className="app-panel-strong px-6 py-8 md:px-8 md:py-10">
            <p className="section-kicker">Research Workspace</p>
            <h1 className="section-title mt-4">
              Dorlabaemon
              <span className="mt-2 block text-[0.42em] font-medium tracking-[0.04em] text-zinc-400">哆LabA梦</span>
            </h1>
            <p className="section-copy mt-5 max-w-2xl text-base md:text-lg">
              面向实验室团队的智能试剂与实验准备平台。把分散的试剂信息、实验前核对动作与协作上下文收束到同一条研究工作流中。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={primaryHref} className="button-primary">
                {primaryLabel}
              </Link>
              <a href="#workflow" className="button-secondary">
                查看核心流程
              </a>
            </div>
            <div className="data-grid cols-3 mt-10">
              <div className="app-panel px-4 py-4">
                <p className="metric-value">AI + Human</p>
                <p className="section-copy mt-2 text-sm">模型负责整理，最终由研究者确认后入库。</p>
              </div>
              <div className="app-panel px-4 py-4">
                <p className="metric-value">Rules First</p>
                <p className="section-copy mt-2 text-sm">实验可行性优先来自结构化规则，而不是黑盒建议。</p>
              </div>
              <div className="app-panel px-4 py-4">
                <p className="metric-value">Lab Scoped</p>
                <p className="section-copy mt-2 text-sm">同实验室共享、实验室之间严格隔离。</p>
              </div>
            </div>
          </div>

          <aside className="app-panel px-6 py-6 md:px-7">
            <div className="flex items-center justify-between">
              <span className="status-pill">Live Product Narrative</span>
              <span className="text-xs text-zinc-500">科研语境优先</span>
            </div>
            <div className="subtle-divider my-6" />
            <div className="space-y-5">
              <div>
                <p className="text-sm text-zinc-500">System Lens</p>
                <p className="mt-2 text-xl font-semibold text-white">从试剂库存到实验准备结论</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                  <p className="text-sm font-medium text-white">统一试剂上下文</p>
                  <p className="section-copy mt-2 text-sm">把标签、靶点、类别与实验用途沉淀为共享资产。</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                  <p className="text-sm font-medium text-white">显式缺失与风险</p>
                  <p className="section-copy mt-2 text-sm">最低必需项、推荐补充项、兼容性问题分别输出。</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-4">
                  <p className="text-sm font-medium text-white">团队协作视图</p>
                  <p className="section-copy mt-2 text-sm">同一实验室成员在同一试剂语义层上做讨论与决策。</p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section id="workflow" className="mt-16">
          <div className="mb-6">
            <p className="section-kicker">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">让研究准备过程保持连续</h2>
          </div>
          <div className="data-grid cols-2">
            {steps.map((item) => (
              <article key={item.step} className="app-panel px-5 py-5">
                <p className="text-sm font-semibold tracking-[0.22em] text-cyan-200/80">{item.step}</p>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="section-copy mt-3 text-sm">{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-kicker">Core Screens</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">围绕真实业务页面组织视觉层级</h2>
            </div>
            <p className="section-copy max-w-xl text-sm">视觉升级不改变逻辑，而是让库存管理、AI 解析和实验判定在同一产品语言中更易读、更可信。</p>
          </div>
          <div className="data-grid cols-3">
            {screens.map((item) => (
              <article key={item.label} className="app-panel px-5 py-5">
                <span className="glass-badge">{item.label}</span>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="section-copy mt-3 text-sm">{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="app-panel mt-16 px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">Trust Layer</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">保持科研工具应有的可解释性与边界感</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {trustItems.map((item) => (
                <span key={item} className="status-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="app-panel-strong mt-16 px-6 py-8 text-center md:px-8">
          <p className="section-kicker">Start Now</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">把试剂清单、判定逻辑与协作上下文统一到一个工作台</h2>
          <p className="section-copy mx-auto mt-4 max-w-2xl text-sm md:text-base">
            Dorlabaemon 延续专业科研语气，把复杂准备步骤组织为更稳定、更清晰的产品体验。
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={primaryHref} className="button-primary">
              {primaryLabel}
            </Link>
            <Link href="/reagents" className="button-secondary">
              浏览试剂页
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
