import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LocaleProvider, type Locale } from "@/components/common/locale-provider";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get("locale")?.value === "en" ? "en" : "zh";

  return locale === "en"
    ? {
        title: "Dorlabaemon | Laboratory reagent management and preparation",
        description: "Dorlabaemon helps laboratory teams manage reagents and verify their preparation before experiments.",
      }
    : {
        title: "Dorlabaemon | 实验试剂管理与准备",
        description: "Dorlabaemon 帮助实验室团队管理试剂，并在实验前核对准备情况。",
      };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get("locale")?.value === "en" ? "en" : "zh";

  return (
    <html lang={locale} className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
