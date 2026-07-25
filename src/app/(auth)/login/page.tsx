"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth-shell.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
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
    } catch {
      setError("暂时无法登录，请检查网络后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="登录"
      title="进入实验室工作区"
      description="查看试剂信息，继续实验准备。"
      footer={
        <>
          还没有账号？
          <Link href="/register" className={styles.footerLink}>
            创建账号
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            autoComplete="email"
            placeholder="you@lab.org"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            密码
          </label>
          <div className={styles.passwordWrap}>
            <input
              id="password"
              className={styles.passwordInput}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "正在登录…" : "登录"}
        </button>
      </form>

      {error ? (
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {error}
        </p>
      ) : null}
    </AuthShell>
  );
}
