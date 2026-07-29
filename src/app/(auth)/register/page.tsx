"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import styles from "@/components/auth/auth-shell.module.css";
import { useLocale } from "@/components/common/locale-provider";
import { requestJson } from "@/lib/http";

type JoinMode = "create" | "invite" | "request" | "none";

type LabSearchItem = {
  id: string;
  name: string;
  memberCount: number;
};

type SearchState = "idle" | "loading" | "done" | "error";

type Localize = (zh: string, en: string) => string;

type Notice =
  | { kind: "error"; code?: string }
  | { kind: "success"; mode: JoinMode };

function joinModeOptions(localize: Localize): { value: JoinMode; title: string; description: string }[] {
  return [
    { value: "create", title: localize("创建实验室", "Create a lab"), description: localize("创建后，你就是负责人", "You will be its owner") },
    { value: "invite", title: localize("通过邀请码加入", "Join with an invite"), description: localize("用邀请码加入已有实验室", "Use an invite to join an existing lab") },
    { value: "request", title: localize("申请加入", "Request to join"), description: localize("搜索实验室并提交申请", "Find a lab and send a request") },
    { value: "none", title: localize("暂不加入", "Join later"), description: localize("先注册，之后再决定", "Create your account and decide later") },
  ];
}

function submitLabel(mode: JoinMode, localize: Localize) {
  switch (mode) {
    case "create":
      return localize("创建工作区", "Create workspace");
    case "invite":
      return localize("注册并加入", "Create account and join");
    case "request":
      return localize("注册并提交申请", "Create account and request to join");
    case "none":
      return localize("注册账号", "Create account");
  }
}

function successMessage(mode: JoinMode, localize: Localize) {
  switch (mode) {
    case "create":
    case "none":
      return localize("账号已创建，现在可以登录。", "Your account has been created. You can sign in now.");
    case "invite":
      return localize("账号已创建，也已加入实验室。现在可以登录。", "Your account has been created and you have joined the lab. You can sign in now.");
    case "request":
      return localize("账号已创建，加入申请已提交。等待负责人审批期间，你仍可登录。", "Your account has been created and your join request has been submitted. You can still sign in while the owner reviews it.");
  }
}

function registerErrorMessage(code: string | undefined, localize: Localize) {
  switch (code) {
    case "EMAIL_EXISTS":
      return localize("这个邮箱已经注册，请直接登录。", "This email is already registered. Please sign in instead.");
    case "INVALID_PAYLOAD":
      return localize("请检查填写的信息。", "Please review the information you entered.");
    case "INVITE_NOT_FOUND":
      return localize("邀请码无效，请核对后重新输入。", "That invite code is invalid. Check it and try again.");
    case "INVITE_EXPIRED":
      return localize("邀请已过期，请联系实验室负责人重新邀请。", "This invite has expired. Ask the lab owner to send a new one.");
    case "INVITE_EMAIL_MISMATCH":
      return localize("该邀请码绑定的是其他邮箱，请使用受邀邮箱注册。", "This invite is for a different email address. Register with the invited email.");
    case "INVALID_INVITE_ROLE":
      return localize("该邀请码的角色无法通过邀请授予。", "The role in this invite cannot be granted by invitation.");
    case "LAB_NOT_FOUND":
      return localize("没有找到这个实验室，请重新搜索选择。", "That lab could not be found. Search and select it again.");
    case "DATABASE_UNAVAILABLE":
      return localize("服务暂不可用，请稍后再试。", "The service is temporarily unavailable. Please try again later.");
    case "REQUEST_LAB_REQUIRED":
      return localize("请先搜索并选择要申请加入的实验室。", "Search for and select the lab you want to join first.");
    case "NETWORK_ERROR":
      return localize("网络异常，请稍后重试", "A network error occurred. Please try again later.");
    default:
      return localize("注册失败，请稍后再试。", "Registration failed. Please try again later.");
  }
}

