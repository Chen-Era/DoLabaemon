"use client";

import { useState } from "react";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-sm text-slate-300">
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 transition ${lang === "zh" ? "bg-white text-slate-900 shadow-sm" : ""}`}
        onClick={() => setLang("zh")}
      >
        中文
      </button>
      <button
        type="button"
        className={`rounded-md px-3 py-1.5 transition ${lang === "en" ? "bg-white text-slate-900 shadow-sm" : ""}`}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}
