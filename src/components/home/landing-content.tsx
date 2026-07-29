"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { ExperimentIcon, LabsIcon, ReagentsIcon } from "@/components/common/app-icons";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLocale } from "@/components/common/locale-provider";
import { MockDashboard } from "@/components/home/mock-dashboard";
import styles from "@/components/home/landing.module.css";

const workflow = [
  { number: "01", title: ["录入", "Add"], copy: ["整理名称、货号和备注。", "Capture names, catalog numbers, and notes."], icon: ReagentsIcon },
  { number: "02", title: ["确认", "Confirm"], copy: ["核对字段和分类。", "Review fields and categories."], icon: CheckIcon },
  { number: "03", title: ["检查", "Check"], copy: ["确认实验条件是否齐备。", "Make sure the experiment has what it needs."], icon: ExperimentIcon },
  { number: "04", title: ["协作", "Collaborate"], copy: ["团队查看同一份记录。", "Keep the team on the same record."], icon: LabsIcon },
] as const;

const spaces = [
  {
    label: ["试剂库", "Reagent library"],
    title: ["需要时，找到试剂", "Find the reagent when you need it"],
    copy: ["按名称、货号和标签查看库存。", "Browse inventory by name, catalog number, and tag."],
    href: "/reagents",
    icon: ReagentsIcon,
    tone: "blue",
  },
  {
    label: ["实验检查", "Experiment check"],
    title: ["实验前，把条件查清", "Clarify conditions before the experiment"],
    copy: ["区分已满足、待补充和注意事项。", "Separate what is ready, missing, and worth noting."],
    href: "/experiment-check",
    icon: ExperimentIcon,
    tone: "green",
  },
  {
    label: ["实验室", "Labs"],
    title: ["团队共用同一份记录", "Give your team one shared record"],
    copy: ["实验室内共享记录，数据彼此分开。", "Share records within each lab while keeping data separate."],
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

export function LandingContent({ demoMode }: { demoMode: boolean }) {
  const { localize } = useLocale();
  const primaryHref = demoMode ? "/labs" : "/login";
  const primaryLabel = demoMode ? localize("进入演示", "Explore demo") : localize("进入系统", "Enter workspace");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.brand} aria-label={localize("Dorlabaemon 首页", "Dorlabaemon home")}>
            <BrandLogo imageClassName="w-[10.5rem]" priority />
          </Link>

          <nav className={styles.nav} aria-label={localize("首页导航", "Home navigation")}>
            <a href="#workflow">{localize("流程", "Workflow")}</a>
            <a href="#workspace">{localize("工作区", "Workspace")}</a>
          </nav>

          <div className={styles.headerActions}>
            <LanguageSwitcher />
            {!demoMode ? (
              <Link href="/register" className={styles.registerLink}>
                {localize("创建账号", "Create account")}
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
            <p className={styles.eyebrow}>{localize("试剂管理工作区", "Reagent management workspace")}</p>
            <h1 id="hero-title" className={styles.heroTitle}>
              {localize("实验前，先把", "Before an experiment,")}
              <span>{localize("试剂查清。", "verify your reagents.")}</span>
            </h1>
            <p className={styles.heroDescription}>{localize("试剂记录、实验条件和团队协作，都在同一个实验室工作区里。", "Reagent records, experimental conditions, and team collaboration all live in one lab workspace.")}</p>
            <div className={styles.heroActions}>
              <Link href={primaryHref} className={styles.primaryAction}>
                {primaryLabel}
                <ArrowIcon className={styles.actionArrow} />
              </Link>
              <a href="#workflow" className={styles.textAction}>
                {localize("了解流程", "See the workflow")}
                <ArrowIcon className={styles.actionArrow} />
              </a>
            </div>
            <ul className={styles.principles} aria-label={localize("产品原则", "Product principles")}>
              <li>
                <CheckIcon />{localize("人工确认", "Human review")}
              </li>
              <li>
                <CheckIcon />{localize("规则检查", "Rule-based checks")}
              </li>
              <li>
                <CheckIcon />{localize("实验室隔离", "Lab isolation")}
              </li>
            </ul>
          </div>

          <div className={styles.heroPreview}>
            <p className={styles.previewLabel}>{localize("工作区预览", "Workspace preview")}</p>
            <MockDashboard />
          </div>
        </section>

        <section id="workflow" className={`${styles.container} ${styles.section}`} aria-labelledby="workflow-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{localize("工作流程", "Workflow")}</p>
            <h2 id="workflow-title">{localize("按这四步准备实验。", "Prepare experiments in four steps.")}</h2>
          </div>
          <ol className={styles.workflow}>
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.number} className={styles.workflowItem}>
                  <span className={styles.stepNumber}>{item.number}</span>
                  <Icon className={styles.stepIcon} />
                  <h3>{localize(item.title[0], item.title[1])}</h3>
                  <p>{localize(item.copy[0], item.copy[1])}</p>
                </li>
              );
            })}
          </ol>
        </section>

        <section id="workspace" className={`${styles.container} ${styles.section}`} aria-labelledby="workspace-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>{localize("常用功能", "Core features")}</p>
            <h2 id="workspace-title">{localize("试剂、实验检查和团队协作，都在这里。", "Reagents, experiment checks, and team collaboration—all in one place.")}</h2>
          </div>
          <div className={styles.spaceList}>
            {spaces.map((space) => {
              const Icon = space.icon;
              return (
                <Link key={space.href} href={space.href} className={`${styles.spaceLink} ${styles[`tone${space.tone}`]}`}>
                  <span className={styles.spaceIcon}>
                    <Icon />
                  </span>
                  <span className={styles.spaceCopy}>
                    <span className={styles.spaceLabel}>{localize(space.label[0], space.label[1])}</span>
                    <strong>{localize(space.title[0], space.title[1])}</strong>
                    <span>{localize(space.copy[0], space.copy[1])}</span>
                  </span>
                  <ArrowIcon className={styles.spaceArrow} />
                </Link>
              );
            })}
          </div>
        </section>

        <section className={`${styles.container} ${styles.closing}`} aria-labelledby="closing-title">
          <div>
            <p className={styles.eyebrow}>{localize("开始使用", "Get started")}</p>
            <h2 id="closing-title">{localize("先录入第一条试剂记录。", "Start with your first reagent record.")}</h2>
          </div>
          <Link href={primaryHref} className={styles.primaryAction}>
            {primaryLabel}
            <ArrowIcon className={styles.actionArrow} />
          </Link>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <span>{localize("Dorlabaemon · 试剂管理系统", "Dorlabaemon · Reagent management")}</span>
          <span>{localize("帮助实验前把信息查清", "Bring clarity to your experiment prep")}</span>
        </div>
      </footer>
    </main>
  );
}
