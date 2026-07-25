"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AccountActions } from "@/components/common/account-actions";
import { ExperimentIcon, LabsIcon, ReagentsIcon, AddReagentIcon, SettingsIcon, KnowledgeIcon } from "@/components/common/app-icons";
import { LanguageSwitcher } from "@/components/common/language-switcher";

const navItems = [
  { href: "/labs", label: "实验室", icon: LabsIcon },
  { href: "/reagents", label: "试剂清单", icon: ReagentsIcon },
  { href: "/reagents/new", label: "新增试剂", icon: AddReagentIcon },
  { href: "/experiment-check", label: "实验判定", icon: ExperimentIcon },
  { href: "/knowledge", label: "知识审计", icon: KnowledgeIcon },
  { href: "/settings", label: "系统设置", icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar flex h-screen flex-col gap-6 px-5 py-6">
        <div className="sidebar-card overflow-hidden px-4 py-4">
          <div className="sidebar-brand-mark rounded-2xl p-3">
            <Image src="/logo.png" alt="Dorlabaemon logo" width={860} height={263} className="h-10 w-full object-contain" priority />
          </div>
          <div className="mt-4 space-y-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-[0.03em] text-white">Dorlabaemon</p>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Reagent System</p>
            </div>
            <p className="max-w-full text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
              统一管理试剂、实验准备与协作。
            </p>
          </div>
        </div>

        <nav className="sidebar-nav-scroll flex-1 space-y-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href} className={`sidebar-nav-link ${active ? "is-active" : ""}`.trim()}>
                <span className="sidebar-nav-link-badge">
                  <Icon />
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer sidebar-card space-y-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Account</p>
          </div>
          <LanguageSwitcher />
          <AccountActions />
        </div>
      </aside>

      <div className="dashboard-main flex min-h-screen flex-col">
        <header className="dashboard-topbar">
          <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="section-kicker">Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Dorlabaemon</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="status-pill">运行中</span>
            </div>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
