"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Locale = "zh" | "en";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
  localize: (zh: string, en: string) => string;
};

const translations: Record<Locale, Record<string, string>> = {
  zh: {
    "language.interfaceLabel": "界面语言",
    "language.chinese": "中文",
    "language.english": "英文",
  },
  en: {
    "language.interfaceLabel": "Interface language",
    "language.chinese": "Chinese",
    "language.english": "English",
  },
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const currentLocaleRef = useRef(initialLocale);
  const writeQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === currentLocaleRef.current) {
        return Promise.resolve();
      }

      currentLocaleRef.current = nextLocale;
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;

      const saveLocale = async () => {
        const response = await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: nextLocale }),
        });

        if (!response.ok) {
          throw new Error("Unable to save the interface language preference.");
        }

        if (currentLocaleRef.current === nextLocale) {
          router.refresh();
        }
      };

      writeQueueRef.current = writeQueueRef.current.catch(() => undefined).then(saveLocale);
      return writeQueueRef.current;
    },
    [router],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translations[locale][key] ?? key,
      localize: (zh, en) => (locale === "en" ? en : zh),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }

  return context;
}
