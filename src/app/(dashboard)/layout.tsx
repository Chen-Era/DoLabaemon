import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { AccountActions } from "@/components/common/account-actions";
import { LanguageSwitcher } from "@/components/common/language-switcher";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="border-b border-white/8 bg-[#060c19]/70 backdrop-blur-xl">
        <div className="page-container py-5">
          <div className="app-panel px-5 py-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <BrandLogo />
                <div>
                  <p className="text-sm font-medium text-white">AI-assisted reagent readiness workspace</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    在统一的实验室工作区中管理试剂、准备实验并输出更清晰的判定结论。
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 lg:items-end">
                <LanguageSwitcher />
                <AccountActions />
                <nav className="flex flex-wrap gap-2 text-sm text-zinc-300">
                  <Link href="/labs" className="glass-badge">
                    Labs
                  </Link>
                  <Link href="/reagents" className="glass-badge">
                    Reagents
                  </Link>
                  <Link href="/reagents/new" className="glass-badge">
                    New Reagent
                  </Link>
                  <Link href="/experiment-check" className="glass-badge">
                    Experiment Check
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="page-container py-8">{children}</main>
    </div>
  );
}
