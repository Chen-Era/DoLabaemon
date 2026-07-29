"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth-shell.module.css";
import { requestJson } from "@/lib/http";

type JoinMode = "create" | "invite" | "request" | "none";

type LabSearchItem = {
  id: string;
  name: string;
  memberCount: number;
};

type SearchState = "idle" | "loading" | "done" | "error";

const modeOptions: { value: JoinMode; title: string; description: string }[] = [
  { value: "create", title: "创建实验室", description: "创建后，你就是负责人" },
  { value: "invite", title: "通过邀请码加入", description: "用邀请码加入已有实验室" },
  { value: "request", title: "申请加入", description: "搜索实验室并提交申请" },
  { value: "none", title: "暂不加入", description: "先注册，之后再决定" },
];

const submitLabel: Record<JoinMode, string> = {
  create: "创建工作区",
  invite: "注册并加入",
  request: "注册并提交申请",
  none: "注册账号",
};

const successMessage: Record<JoinMode, string> = {
  create: "账号已创建，现在可以登录。",
  none: "账号已创建，现在可以登录。",
  invite: "账号已创建，也已加入实验室。现在可以登录。",
  request: "账号已创建，加入申请已提交。等待负责人审批期间，你仍可登录。",
};

function registerErrorMessage(code?: string, serverMessage?: string) {
  switch (code) {
    case "EMAIL_EXISTS":
      return "这个邮箱已经注册，请直接登录。";
    case "INVALID_PAYLOAD":
      return "请检查填写的信息。";
    case "INVITE_NOT_FOUND":
      return "邀请码无效，请核对后重新输入。";
    case "INVITE_EXPIRED":
      return "邀请已过期，请联系实验室负责人重新邀请。";
    case "INVITE_EMAIL_MISMATCH":
      return "该邀请码绑定的是其他邮箱，请使用受邀邮箱注册。";
    case "LAB_NOT_FOUND":
      return "没有找到这个实验室，请重新搜索选择。";
    case "DATABASE_UNAVAILABLE":
      return serverMessage ?? "服务暂不可用，请稍后再试。";
    default:
      return "注册失败，请稍后再试。";
  }
}

