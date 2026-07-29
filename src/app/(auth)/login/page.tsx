"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth-shell.module.css";
import { useLocale } from "@/components/common/locale-provider";

type LoginError = "invalidCredentials" | "network";

export default function LoginPage() {
  const { localize } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<LoginError | null>(null);

  const errorMessage =
    error === "invalidCredentials"
      ? localize("邮箱或密码错误", "Incorrect email or password.")
      : error === "network"
        ? localize("暂时无法登录，请检查网络后重试", "Unable to sign in right now. Check your connection and try again.")
        : null;

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
        setError("invalidCredentials");
        return;
      }
      window.location.assign(result.url ?? "/labs");
    } catch {
      setError("network");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow={localize("登录", "Sign in")}
      title={localize("进入实验室工作区", "Enter your lab workspace")}
      description={localize("查看试剂记录，继续准备实验。", "Review reagent records and keep preparing your experiment.")}
      footer={
        <>
          {localize("还没有账号？", "Don't have an account?")}
          <Link href="/register" className={styles.footerLink}>
            {localize("创建账号", "Create account")}
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            {localize("邮箱", "Email")}
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
            {localize("密码", "Password")}
          </label>
          <div className={styles.passwordWrap}>
            <input
              id="password"
              className={styles.passwordInput}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder={localize("输入密码", "Enter your password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              className={styles.passwordToggle}
              type="button"
              aria-label={showPassword ? localize("隐藏密码", "Hide password") : localize("显示密码", "Show password")}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? localize("隐藏", "Hide") : localize("显示", "Show")}
            </button>
          </div>
        </div>

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? localize("正在登录…", "Signing in…") : localize("登录", "Sign in")}
        </button>
      </form>

      {errorMessage ? (
        <p className={`${styles.notice} ${styles.noticeError}`} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </AuthShell>
  );
}
