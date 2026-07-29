"use client";

import { useLocale } from "@/components/common/locale-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="language-switcher" role="group" aria-label={t("language.interfaceLabel")}>
      <button
        type="button"
        className={`language-switcher-option ${locale === "zh" ? "is-active" : ""}`.trim()}
        onClick={() => void setLocale("zh")}
        aria-pressed={locale === "zh"}
      >
        {t("language.chinese")}
      </button>
      <button
        type="button"
        className={`language-switcher-option ${locale === "en" ? "is-active" : ""}`.trim()}
        onClick={() => void setLocale("en")}
        aria-pressed={locale === "en"}
      >
        English
      </button>
    </div>
  );
}
