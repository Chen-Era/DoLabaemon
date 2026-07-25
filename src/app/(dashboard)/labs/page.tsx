"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertIcon, CheckIcon, LabsIcon } from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";

type Item = { role: string; lab: { id: string; name: string } };
type FeedbackMessage = { kind: "success" | "error"; text: string };

function roleStyle(role: string) {
  if (role === "PI") {
    return {
      label: "负责人",
      chip: "border-violet-200 bg-violet-50 text-violet-700",
      marker: "bg-violet-500",
    };
  }
  if (role === "ADMIN") {
    return {
      label: "管理员",
      chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
      marker: "bg-cyan-500",
    };
  }
  return {
    label: "成员",
    chip: "border-slate-200 bg-slate-50 text-slate-600",
    marker: "bg-slate-400",
  };
}

function Feedback({ message }: { message: FeedbackMessage | null }) {
  if (!message) return null;
  const failed = message.kind === "error";

  return (
    <p
      className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm leading-6 ${
        failed ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      role={failed ? "alert" : "status"}
    >
      {failed ? <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="[overflow-wrap:anywhere]">{message.text}</span>
    </p>
  );
}

export default function LabsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [createForm, setCreateForm] = useState({ name: "" });
  const [joinForm, setJoinForm] = useState({ inviteId: "" });
  const [invite, setInvite] = useState({ labId: "", email: "", role: "MEMBER" });
  const [createMsg, setCreateMsg] = useState<FeedbackMessage | null>(null);
  const [joinMsg, setJoinMsg] = useState<FeedbackMessage | null>(null);
  const [inviteMsg, setInviteMsg] = useState<FeedbackMessage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [inviting, setInviting] = useState(false);

  const syncItems = useCallback((nextItems: Item[]) => {
    setItems(nextItems);
    setInvite((previous) => ({
      ...previous,
      labId: nextItems.some((item) => item.lab.id === previous.labId) ? previous.labId : (nextItems[0]?.lab.id ?? ""),
    }));
  }, []);

  const loadLabs = useCallback(async () => {
    setLoading(true);
    try {
      const { response, data } = await requestJson<{ items?: Item[]; error?: string }>("/api/labs/my");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setLoadError(data?.error ?? "加载实验室失败，请稍后重试。");
        return;
      }
      setLoadError(null);
      syncItems(data?.items ?? []);
    } catch {
      setLoadError("网络异常，暂时无法读取实验室工作区。");
    } finally {
      setLoading(false);
    }
  }, [syncItems]);

  useEffect(() => {
    void loadLabs();
  }, [loadLabs]);

  async function createLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = createForm.name.trim();
    if (!name) {
      setCreateMsg({ kind: "error", text: "请输入实验室名称。" });
      return;
    }

    setCreating(true);
    setCreateMsg(null);
    try {
      const { response, data } = await requestJson<{ labId?: string; error?: string }>("/api/labs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setCreateMsg(
        response.ok
          ? { kind: "success", text: "实验室已创建，你是这里的负责人。" }
          : { kind: "error", text: data?.error ?? "创建失败" },
      );
      if (response.ok) {
        setCreateForm({ name: "" });
        await loadLabs();
      }
    } catch {
      setCreateMsg({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setCreating(false);
    }
  }

  async function joinLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inviteId = joinForm.inviteId.trim();
    if (!inviteId) {
      setJoinMsg({ kind: "error", text: "请输入邀请码。" });
      return;
    }

    setJoining(true);
    setJoinMsg(null);
    try {
      const { response, data } = await requestJson<{ labId?: string; error?: string }>("/api/labs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      setJoinMsg(
        response.ok
          ? { kind: "success", text: "已加入实验室，现在可以开始使用。" }
          : { kind: "error", text: data?.error ?? "加入失败" },
      );
      if (response.ok) {
        setJoinForm({ inviteId: "" });
        await loadLabs();
      }
    } catch {
      setJoinMsg({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setJoining(false);
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invite.labId) {
      setInviteMsg({ kind: "error", text: "请选择要邀请成员加入的实验室。" });
      return;
    }
    const membership = items.find((item) => item.lab.id === invite.labId);
    if (!membership || !["PI", "ADMIN"].includes(membership.role)) {
      setInviteMsg({ kind: "error", text: "只有该实验室的负责人或管理员可以创建邀请。" });
      return;
    }
    if (!invite.email.trim()) {
      setInviteMsg({ kind: "error", text: "请输入成员邮箱。" });
      return;
    }

    setInviting(true);
    setInviteMsg(null);
    try {
      const { response, data } = await requestJson<{ inviteId?: string; error?: string }>("/api/labs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...invite, email: invite.email.trim() }),
      });
      setInviteMsg(
        response.ok
          ? { kind: "success", text: `邀请码已创建：${data?.inviteId ?? "已生成"}` }
          : { kind: "error", text: data?.error ?? "邀请失败" },
      );
      if (response.ok) {
        setInvite((previous) => ({ ...previous, email: "", role: "MEMBER" }));
      }
    } catch {
      setInviteMsg({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setInviting(false);
    }
  }

  const selectedMembership = items.find((item) => item.lab.id === invite.labId);
  const canInvite = Boolean(selectedMembership && ["PI", "ADMIN"].includes(selectedMembership.role));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 px-6 py-6 text-white shadow-[0_16px_42px_rgba(15,23,42,0.13)] md:px-8 md:py-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-cyan-300/15 bg-cyan-300/10 blur-2xl" aria-hidden="true" />
        <div className="absolute bottom-0 right-[18%] h-40 w-40 rounded-full border border-violet-300/10 bg-violet-400/10 blur-xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <LabsIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">实验室协作</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-300">按实验室独立管理成员、试剂与实验准备。</p>
            </div>
          </div>
          <p className="text-sm text-cyan-100">{loading ? "正在同步…" : `已加入 ${items.length} 个实验室`}</p>
        </div>
      </section>

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{loadError}</span>
          <button type="button" className="button-secondary shrink-0" onClick={() => void loadLabs()}>
            重新加载
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.32fr)_minmax(20rem,0.68fr)]">
        <section className="app-panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">我的实验室</h2>
              <p className="section-copy mt-1.5 max-w-xl text-sm">不同实验室的数据和权限彼此独立。</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {loading ? "正在同步" : "已同步"}
            </span>
          </div>

          <div className="p-4 md:p-5">
            {loading ? (
              <div className="space-y-3" aria-label="正在加载实验室">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : items.length ? (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const tone = roleStyle(item.role);
                  return (
                    <article
                      key={item.lab.id}
                      className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 transition duration-150 hover:border-slate-300 hover:bg-slate-50/70 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-base font-semibold text-white shadow-sm">
                          {item.lab.name.trim().slice(0, 1).toUpperCase() || "L"}
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${tone.marker}`} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold text-slate-950">{item.lab.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">你在这里是{tone.label}。</p>
                        </div>
                      </div>
                      <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                        {tone.label}
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                  <LabsIcon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-950">还没有实验室工作区</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">先新建一个实验室，或者通过同事分享的邀请码加入已有协作空间。</p>
              </div>
            )}
          </div>
        </section>

        <section className="app-panel p-5 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">创建或加入实验室</h2>
          <p className="section-copy mt-1.5 text-sm">新建团队空间，或使用邀请码加入已有实验室。</p>

          <div className="mt-5 space-y-5">
            <form className="border-t border-slate-200 pt-5" onSubmit={createLab}>
              <div>
                <p className="text-sm font-semibold text-slate-950">创建实验室</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">创建者会自动成为负责人。</p>
              </div>
              <label className="field-label mt-4" htmlFor="create-lab-name">
                实验室名称
              </label>
              <input
                id="create-lab-name"
                className="input-base"
                placeholder="例如：肿瘤免疫实验室"
                value={createForm.name}
                onChange={(event) => setCreateForm({ name: event.target.value })}
              />
              <button type="submit" className="button-primary mt-3 w-full" disabled={creating}>
                {creating ? "正在创建…" : "创建工作区"}
              </button>
              <div className="mt-3">
                <Feedback message={createMsg} />
              </div>
            </form>

            <form className="border-t border-slate-200 pt-5" onSubmit={joinLab}>
              <p className="text-sm font-semibold text-slate-950">加入已有实验室</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">粘贴负责人或管理员提供的邀请码。</p>
              <label className="field-label mt-4" htmlFor="join-invite-id">
                邀请码
              </label>
              <input
                id="join-invite-id"
                className="input-base font-mono text-sm"
                placeholder="invite-xxxxxxxx"
                value={joinForm.inviteId}
                onChange={(event) => setJoinForm({ inviteId: event.target.value })}
              />
              <button type="submit" className="button-secondary mt-3 w-full" disabled={joining}>
                {joining ? "正在加入…" : "使用邀请码加入"}
              </button>
              <div className="mt-3">
                <Feedback message={joinMsg} />
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="app-panel overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">邀请成员</h2>
            <p className="section-copy mt-1.5 max-w-2xl text-sm">负责人和管理员可以创建邀请码并发给成员。</p>
          </div>
        </div>

        <form className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-[1.25fr_1.25fr_0.8fr_auto] lg:items-end" onSubmit={sendInvite}>
          <div>
            <label className="field-label" htmlFor="invite-lab">
              选择实验室
            </label>
            <select
              id="invite-lab"
              className="input-base"
              value={invite.labId}
              onChange={(event) => setInvite({ ...invite, labId: event.target.value })}
              disabled={!items.length}
            >
              {items.length ? (
                items.map((item) => (
                  <option key={item.lab.id} value={item.lab.id}>
                    {item.lab.name}
                  </option>
                ))
              ) : (
                <option value="">请先创建或加入实验室</option>
              )}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="invite-email">
              成员邮箱
            </label>
            <input
              id="invite-email"
              className="input-base"
              type="email"
              autoComplete="email"
              placeholder="member@lab.org"
              value={invite.email}
              onChange={(event) => setInvite({ ...invite, email: event.target.value })}
              disabled={!items.length || !canInvite}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="invite-role">
              授予角色
            </label>
            <select
              id="invite-role"
              className="input-base"
              value={invite.role}
              onChange={(event) => setInvite({ ...invite, role: event.target.value as "PI" | "ADMIN" | "MEMBER" })}
              disabled={!items.length || !canInvite}
            >
              <option value="MEMBER">成员</option>
              <option value="ADMIN">管理员</option>
              <option value="PI">负责人</option>
            </select>
          </div>
          <button type="submit" className="button-primary h-10 whitespace-nowrap" disabled={!items.length || !canInvite || inviting}>
            {inviting ? "正在创建…" : "创建邀请"}
          </button>
          {items.length && !canInvite ? (
            <p className="md:col-span-2 lg:col-span-4 text-sm text-amber-700">
              你不是这个实验室的负责人或管理员，无法创建邀请。
            </p>
          ) : null}
          <div className="md:col-span-2 lg:col-span-4">
            <Feedback message={inviteMsg} />
          </div>
        </form>
      </section>
    </div>
  );
}