export default function RegisterPage() {
  const { localize } = useLocale();
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
  const [notice, setNotice] = useState<Notice | null>(null);
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
      setNotice({ code: "REQUEST_LAB_REQUIRED", kind: "error" });
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
      const { response, data } = await requestJson<{ code?: string }>("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice({
        ...(response.ok ? { kind: "success" as const, mode } : { kind: "error" as const, code: data?.code }),
      });
    } catch {
      setNotice({ code: "NETWORK_ERROR", kind: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const noticeMessage = notice
    ? notice.kind === "success"
      ? successMessage(notice.mode, localize)
      : registerErrorMessage(notice.code, localize)
    : null;

  return (
    <AuthShell
      eyebrow={localize("注册", "Create account")}
      title={localize("创建账号", "Create your account")}
      description={localize("选择创建实验室、通过邀请码加入、提交加入申请，或先注册账号。", "Create a lab, join with an invite, request access, or simply create your account first.")}
      footer={
        <>
          {localize("已有账号？", "Already have an account?")}
          <Link href="/login" className={styles.footerLink}>
            {localize("返回登录", "Sign in")}
          </Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-email">
            {localize("邮箱", "Email")}
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
            {localize("密码", "Password")}
          </label>
          <div className={styles.passwordWrap}>
            <input
              id="register-password"
              className={styles.passwordInput}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={localize("设置密码（至少 6 位）", "Set a password (at least 6 characters)")}
              minLength={6}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
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

        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-name">
            {localize("姓名（选填）", "Name (optional)")}
          </label>
          <input
            id="register-name"
            className={styles.input}
            autoComplete="name"
            placeholder={localize("你的姓名", "Your name")}
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
          />
        </div>

        <div className={styles.field} role="group" aria-labelledby="join-mode-label">
          <span className={styles.label} id="join-mode-label">
            {localize("加入方式", "How would you like to join?")}
          </span>
          <div className={styles.modeGrid}>
            {joinModeOptions(localize).map((option) => (
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
              {localize("实验室名称", "Lab name")}
            </label>
            <input
              id="register-lab"
              className={styles.input}
              autoComplete="organization"
              placeholder={localize("例如：肿瘤代谢实验室", "For example: Cancer Metabolism Lab")}
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
              {localize("邀请码", "Invite code")}
            </label>
            <input
              id="register-invite"
              className={`${styles.input} ${styles.monoInput}`}
              autoComplete="off"
              spellCheck={false}
              placeholder={localize("粘贴邀请码", "Paste your invite code")}
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              required
            />
            <span className={styles.fieldHint}>{localize("输入负责人发到你邮箱的邀请码，注册后直接进入该实验室。", "Enter the invite code sent to your email. You will join that lab after registering.")}</span>
          </div>
        ) : null}

        {mode === "request" ? (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="register-lab-search">
                {localize("搜索实验室", "Search labs")}
              </label>
              <input
                id="register-lab-search"
                ref={searchInputRef}
                className={styles.input}
                autoComplete="off"
                placeholder={localize("输入实验室名称关键词", "Enter lab name keywords")}
                value={labQuery}
                onChange={(event) => onLabQueryChange(event.target.value)}
              />
              {selectedLab ? (
                <div className={styles.selectedLab}>
                  <div className={styles.selectedLabInfo}>
                    <span className={styles.selectedLabName}>{selectedLab.name}</span>
                    <span className={styles.selectedLabMeta}>{localize(`${selectedLab.memberCount} 名成员 · 已选择`, `${selectedLab.memberCount} members · selected`)}</span>
                  </div>
                  <button type="button" className={styles.changeLab} onClick={onChangeLab}>
                    {localize("更换", "Change")}
                  </button>
                </div>
              ) : null}
              {!selectedLab && searchState === "loading" ? (
                <p className={styles.searchStatus} role="status">
                  {localize("搜索中…", "Searching…")}
                </p>
              ) : null}
              {!selectedLab && searchState === "done" && labResults.length === 0 ? (
                <p className={styles.searchStatus} role="status">
                  {localize("没有找到匹配的实验室，换个关键词试试。", "No matching labs found. Try a different keyword.")}
                </p>
              ) : null}
              {!selectedLab && searchState === "error" ? (
                <p className={`${styles.searchStatus} ${styles.searchStatusError}`} role="alert">
                  {localize("搜索失败，请稍后重试。", "Search failed. Please try again later.")}
                </p>
              ) : null}
              {!selectedLab && labResults.length > 0 ? (
                <ul className={styles.resultList} aria-label={localize("搜索结果", "Search results")}>
                  {labResults.map((lab) => (
                    <li key={lab.id}>
                      <button type="button" className={styles.resultItem} onClick={() => onSelectLab(lab)}>
                        <span className={styles.resultName}>{lab.name}</span>
                        <span className={styles.resultMeta}>{localize(`${lab.memberCount} 名成员`, `${lab.memberCount} members`)}</span>
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
                    {localize("给负责人的留言（选填）", "Message to the owner (optional)")}
                  </label>
                  <span className={styles.fieldHint}>{requestMessage.length}/500</span>
                </div>
                <textarea
                  id="register-request-message"
                  className={styles.textarea}
                  placeholder={localize("简单介绍一下自己，方便负责人审批", "Briefly introduce yourself to help the owner review your request")}
                  maxLength={500}
                  value={requestMessage}
                  onChange={(event) => setRequestMessage(event.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {mode === "none" ? (
          <p className={styles.modeNote}>{localize("可以先注册账号，稍后在「实验室」页面创建或加入实验室。", "You can create your account now and create or join a lab later from the Labs page.")}</p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? localize("正在提交…", "Submitting…") : submitLabel(mode, localize)}
        </button>
      </form>

      {notice && noticeMessage ? (
        <p
          className={`${styles.notice} ${notice.kind === "error" ? styles.noticeError : styles.noticeSuccess}`}
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {noticeMessage}
        </p>
      ) : null}
    </AuthShell>
  );
}
