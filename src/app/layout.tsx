import type { Metadata } from "next";
import { SessionProviderWrapper } from "@/components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dorlabaemon | 智能实验试剂与实验准备平台",
  description: "Dorlabaemon 是面向实验室团队的 AI-assisted reagent inventory and experiment readiness workspace。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
