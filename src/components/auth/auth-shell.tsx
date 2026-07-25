import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import styles from "./auth-shell.module.css";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

const points = ["试剂记录随时可查", "实验条件逐项检查", "团队数据分开管理"];

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="Dorlabaemon 首页">
            <BrandLogo imageClassName="w-[10.5rem]" priority />
          </Link>
          <Link href="/" className={styles.backLink} aria-label="返回首页">
            <ArrowLeftIcon />
            <span>返回首页</span>
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.story} aria-labelledby="auth-story-title">
          <p className={styles.storyKicker}>试剂管理工作区</p>
          <h1 id="auth-story-title" className={styles.storyTitle}>
            实验前，把
            <span>信息查清。</span>
          </h1>
          <p className={styles.storyDescription}>试剂记录、实验条件和团队协作，都在同一个实验室工作区里。</p>
          <ul className={styles.points} aria-label="产品特点">
            {points.map((point) => (
              <li key={point}>
                <CheckIcon />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.formRegion} aria-labelledby="auth-form-title">
          <div className={styles.formCard}>
            <div className={styles.cardHeader}>
              <p className={styles.cardKicker}>{eyebrow}</p>
              <h2 id="auth-form-title">{title}</h2>
              <p>{description}</p>
            </div>
            {children}
            <div className={styles.cardFooter}>{footer}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
