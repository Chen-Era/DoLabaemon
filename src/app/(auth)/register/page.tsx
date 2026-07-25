"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth-shell.module.css";
import { requestJson } from "@/lib/http";

function registerErrorMessage(code?: string) {
  if (code === "EMAIL_EXISTS") return "这个邮箱已经注册，请直接登录。";
  if (code === "INVALID_PAYLOAD") return "请检查填写的信息。";
  return "注册失败，请稍后再试。";
}

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", displayName: "", labName: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; kind: "error" | "success" } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    setIsSubmitting(true);

    try {
      const { response, data } = await requestJson<{ code?: string }>("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setNotice({
        message: response.ok ? "账号创建成功，现在可以登录。" : registerErrorMessage(data?.code),
        kind: response.ok ? "success" : "error",
      });
    } catch {
      setNotice({ message: "网络异常，请稍后重试", kind: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="注册"
      title="创建实验室工作区"
      description="填写基础信息，即可开始录入试剂。"
      footer={
        <>
          已有账号？
          <Link href="/login" className={styles.footerLink}>
            返回登录
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-email">
            邮箱
          </label>
          <input
            id="register-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            placeholder="you@lab.org"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-password">
            密码
          </label>
          <div className={styles.passwordWrap}>
            <input
              id="register-password"
              className={styles.passwordInput}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="设置密码"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
            <button
              className={styles.passwordToggle}
              type="button"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "隐藏" : "显示"}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-name">
            姓名（选填）
          </label>
          <input
            id="register-name"
            className={styles.input}
            autoComplete="name"
            placeholder="你的姓名"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-lab">
            实验室名称
          </label>
          <input
            id="register-lab"
            className={styles.input}
            autoComplete="organization"
            placeholder="例如：肿瘤代谢实验室"
            value={form.labName}
            onChange={(event) => setForm({ ...form, labName: event.target.value })}
            required
          />
        </div>

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "正在创建…" : "创建工作区"}
        </button>
      </form>

      {notice ? (
        <p
          className={`${styles.notice} ${notice.kind === "error" ? styles.noticeError : styles.noticeSuccess}`}
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {notice.message}
        </p>
      ) : null}
    </AuthShell>
  );
}
