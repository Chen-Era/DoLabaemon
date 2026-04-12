"use client";

import { useState } from "react";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/4 p-1 text-sm text-zinc-300">
      <button
        type="button"
        className={`rounded-full px-3 py-1.5 transition ${lang === "zh" ? "bg-white text-[#091221]" : ""}`}
        onClick={() => setLang("zh")}
      >
        中文
      </button>
      <button
        type="button"
        className={`rounded-full px-3 py-1.5 transition ${lang === "en" ? "bg-white text-[#091221]" : ""}`}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}
