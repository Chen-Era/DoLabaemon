"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { BrandLogo } from "@/components/brand/logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/labs",
    });
    if (result?.error || !result?.ok) {
      setError("邮箱或密码错误");
      return;
    }
    window.location.assign(result.url ?? "/labs");
  }

  return (
    <main className="app-shell py-10">
      <div className="page-container">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_minmax(360px,0.95fr)]">
          <section className="app-panel-strong px-6 py-8 md:px-8">
            <BrandLogo imageClassName="h-14" />
            <p className="section-kicker mt-8">Research Access</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">登录你的实验准备工作区</h1>
            <p className="section-copy mt-5 max-w-xl text-base">
              在 Dorlabaemon 中统一管理试剂资产、实验判定语境与实验室协作视图，让准备工作可复用、可解释、可交接。
            </p>
            <div className="data-grid mt-8">
              <div className="app-panel px-5 py-4">
                <p className="font-medium text-slate-900">结构化库存</p>
                <p className="section-copy mt-2 text-sm">名称、货号、标签与靶点在同一工作区中沉淀为共享知识。</p>
              </div>
              <div className="app-panel px-5 py-4">
                <p className="font-medium text-slate-900">规则优先判定</p>
                <p className="section-copy mt-2 text-sm">最低必需项、推荐补充项和风险提示分别输出，避免黑盒建议。</p>
              </div>
              <div className="app-panel px-5 py-4">
                <p className="font-medium text-slate-900">实验室级隔离</p>
                <p className="section-copy mt-2 text-sm">同实验室共享，实验室之间严格隔离，适合多人协作。</p>
              </div>
            </div>
          </section>

          <section className="app-panel px-6 py-8 md:px-8">
            <div className="mb-6">
              <p className="section-kicker">Sign In</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">继续进入 Dorlabaemon</h2>
              <p className="section-copy mt-2 text-sm">使用邮箱和密码进入你的试剂与实验准备面板。</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="email">
                  邮箱
                </label>
                <input
                  id="email"
                  className="input-base"
                  placeholder="you@lab.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="password">
                  密码
                </label>
                <input
                  id="password"
                  className="input-base"
                  type="password"
                  placeholder="输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="button-primary w-full" type="submit">
                登录
              </button>
            </form>
            {error ? <p className="danger-panel mt-4 text-sm">{error}</p> : null}
            <p className="mt-5 text-sm text-slate-500">
              还没有账号？
              <Link href="/register" className="ml-2 text-blue-600 underline underline-offset-4">
                注册
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
