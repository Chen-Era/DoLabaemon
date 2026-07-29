import type { Metadata } from "next";
import { SessionProviderWrapper } from "@/components/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dorlabaemon | 实验试剂管理与准备",
  description: "Dorlabaemon 帮助实验室团队管理试剂，并在实验前核对准备情况。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
