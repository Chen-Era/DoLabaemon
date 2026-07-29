"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLocale } from "@/components/common/locale-provider";
import styles from "./auth-shell.module.css";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

const points = [
  ["随时查看试剂记录", "Access reagent records anytime"],
  ["逐项核对实验条件", "Review experimental conditions step by step"],
  ["实验室数据彼此分开", "Keep each lab's data separate"],
] as const;

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
  const { localize } = useLocale();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label={localize("Dorlabaemon 首页", "Dorlabaemon home")}>
            <BrandLogo imageClassName="w-[10.5rem]" priority />
          </Link>
          <LanguageSwitcher />
          <Link href="/" className={styles.backLink} aria-label={localize("返回首页", "Back to home")}>
            <ArrowLeftIcon />
            <span>{localize("返回首页", "Back to home")}</span>
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.story} aria-labelledby="auth-story-title">
          <p className={styles.storyKicker}>{localize("试剂管理工作区", "Reagent management workspace")}</p>
          <h1 id="auth-story-title" className={styles.storyTitle}>
            {localize("实验前，把", "Before you start,")}
            <span>{localize("信息查清。", "get the details right.")}</span>
          </h1>
          <p className={styles.storyDescription}>{localize("在一个工作区里管理试剂、核对实验条件，并与团队协作。", "Manage reagents, review experimental conditions, and collaborate with your team in one workspace.")}</p>
          <ul className={styles.points} aria-label={localize("产品特点", "Product features")}>
            {points.map((point) => (
              <li key={point[0]}>
                <CheckIcon />
                {localize(point[0], point[1])}
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