export default function RegisterPage() {
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [mode, setMode] = useState<JoinMode>("create");
  const [labName, setLabName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [labQuery, setLabQuery] = useState("");
  const [labResults, setLabResults] = useState<LabSearchItem[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [selectedLab, setSelectedLab] = useState<LabSearchItem | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; kind: "error" | "success" } | null>(null);
  const searchSeq = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "request" || selectedLab) return;
    const query = labQuery.trim();
    if (query.length < 1) {
      setLabResults([]);
      setSearchState("idle");
      return;
    }
    setSearchState("loading");
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { response, data } = await requestJson<{ items?: LabSearchItem[] }>(
            `/api/register/labs?q=${encodeURIComponent(query)}`,
          );
          if (seq !== searchSeq.current) return;
          if (response.ok) {
            setLabResults(data?.items ?? []);
            setSearchState("done");
          } else {
            setLabResults([]);
            setSearchState("error");
          }
        } catch {
          if (seq !== searchSeq.current) return;
          setLabResults([]);
          setSearchState("error");
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [labQuery, mode, selectedLab]);

  function onLabQueryChange(value: string) {
    setLabQuery(value);
    if (selectedLab) setSelectedLab(null);
  }

  function onSelectLab(lab: LabSearchItem) {
    setSelectedLab(lab);
    setLabQuery("");
    setLabResults([]);
    setSearchState("idle");
  }

  function onChangeLab() {
    setSelectedLab(null);
    searchInputRef.current?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (mode === "request" && !selectedLab) {
      setNotice({ message: "请先搜索并选择要申请加入的实验室。", kind: "error" });
      return;
    }

    setIsSubmitting(true);

    const payload: Record<string, string> = {
      email: form.email.trim(),
      password: form.password,
      mode,
    };
    if (form.displayName.trim()) payload.displayName = form.displayName.trim();
    if (mode === "create") payload.labName = labName.trim();
    if (mode === "invite") payload.inviteCode = inviteCode.trim();
    if (mode === "request" && selectedLab) {
      payload.requestLabId = selectedLab.id;
      if (requestMessage.trim()) payload.requestMessage = requestMessage.trim();
    }

    try {
      const { response, data } = await requestJson<{ code?: string; error?: string }>("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice({
        message: response.ok ? successMessage[mode] : registerErrorMessage(data?.code, data?.error),
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
      title="创建账号"
      description="选择创建实验室、通过邀请码加入、提交加入申请，或先注册账号。"
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
              placeholder="设置密码（至少 6 位）"
              minLength={6}
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

        <div className={styles.field} role="group" aria-labelledby="join-mode-label">
          <span className={styles.label} id="join-mode-label">
            加入方式
          </span>
          <div className={styles.modeGrid}>
            {modeOptions.map((option) => (
              <label key={option.value} className={styles.modeOption}>
                <input
                  type="radio"
                  name="join-mode"
                  className={styles.modeRadio}
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                />
                <span className={styles.modeTitle}>{option.title}</span>
                <span className={styles.modeDesc}>{option.description}</span>
              </label>
            ))}
          </div>
        </div>

        {mode === "create" ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-lab">
              实验室名称
            </label>
            <input
              id="register-lab"
              className={styles.input}
              autoComplete="organization"
              placeholder="例如：肿瘤代谢实验室"
              minLength={2}
              value={labName}
              onChange={(event) => setLabName(event.target.value)}
              required
            />
          </div>
        ) : null}

        {mode === "invite" ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-invite">
              邀请码
            </label>
            <input
              id="register-invite"
              className={`${styles.input} ${styles.monoInput}`}
              autoComplete="off"
              spellCheck={false}
              placeholder="粘贴邀请码"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              required
            />
            <span className={styles.fieldHint}>输入负责人发到你邮箱的邀请码，注册后直接进入该实验室。</span>
          </div>
        ) : null}

        {mode === "request" ? (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="register-lab-search">
                搜索实验室
              </label>
              <input
                id="register-lab-search"
                ref={searchInputRef}
                className={styles.input}
                autoComplete="off"
                placeholder="输入实验室名称关键词"
                value={labQuery}
                onChange={(event) => onLabQueryChange(event.target.value)}
              />
              {selectedLab ? (
                <div className={styles.selectedLab}>
                  <div className={styles.selectedLabInfo}>
                    <span className={styles.selectedLabName}>{selectedLab.name}</span>
                    <span className={styles.selectedLabMeta}>{selectedLab.memberCount} 名成员 · 已选择</span>
                  </div>
                  <button type="button" className={styles.changeLab} onClick={onChangeLab}>
                    更换
                  </button>
                </div>
              ) : null}
              {!selectedLab && searchState === "loading" ? (
                <p className={styles.searchStatus} role="status">
                  搜索中…
                </p>
              ) : null}
              {!selectedLab && searchState === "done" && labResults.length === 0 ? (
                <p className={styles.searchStatus} role="status">
                  没有找到匹配的实验室，换个关键词试试。
                </p>
              ) : null}
              {!selectedLab && searchState === "error" ? (
                <p className={`${styles.searchStatus} ${styles.searchStatusError}`} role="alert">
                  搜索失败，请稍后重试。
                </p>
              ) : null}
              {!selectedLab && labResults.length > 0 ? (
                <ul className={styles.resultList} aria-label="搜索结果">
                  {labResults.map((lab) => (
                    <li key={lab.id}>
                      <button type="button" className={styles.resultItem} onClick={() => onSelectLab(lab)}>
                        <span className={styles.resultName}>{lab.name}</span>
                        <span className={styles.resultMeta}>{lab.memberCount} 名成员</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {selectedLab ? (
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="register-request-message">
                    给负责人的留言（选填）
                  </label>
                  <span className={styles.fieldHint}>{requestMessage.length}/500</span>
                </div>
                <textarea
                  id="register-request-message"
                  className={styles.textarea}
                  placeholder="简单介绍一下自己，方便负责人审批"
                  maxLength={500}
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {mode === "none" ? (
          <p className={styles.modeNote}>可以先注册账号，稍后在「实验室」页面创建或加入实验室。</p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "正在提交…" : submitLabel[mode]}
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
