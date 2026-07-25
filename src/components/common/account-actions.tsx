"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

async function clearLocalSession() {
  await fetch("/api/auth/demo-logout", {
    method: "POST",
    credentials: "include",
  });
  await signOut({ redirect: false });
}

export function AccountActions() {
  const [busy, setBusy] = useState<"switch" | "logout" | null>(null);

  async function handleAction(mode: "switch" | "logout") {
    setBusy(mode);
    try {
      await clearLocalSession();
    } finally {
      window.location.assign(mode === "switch" ? "/login" : "/");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="rounded-lg border border-white/12 bg-white/6 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy !== null}
        onClick={() => handleAction("switch")}
      >
        {busy === "switch" ? "切换中..." : "切换账号"}
      </button>
      <button
        type="button"
        className="rounded-lg border border-white/12 bg-transparent px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={busy !== null}
        onClick={() => handleAction("logout")}
      >
        {busy === "logout" ? "退出中..." : "退出登录"}
      </button>
    </div>
  );
}
