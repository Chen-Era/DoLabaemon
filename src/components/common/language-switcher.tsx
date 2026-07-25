"use client";

import { useState } from "react";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<"zh" | "en">("zh");

  return (
    <div className="language-switcher" role="group" aria-label="界面语言">
      <button
        type="button"
        className={`language-switcher-option ${lang === "zh" ? "is-active" : ""}`.trim()}
        onClick={() => setLang("zh")}
        aria-pressed={lang === "zh"}
      >
        中文
      </button>
      <button
        type="button"
        className={`language-switcher-option ${lang === "en" ? "is-active" : ""}`.trim()}
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
      >
        英文
      </button>
    </div>
  );
}
