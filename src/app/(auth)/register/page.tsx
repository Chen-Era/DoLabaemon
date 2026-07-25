"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { requestJson } from "@/lib/http";

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", displayName: "", labName: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const { response, data } = await requestJson<{ error?: string }>("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setMsg(response.ok ? "注册成功，请登录" : data?.error ?? "注册失败，请稍后重试");
    } catch {
      setMsg("网络异常，请稍后重试");
    }
  }

  return (
    <main className="app-shell py-10">
      <div className="page-container">
        <div className="grid gap-6 lg:grid-cols-[1fr_minmax(380px,1fr)]">
          <section className="app-panel-strong px-6 py-8 md:px-8">
            <BrandLogo imageClassName="h-14" />
            <p className="section-kicker mt-8">Lab Onboarding</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">创建你的 Dorlabaemon 工作区</h1>
            <p className="section-copy mt-5 max-w-xl text-base">
              建立实验室级试剂目录与实验准备语言，让成员围绕同一库存视图和同一判定逻辑协作。
            </p>
            <div className="data-grid mt-8">
              <div className="app-panel px-5 py-4">
                <p className="font-medium text-slate-900">统一命名与标签</p>
                <p className="section-copy mt-2 text-sm">把零散试剂记录转为可筛选、可判断的标准化条目。</p>
              </div>
              <div className="app-panel px-5 py-4">
                <p className="font-medium text-slate-900">实验准备显式化</p>
                <p className="section-copy mt-2 text-sm">在真正开做实验前，先看最低必需项和风险提示是否满足。</p>
              </div>
              <div className="app-panel px-5 py-4">
                <p className="font-medium text-slate-900">协作边界清晰</p>
                <p className="section-copy mt-2 text-sm">邀请成员共享库存，但不打破实验室之间的数据边界。</p>
              </div>
            </div>
          </section>

          <section className="app-panel px-6 py-8 md:px-8">
            <div className="mb-6">
              <p className="section-kicker">Create Account</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">注册并初始化实验室</h2>
              <p className="section-copy mt-2 text-sm">创建账号后即可开始维护试剂库存并邀请成员加入。</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="register-email">
                  邮箱
                </label>
                <input
                  id="register-email"
                  className="input-base"
                  placeholder="you@lab.org"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="register-password">
                  密码
                </label>
                <input
                  id="register-password"
                  className="input-base"
                  placeholder="设置密码"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="register-name">
                  姓名
                </label>
                <input
                  id="register-name"
                  className="input-base"
                  placeholder="你的姓名"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="register-lab">
                  实验室名称
                </label>
                <input
                  id="register-lab"
                  className="input-base"
                  placeholder="例如：肿瘤代谢实验室"
                  value={form.labName}
                  onChange={(e) => setForm({ ...form, labName: e.target.value })}
                  required
                />
              </div>
              <button className="button-primary w-full" type="submit">
                创建账号
              </button>
            </form>
            {msg ? (
              <p className={`mt-4 text-sm ${msg.includes("失败") || msg.includes("异常") ? "danger-panel" : "success-panel"}`}>{msg}</p>
            ) : null}
            <p className="mt-5 text-sm text-slate-500">
              已有账号？
              <Link href="/login" className="ml-2 text-blue-600 underline underline-offset-4">
                登录
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
