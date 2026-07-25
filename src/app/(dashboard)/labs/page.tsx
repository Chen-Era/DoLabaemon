"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http";

type Item = { role: string; lab: { id: string; name: string } };

export default function LabsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [createForm, setCreateForm] = useState({ name: "" });
  const [joinForm, setJoinForm] = useState({ inviteId: "" });
  const [invite, setInvite] = useState({ labId: "", email: "", role: "MEMBER" });
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  async function loadLabs() {
    const { data } = await requestJson<{ items?: Item[] }>("/api/labs/my");
    const nextItems = data?.items ?? [];
    setItems(nextItems);
    if (nextItems.length) {
      setInvite((p) => ({
        ...p,
        labId: nextItems.some((item) => item.lab.id === p.labId) ? p.labId : nextItems[0].lab.id,
      }));
    }
  }

  useEffect(() => {
    requestJson<{ items?: Item[] }>("/api/labs/my").then(({ data }) => {
      const nextItems = data?.items ?? [];
      setItems(nextItems);
      if (nextItems.length) {
        setInvite((p) => ({
          ...p,
          labId: nextItems.some((item) => item.lab.id === p.labId) ? p.labId : nextItems[0].lab.id,
        }));
      }
    });
  }, []);

  async function createLab() {
    try {
      const { response, data } = await requestJson<{ labId?: string; error?: string }>("/api/labs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      setCreateMsg(response.ok ? `实验室已创建：${data?.labId}` : data?.error ?? "创建失败");
      if (response.ok) {
        setCreateForm({ name: "" });
        await loadLabs();
      }
    } catch {
      setCreateMsg("网络异常，请稍后重试");
    }
  }

  async function joinLab() {
    try {
      const { response, data } = await requestJson<{ labId?: string; error?: string }>("/api/labs/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(joinForm),
      });
      setJoinMsg(response.ok ? `已加入实验室：${data?.labId}` : data?.error ?? "加入失败");
      if (response.ok) {
        setJoinForm({ inviteId: "" });
        await loadLabs();
      }
    } catch {
      setJoinMsg("网络异常，请稍后重试");
    }
  }

  async function sendInvite() {
    try {
      const { response, data } = await requestJson<{ inviteId?: string; error?: string }>("/api/labs/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      setInviteMsg(response.ok ? `邀请已创建：${data?.inviteId}` : data?.error ?? "邀请失败");
    } catch {
      setInviteMsg("网络异常，请稍后重试");
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-panel-strong px-6 py-6 md:px-8">
        <p className="section-kicker">Lab Workspace</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">我的实验室</h1>
            <p className="section-copy mt-3 max-w-2xl text-sm md:text-base">
              在同一实验室上下文中共享库存、发送邀请并维护实验准备的协作边界。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="status-pill">实验室数量 {items.length}</span>
            <span className="glass-badge">Invite Ready</span>
          </div>
        </div>
      </section>

      <div className="data-grid cols-3">
        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Membership</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">协作中的实验室</h2>
          </div>
          <div className="space-y-3">
            {items.map((it) => (
              <article key={it.lab.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{it.lab.name}</p>
                    <p className="section-copy mt-1 text-sm">当前角色：{it.role}</p>
                  </div>
                  <span className="status-pill">{it.role}</span>
                </div>
              </article>
            ))}
            {!items.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                暂无实验室数据。
              </div>
            ) : null}
          </div>
        </section>

        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Create Lab</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">新建实验室</h2>
            <p className="section-copy mt-2 text-sm">为当前账号创建新的实验室工作区，创建者自动成为 PI。</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="create-lab-name">
                实验室名称
              </label>
              <input
                id="create-lab-name"
                className="input-base"
                placeholder="例如：肿瘤免疫实验室"
                value={createForm.name}
                onChange={(e) => setCreateForm({ name: e.target.value })}
              />
            </div>
            <button type="button" onClick={createLab} className="button-primary w-full">
              创建实验室
            </button>
            {createMsg ? (
              <p className={`text-sm ${createMsg.includes("失败") || createMsg.includes("异常") ? "danger-panel" : "success-panel"}`}>
                {createMsg}
              </p>
            ) : null}
          </div>
        </section>

        <section className="app-panel px-6 py-6">
          <div className="mb-5">
            <p className="section-kicker">Join Lab</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">通过邀请码加入</h2>
            <p className="section-copy mt-2 text-sm">切换到另一个账号后，粘贴邀请 ID 即可加入实验室。</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="join-invite-id">
                邀请 ID
              </label>
              <input
                id="join-invite-id"
                className="input-base"
                placeholder="invite-xxxxxxxx"
                value={joinForm.inviteId}
                onChange={(e) => setJoinForm({ inviteId: e.target.value })}
              />
            </div>
            <button type="button" onClick={joinLab} className="button-primary w-full">
              加入实验室
            </button>
            {joinMsg ? (
              <p className={`text-sm ${joinMsg.includes("失败") || joinMsg.includes("异常") ? "danger-panel" : "success-panel"}`}>
                {joinMsg}
              </p>
            ) : null}
          </div>
        </section>

        <section className="app-panel px-6 py-6 md:col-span-2">
          <div className="mb-5">
            <p className="section-kicker">Invite Member</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">邀请成员加入实验室</h2>
            <p className="section-copy mt-2 text-sm">PI / Admin 可向成员发送邀请；对方切换到目标账号后，用返回的邀请 ID 直接加入。</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="invite-lab">
                选择实验室
              </label>
              <select
                id="invite-lab"
                className="input-base"
                value={invite.labId}
                onChange={(e) => setInvite({ ...invite, labId: e.target.value })}
              >
                {items.map((it) => (
                  <option key={it.lab.id} value={it.lab.id}>
                    {it.lab.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="invite-email">
                成员邮箱
              </label>
              <input
                id="invite-email"
                className="input-base"
                placeholder="member@lab.org"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="invite-role">
                成员角色
              </label>
              <select
                id="invite-role"
                className="input-base"
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value as "PI" | "ADMIN" | "MEMBER" })}
              >
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="PI">PI</option>
              </select>
            </div>
            <button type="button" onClick={sendInvite} className="button-primary w-full">
              发送邀请
            </button>
            {inviteMsg ? (
              <p className={`text-sm ${inviteMsg.includes("失败") || inviteMsg.includes("异常") ? "danger-panel" : "success-panel"}`}>
                {inviteMsg}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
