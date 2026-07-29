"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useLocale } from "@/components/common/locale-provider";

async function clearLocalSession() {
  await fetch("/api/auth/demo-logout", {
    method: "POST",
    credentials: "include",
  });
  await signOut({ redirect: false });
}

export function AccountActions() {
  const { localize } = useLocale();
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
    <div className="account-actions" aria-label={localize("账户操作", "Account actions")} aria-busy={busy !== null}>
      <button
        type="button"
        className="button-secondary"
        disabled={busy !== null}
        onClick={() => handleAction("switch")}
      >
        {busy === "switch" ? localize("切换中...", "Switching...") : localize("切换账号", "Switch account")}
      </button>
      <button
        type="button"
        className="button-ghost"
        disabled={busy !== null}
        onClick={() => handleAction("logout")}
      >
        {busy === "logout" ? localize("退出中...", "Signing out...") : localize("退出登录", "Sign out")}
      </button>
    </div>
  );
}
