import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ExperimentIcon, LabsIcon, ReagentsIcon } from "@/components/common/app-icons";
import { MockDashboard } from "@/components/home/mock-dashboard";
import styles from "@/components/home/landing.module.css";
import { isDemoMode } from "@/lib/demo-mode";

const workflow = [
  { number: "01", title: "录入", copy: "整理名称、货号和备注。", icon: ReagentsIcon },
  { number: "02", title: "确认", copy: "核对字段和分类。", icon: CheckIcon },
  { number: "03", title: "检查", copy: "确认实验条件是否齐备。", icon: ExperimentIcon },
  { number: "04", title: "协作", copy: "团队查看同一份记录。", icon: LabsIcon },
];

const spaces = [
  {
    label: "试剂库",
    title: "需要时，找到试剂",
    copy: "按名称、货号和标签查看库存。",
    href: "/reagents",
    icon: ReagentsIcon,
    tone: "blue",
  },
  {
    label: "实验检查",
    title: "实验前，把条件查清",
    copy: "区分已满足、待补充和注意事项。",
    href: "/experiment-check",
    icon: ExperimentIcon,
    tone: "green",
  },
  {
    label: "实验室",
    title: "团队共用同一份记录",
    copy: "实验室内共享记录，数据彼此分开。",
    href: "/labs",
    icon: LabsIcon,
    tone: "violet",
  },
] as const;

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function Home() {
  const demoMode = isDemoMode();
  const primaryHref = demoMode ? "/labs" : "/login";
  const primaryLabel = demoMode ? "进入演示" : "进入系统";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.brand} aria-label="Dorlabaemon 首页">
            <BrandLogo imageClassName="w-[10.5rem]" priority />
          </Link>

          <nav className={styles.nav} aria-label="首页导航">
            <a href="#workflow">流程</a>
            <a href="#workspace">工作区</a>
          </nav>

          <div className={styles.headerActions}>
            {!demoMode ? (
              <Link href="/register" className={styles.registerLink}>
                创建账号
              </Link>
            ) : null}
            <Link href={primaryHref} className={styles.primaryAction}>
              {primaryLabel}
              <ArrowIcon className={styles.actionArrow} />
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>试剂管理工作区</p>
            <h1 id="hero-title" className={styles.heroTitle}>
              实验前，先把
              <span>试剂查清。</span>
            </h1>
            <p className={styles.heroDescription}>试剂记录、实验条件和团队协作，都在同一个实验室工作区里。</p>
            <div className={styles.heroActions}>
              <Link href={primaryHref} className={styles.primaryAction}>
                {primaryLabel}
                <ArrowIcon className={styles.actionArrow} />
              </Link>
              <a href="#workflow" className={styles.textAction}>
                了解流程
                <ArrowIcon className={styles.actionArrow} />
              </a>
            </div>
            <ul className={styles.principles} aria-label="产品原则">
              <li>
                <CheckIcon />人工确认
              </li>
              <li>
                <CheckIcon />规则检查
              </li>
              <li>
                <CheckIcon />实验室隔离
              </li>
            </ul>
          </div>

          <div className={styles.heroPreview}>
            <p className={styles.previewLabel}>工作区预览</p>
            <MockDashboard />
          </div>
        </section>

        <section id="workflow" className={`${styles.container} ${styles.section}`} aria-labelledby="workflow-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>工作流程</p>
            <h2 id="workflow-title">按这四步准备实验。</h2>
          </div>
          <ol className={styles.workflow}>
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.number} className={styles.workflowItem}>
                  <span className={styles.stepNumber}>{item.number}</span>
                  <Icon className={styles.stepIcon} />
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="workspace" className={`${styles.container} ${styles.section}`} aria-labelledby="workspace-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>常用功能</p>
            <h2 id="workspace-title">试剂、实验检查和团队协作，都在这里。</h2>
          </div>
          <div className={styles.spaceList}>
            {spaces.map((space) => {
              const Icon = space.icon;
              return (
                <Link key={space.label} href={space.href} className={`${styles.spaceLink} ${styles[`tone${space.tone}`]}`}>
                  <span className={styles.spaceIcon}>
                    <Icon />
                  </span>
                  <span className={styles.spaceCopy}>
                    <span className={styles.spaceLabel}>{space.label}</span>
                    <strong>{space.title}</strong>
                    <span>{space.copy}</span>
                  </span>
                  <ArrowIcon className={styles.spaceArrow} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className={`${styles.container} ${styles.closing}`} aria-labelledby="closing-title">
          <div>
            <p className={styles.eyebrow}>开始使用</p>
            <h2 id="closing-title">先录入第一条试剂记录。</h2>
          </div>
          <Link href={primaryHref} className={styles.primaryAction}>
            {primaryLabel}
            <ArrowIcon className={styles.actionArrow} />
          </Link>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <span>Dorlabaemon · 试剂管理系统</span>
          <span>帮助实验前把信息查清</span>
        </div>
      </footer>
    </main>
  );
}
