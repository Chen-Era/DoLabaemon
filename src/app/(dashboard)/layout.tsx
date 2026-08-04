"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { AccountActions } from "@/components/common/account-actions";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLocale } from "@/components/common/locale-provider";
import {
  AddReagentIcon,
  CloseIcon,
  MenuIcon,
  SidebarAddReagentIcon,
  SidebarExperimentCheckIcon,
  SidebarAnimalsIcon,
  SidebarKnowledgeIcon,
  SidebarLabsIcon,
  SidebarReagentsIcon,
  SidebarSettingsIcon,
} from "@/components/common/app-icons";

type NavItem = {
  href: string;
  label: string;
  icon: typeof SidebarLabsIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "实验",
    items: [
      { href: "/labs", label: "实验室", icon: SidebarLabsIcon },
      { href: "/reagents", label: "试剂清单", icon: SidebarReagentsIcon },
      { href: "/reagents/new", label: "录入试剂", icon: SidebarAddReagentIcon },
      { href: "/animals", label: "实验动物", icon: SidebarAnimalsIcon },
      { href: "/experiment-check", label: "实验检查", icon: SidebarExperimentCheckIcon },
    ],
  },
  {
    label: "管理",
    items: [
      { href: "/knowledge", label: "实验知识库", icon: SidebarKnowledgeIcon },
      { href: "/mcp", label: "MCP 接入", icon: SidebarSettingsIcon },
      { href: "/settings", label: "设置", icon: SidebarSettingsIcon },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);

const pageMeta = [
  { href: "/reagents/new", title: "录入试剂" },
  { href: "/animals", title: "实验动物" },
  { href: "/experiment-check", title: "实验检查" },
  { href: "/knowledge", title: "实验知识库" },
  { href: "/mcp", title: "MCP 接入" },
  { href: "/settings", title: "设置" },
  { href: "/reagents", title: "试剂清单" },
  { href: "/labs", title: "实验室" },
] as const;

function navigationLabel(href: string | undefined) {
  switch (href) {
    case "/labs":
      return "Labs";
    case "/reagents":
      return "Reagent list";
    case "/reagents/new":
      return "Add reagent";
    case "/animals":
      return "Animal management";
    case "/experiment-check":
      return "Experiment check";
    case "/knowledge":
      return "Experiment knowledge";
    case "/settings":
      return "Settings";
    case "/mcp":
      return "MCP access";
    default:
      return "Research workspace";
  }
}

function routeMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolvePageMeta(pathname: string) {
  return pageMeta.find((item) => routeMatches(pathname, item.href)) ?? {
    title: "科研工作台",
    href: undefined,
  };
}

function isCurrentNavItem(pathname: string, href: string) {
  const currentMatch = allNavItems
    .filter((item) => routeMatches(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];

  return currentMatch?.href === href;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { localize } = useLocale();
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
        aria-label={localize("关闭导航菜单", "Close navigation menu")}
        aria-hidden={!sidebarOpen}
        tabIndex={-1}
      />

      <aside
        ref={sidebarRef}
        id="dashboard-navigation"
        className={`dashboard-sidebar ${sidebarOpen ? "is-open" : ""}`.trim()}
        aria-label={localize("主导航", "Main navigation")}
      >
        <div className="dashboard-sidebar-brand">
          <Link href="/labs" className="dashboard-brand-link" onClick={() => setSidebarOpen(false)}>
            <BrandLogo
              className="min-w-0"
              imageClassName="w-[12rem]"
              priority
            />
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn-icon sidebar-close-button"
            onClick={() => setSidebarOpen(false)}
            aria-label={localize("关闭导航", "Close navigation")}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="sidebar-nav-scroll" aria-label={localize("功能导航", "Feature navigation")}>
          {navGroups.map((group) => (
            <div className="sidebar-nav-group-wrap" key={group.label}>
              <p className="sidebar-nav-group">{localize(group.label, group.label === "实验" ? "Research" : "Management")}</p>
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
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="sidebar-nav-link-label">{localize(item.label, navigationLabel(item.href))}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <LanguageSwitcher />
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
                aria-label={localize("打开导航", "Open navigation")}
                aria-expanded={sidebarOpen}
                aria-controls="dashboard-navigation"
              >
                <MenuIcon />
              </button>
              <div className="min-w-0">
                <p className="dashboard-page-title">{localize(currentPage.title, navigationLabel(currentPage.href))}</p>
              </div>
            </div>

            <div className="dashboard-topbar-actions">
              <Link href="/reagents/new" className="dashboard-quick-add">
                <AddReagentIcon className="h-4 w-4" />
                <span>{localize("录入试剂", "Add reagent")}</span>
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
