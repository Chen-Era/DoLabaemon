"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { AccountActions } from "@/components/common/account-actions";
import {
  AddReagentIcon,
  CloseIcon,
  ExperimentIcon,
  KnowledgeIcon,
  LabsIcon,
  MenuIcon,
  ReagentsIcon,
  SettingsIcon,
} from "@/components/common/app-icons";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LabsIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "实验",
    items: [
      { href: "/labs", label: "实验室", icon: LabsIcon },
      { href: "/reagents", label: "试剂清单", icon: ReagentsIcon },
      { href: "/reagents/new", label: "录入试剂", icon: AddReagentIcon },
      { href: "/experiment-check", label: "实验检查", icon: ExperimentIcon },
    ],
  },
  {
    label: "管理",
    items: [
      { href: "/knowledge", label: "变更记录", icon: KnowledgeIcon },
      { href: "/settings", label: "设置", icon: SettingsIcon },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);

const pageMeta = [
  { href: "/reagents/new", title: "录入试剂" },
  { href: "/experiment-check", title: "实验检查" },
  { href: "/knowledge", title: "变更记录" },
  { href: "/settings", title: "设置" },
  { href: "/reagents", title: "试剂清单" },
  { href: "/labs", title: "实验室" },
] as const;

function routeMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolvePageMeta(pathname: string) {
  return pageMeta.find((item) => routeMatches(pathname, item.href)) ?? {
    title: "科研工作台",
  };
}

function isCurrentNavItem(pathname: string, href: string) {
  const currentMatch = allNavItems
    .filter((item) => routeMatches(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];

  return currentMatch?.href === href;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/labs";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Keep the mobile drawer from covering the next route after client navigation.
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.classList.add("dashboard-nav-open");
    window.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.classList.remove("dashboard-nav-open");
      window.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [sidebarOpen]);

  const currentPage = resolvePageMeta(pathname);

  return (
    <div className="dashboard-shell">
      <button
        type="button"
        className={`sidebar-backdrop ${sidebarOpen ? "is-open" : ""}`.trim()}
        onClick={() => setSidebarOpen(false)}
        aria-label="关闭导航菜单"
        aria-hidden={!sidebarOpen}
        tabIndex={-1}
      />

      <aside
        ref={sidebarRef}
        id="dashboard-navigation"
        className={`dashboard-sidebar ${sidebarOpen ? "is-open" : ""}`.trim()}
        aria-label="主导航"
      >
        <div className="dashboard-sidebar-brand">
          <Link href="/labs" className="dashboard-brand-link" onClick={() => setSidebarOpen(false)}>
            <BrandLogo
              className="min-w-0"
              imageClassName="w-[12rem]"
              priority
            />
          </Link>
          <button ref={closeButtonRef} type="button" className="btn-icon sidebar-close-button" onClick={() => setSidebarOpen(false)} aria-label="关闭导航">
            <CloseIcon />
          </button>
        </div>

        <nav className="sidebar-nav-scroll" aria-label="功能导航">
          {navGroups.map((group) => (
            <div className="sidebar-nav-group-wrap" key={group.label}>
              <p className="sidebar-nav-group">{group.label}</p>
              <div className="sidebar-nav-list">
                {group.items.map((item) => {
                  const active = isCurrentNavItem(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-nav-link ${active ? "is-active" : ""}`.trim()}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sidebar-nav-link-badge">
                        <Icon />
                      </span>
                      <span className="sidebar-nav-link-label">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <AccountActions />
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-inner">
            <div className="dashboard-page-context">
              <button
                type="button"
                ref={menuButtonRef}
                className="btn-icon dashboard-menu-button"
                onClick={() => {
                  previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : menuButtonRef.current;
                  setSidebarOpen(true);
                }}
                aria-label="打开导航"
                aria-expanded={sidebarOpen}
                aria-controls="dashboard-navigation"
              >
                <MenuIcon />
              </button>
              <div className="min-w-0">
                <p className="dashboard-page-title">{currentPage.title}</p>
              </div>
            </div>

            <div className="dashboard-topbar-actions">
              <Link href="/reagents/new" className="dashboard-quick-add">
                <AddReagentIcon className="h-4 w-4" />
                <span>录入试剂</span>
              </Link>
            </div>
          </div>
        </header>

        <main id="dashboard-content" className="dashboard-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
