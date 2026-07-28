"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon, ChevronDownIcon, CopyIcon, LabsIcon, SearchIcon } from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";

type Item = { role: string; lab: { id: string; name: string } };
type Member = { userId: string; role: string; email: string; displayName: string | null };
type AssignableRole = "ADMIN" | "MEMBER";
type InviteItem = { id: string; email: string; role: string; expiresAt?: string | null };
type JoinRequestMine = {
  id: string;
  status: string;
  message?: string | null;
  createdAt: string;
  lab: { id: string; name: string };
};
type JoinRequestPending = JoinRequestMine & {
  user: { id: string; email: string; displayName: string | null };
};
type LabSearchItem = { id: string; name: string; memberCount: number };
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

function requestStatusStyle(status: string) {
  if (status === "APPROVED") {
    return { label: "已通过", chip: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (status === "REJECTED") {
    return { label: "已拒绝", chip: "border-red-200 bg-red-50 text-red-600" };
  }
  return { label: "待审批", chip: "border-amber-200 bg-amber-50 text-amber-700" };
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
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

  // 按名称申请加入
  const [applyQuery, setApplyQuery] = useState("");
  const [applyResults, setApplyResults] = useState<LabSearchItem[]>([]);
  const [applySearching, setApplySearching] = useState(false);
  const [applySelected, setApplySelected] = useState<LabSearchItem | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [applyMsg, setApplyMsg] = useState<FeedbackMessage | null>(null);
  const [applying, setApplying] = useState(false);

  // 加入申请
  const [mineRequests, setMineRequests] = useState<JoinRequestMine[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequestPending[]>([]);
  const [reviewMsg, setReviewMsg] = useState<FeedbackMessage | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // 成员管理与删除实验室
  const [expandedLabs, setExpandedLabs] = useState<Record<string, boolean>>({});
  const [membersByLab, setMembersByLab] = useState<Record<string, Member[]>>({});
  const [membersMsg, setMembersMsg] = useState<Record<string, FeedbackMessage | null>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberOperations, setMemberOperations] = useState<Record<string, true>>({});
  const memberOperationKeysRef = useRef(new Set<string>());
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ labId: string; typed: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 邀请码列表
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [createdInvite, setCreatedInvite] = useState<{ code: string; email: string; labName: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const syncItems = useCallback((nextItems: Item[]) => {
    setItems(nextItems);
    setInvite((previous) => {
      const labId = nextItems.some((item) => item.lab.id === previous.labId) ? previous.labId : (nextItems[0]?.lab.id ?? "");
      const membership = nextItems.find((item) => item.lab.id === labId);
      return {
        ...previous,
        labId,
        role: membership?.role === "PI" ? previous.role : "MEMBER",
      };
    });
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

  const loadJoinRequests = useCallback(async () => {
    try {
      const { response, data } = await requestJson<{ mine?: JoinRequestMine[]; pending?: JoinRequestPending[] }>(
        "/api/labs/join-requests",
      );
      if (response.ok) {
        setMineRequests(data?.mine ?? []);
        setPendingRequests(data?.pending ?? []);
      }
    } catch {
      // 申请列表加载失败不阻塞主页面
    }
  }, []);

  useEffect(() => {
    void loadLabs();
    void loadJoinRequests();
  }, [loadLabs, loadJoinRequests]);

  const selectedMembership = items.find((item) => item.lab.id === invite.labId);
  const canInvite = Boolean(selectedMembership && ["PI", "ADMIN"].includes(selectedMembership.role));
  const canInviteAdmin = selectedMembership?.role === "PI";

  const loadInvites = useCallback(
    async (labId: string) => {
      if (!labId || !canInvite) {
        setInvites([]);
        return;
      }
      try {
        const { response, data } = await requestJson<{ items?: InviteItem[] }>(
          `/api/labs/invite?labId=${encodeURIComponent(labId)}`,
        );
        if (response.ok) {
          setInvites(data?.items ?? []);
        }
      } catch {
        // 邀请列表失败保持静默
      }
    },
    [canInvite],
  );

  useEffect(() => {
    void loadInvites(invite.labId);
  }, [invite.labId, loadInvites]);

  // 申请加入：防抖搜索实验室
  useEffect(() => {
    if (applySelected) return;
    const query = applyQuery.trim();
    if (!query) {
      setApplyResults([]);
      setApplySearching(false);
      return;
    }
    setApplySearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { response, data } = await requestJson<{ items?: LabSearchItem[] }>(
            `/api/register/labs?q=${encodeURIComponent(query)}`,
          );
          setApplyResults(response.ok ? (data?.items ?? []) : []);
        } catch {
          setApplyResults([]);
        } finally {
          setApplySearching(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [applyQuery, applySelected]);

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

  async function applyJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applySelected) {
      setApplyMsg({ kind: "error", text: "请先搜索并选择要申请加入的实验室。" });
      return;
    }

    setApplying(true);
    setApplyMsg(null);
    try {
      const { response, data } = await requestJson<{ joinRequestId?: string; error?: string; code?: string }>(
        "/api/labs/join-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labId: applySelected.id,
            message: applyMessage.trim() || undefined,
          }),
        },
      );
      if (response.ok) {
        setApplyMsg({ kind: "success", text: `已向「${applySelected.name}」提交申请，等待负责人审批。` });
        setApplySelected(null);
        setApplyQuery("");
        setApplyMessage("");
        await loadJoinRequests();
      } else {
        const text =
          data?.code === "ALREADY_IN_LAB"
            ? "你已经是该实验室的成员。"
            : data?.code === "REQUEST_ALREADY_PENDING"
              ? "你已经提交过申请，请等待审批。"
              : (data?.error ?? "提交申请失败");
        setApplyMsg({ kind: "error", text });
      }
    } catch {
      setApplyMsg({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setApplying(false);
    }
  }

  async function reviewRequest(request: JoinRequestPending, action: "approve" | "reject") {
    setReviewingId(request.id);
    setReviewMsg(null);
    try {
      const { response, data } = await requestJson<{ error?: string }>(
        `/api/labs/join-requests/${encodeURIComponent(request.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (response.ok) {
        setReviewMsg(
          action === "approve"
            ? { kind: "success", text: `已通过 ${request.user.email} 加入「${request.lab.name}」的申请。` }
            : { kind: "success", text: `已拒绝 ${request.user.email} 的申请。` },
        );
        setPendingRequests((previous) => previous.filter((item) => item.id !== request.id));
        if (action === "approve" && expandedLabs[request.lab.id]) {
          await loadMembers(request.lab.id);
        }
      } else {
        setReviewMsg({ kind: "error", text: data?.error ?? "操作失败，请稍后重试。" });
      }
    } catch {
      setReviewMsg({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setReviewingId(null);
    }
  }

  async function loadMembers(labId: string) {
    try {
      const { response, data } = await requestJson<{ items?: Member[]; currentUserId?: string; error?: string }>(
        `/api/labs/members?labId=${encodeURIComponent(labId)}`,
      );
      if (response.ok) {
        setMembersByLab((previous) => ({ ...previous, [labId]: data?.items ?? [] }));
        setCurrentUserId(data?.currentUserId ?? null);
      } else {
        setMembersMsg((previous) => ({ ...previous, [labId]: { kind: "error", text: data?.error ?? "加载成员失败" } }));
      }
    } catch {
      setMembersMsg((previous) => ({ ...previous, [labId]: { kind: "error", text: "网络异常，请稍后重试。" } }));
    }
  }

  function toggleMembers(labId: string) {
    const next = !expandedLabs[labId];
    setExpandedLabs((previous) => ({ ...previous, [labId]: next }));
    setConfirmRemoveKey(null);
    setDeleteConfirm(null);
    if (next && !membersByLab[labId]) {
      void loadMembers(labId);
    }
  }

  function beginMemberOperation(key: string) {
    if (memberOperationKeysRef.current.has(key)) return false;
    memberOperationKeysRef.current.add(key);
    setMemberOperations((previous) => ({ ...previous, [key]: true }));
    return true;
  }

  function endMemberOperation(key: string) {
    memberOperationKeysRef.current.delete(key);
    setMemberOperations((previous) => {
      const { [key]: _completed, ...remaining } = previous;
      return remaining;
    });
  }

  async function removeMember(labId: string, member: Member) {
    const key = `${labId}:${member.userId}`;
    if (!beginMemberOperation(key)) return;
    setMembersMsg((previous) => ({ ...previous, [labId]: null }));
    try {
      const { response, data } = await requestJson<{ error?: string }>("/api/labs/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, userId: member.userId }),
      });
      if (response.ok) {
        setMembersByLab((previous) => ({
          ...previous,
          [labId]: (previous[labId] ?? []).filter((item) => item.userId !== member.userId),
        }));
        setMembersMsg((previous) => ({
          ...previous,
          [labId]: { kind: "success", text: `已将 ${member.displayName || member.email} 移出实验室。` },
        }));
      } else {
        setMembersMsg((previous) => ({ ...previous, [labId]: { kind: "error", text: data?.error ?? "移除失败" } }));
      }
    } catch {
      setMembersMsg((previous) => ({ ...previous, [labId]: { kind: "error", text: "网络异常，请稍后重试。" } }));
    } finally {
      endMemberOperation(key);
      setConfirmRemoveKey(null);
    }
  }

  async function changeMemberRole(labId: string, member: Member, role: AssignableRole) {
    const key = `${labId}:${member.userId}`;
    if (!beginMemberOperation(key)) return;
    setMembersMsg((previous) => ({ ...previous, [labId]: null }));
    try {
      const { response, data } = await requestJson<{ role?: AssignableRole; error?: string }>("/api/labs/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, userId: member.userId, role }),
      });
      const updatedRole = data?.role;
      if (response.ok && updatedRole) {
        setMembersByLab((previous) => ({
          ...previous,
          [labId]: (previous[labId] ?? []).map((item) => (item.userId === member.userId ? { ...item, role: updatedRole } : item)),
        }));
        setMembersMsg((previous) => ({
          ...previous,
          [labId]: { kind: "success", text: `已将 ${member.displayName || member.email} 设为${roleStyle(updatedRole).label}。` },
        }));
      } else {
        setMembersMsg((previous) => ({ ...previous, [labId]: { kind: "error", text: data?.error ?? "更新角色失败" } }));
      }
    } catch {
      setMembersMsg((previous) => ({ ...previous, [labId]: { kind: "error", text: "网络异常，请稍后重试。" } }));
    } finally {
      endMemberOperation(key);
    }
  }

  async function deleteLab(lab: { id: string; name: string }) {
    setDeleting(true);
    try {
      const { response, data } = await requestJson<{ error?: string }>("/api/labs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId: lab.id }),
      });
      if (response.ok) {
        setDeleteConfirm(null);
        setExpandedLabs((previous) => ({ ...previous, [lab.id]: false }));
        await loadLabs();
      } else {
        setMembersMsg((previous) => ({
          ...previous,
          [lab.id]: { kind: "error", text: data?.error ?? "删除实验室失败" },
        }));
      }
    } catch {
      setMembersMsg((previous) => ({ ...previous, [lab.id]: { kind: "error", text: "网络异常，请稍后重试。" } }));
    } finally {
      setDeleting(false);
    }
  }

  async function copyInviteCode(code: string) {
    const ok = await copyText(code);
    if (ok) {
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 2000);
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
    if (invite.role === "ADMIN" && membership.role !== "PI") {
      setInviteMsg({ kind: "error", text: "只有负责人可以授予管理员角色。" });
      return;
    }
    if (!invite.email.trim()) {
      setInviteMsg({ kind: "error", text: "请输入成员邮箱。" });
      return;
    }

    setInviting(true);
    setInviteMsg(null);
    setCreatedInvite(null);
    try {
      const { response, data } = await requestJson<{ inviteId?: string; labName?: string; error?: string }>(
        "/api/labs/invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...invite, email: invite.email.trim() }),
        },
      );
      if (response.ok && data?.inviteId) {
        setCreatedInvite({
          code: data.inviteId,
          email: invite.email.trim(),
          labName: data.labName ?? membership.lab.name,
        });
        setInviteMsg({ kind: "success", text: "邀请码已创建，发给新成员即可。" });
        setInvite((previous) => ({ ...previous, email: "", role: "MEMBER" }));
        await loadInvites(invite.labId);
      } else {
        setInviteMsg({ kind: "error", text: data?.error ?? "邀请失败" });
      }
    } catch {
      setInviteMsg({ kind: "error", text: "网络异常，请稍后重试。" });
    } finally {
      setInviting(false);
    }
  }

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
                  const isManager = ["PI", "ADMIN"].includes(item.role);
                  const isPi = item.role === "PI";
                  const expanded = Boolean(expandedLabs[item.lab.id]);
                  const members = membersByLab[item.lab.id];
                  const memberMsg = membersMsg[item.lab.id];

                  return (
                    <article
                      key={item.lab.id}
                      className="rounded-xl border border-slate-200 bg-white transition duration-150 hover:border-slate-300"
                    >
                      <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
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
                        <div className="flex items-center gap-2.5">
                          <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                            {tone.label}
                          </span>
                          {isManager ? (
                            <button
                              type="button"
                              className="button-secondary inline-flex items-center gap-1.5"
                              onClick={() => toggleMembers(item.lab.id)}
                              aria-expanded={expanded}
                            >
                              管理成员
                              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {expanded ? (
                        <div className="border-t border-slate-200 px-4 py-4">
                          <h4 className="text-sm font-semibold text-slate-950">成员列表</h4>
                          <div className="mt-3 space-y-2">
                            {!members ? (
                              <p className="text-sm text-slate-500">正在加载成员…</p>
                            ) : members.length ? (
                              members.map((member) => {
                                const memberTone = roleStyle(member.role);
                                const key = `${item.lab.id}:${member.userId}`;
                                const memberBusy = Boolean(memberOperations[key]);
                                const canChangeRole =
                                  currentUserId !== null &&
                                  member.userId !== currentUserId &&
                                  member.role !== "PI" &&
                                  (isPi || (item.role === "ADMIN" && member.role === "ADMIN"));
                                const removable =
                                  (isPi && member.role !== "PI") || (item.role === "ADMIN" && member.role === "MEMBER");
                                return (
                                  <div
                                    key={member.userId}
                                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                      <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${memberTone.chip}`}>
                                        {memberTone.label}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-900">
                                          {member.displayName || member.email}
                                        </p>
                                        {member.displayName ? (
                                          <p className="truncate text-xs text-slate-500">{member.email}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                      {canChangeRole ? (
                                        isPi ? (
                                          <select
                                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                                            aria-label={`设置 ${member.displayName || member.email} 的角色`}
                                            value={member.role}
                                            disabled={memberBusy}
                                            onChange={(event) => {
                                              const role = event.target.value as AssignableRole;
                                              if (role !== member.role) void changeMemberRole(item.lab.id, member, role);
                                            }}
                                          >
                                            <option value="MEMBER">成员</option>
                                            <option value="ADMIN">管理员</option>
                                          </select>
                                        ) : (
                                          <button
                                            type="button"
                                            className="w-fit rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                                            aria-label={`将 ${member.displayName || member.email} 设为成员`}
                                            disabled={memberBusy}
                                            onClick={() => void changeMemberRole(item.lab.id, member, "MEMBER")}
                                          >
                                            {memberBusy ? "正在处理…" : "设为成员"}
                                          </button>
                                        )
                                      ) : null}
                                      {removable ? (
                                        confirmRemoveKey === key ? (
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              className="rounded-lg border border-red-300 bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                                              disabled={memberBusy}
                                              onClick={() => void removeMember(item.lab.id, member)}
                                            >
                                              {memberBusy ? "正在处理…" : "确认移除"}
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                              onClick={() => setConfirmRemoveKey(null)}
                                            >
                                              取消
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="w-fit rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                            disabled={memberBusy}
                                            onClick={() => setConfirmRemoveKey(key)}
                                          >
                                            移除
                                          </button>
                                        )
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-slate-500">暂无成员。</p>
                            )}
                          </div>
                          <div className="mt-3">
                            <Feedback message={memberMsg ?? null} />
                          </div>

                          {isPi ? (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50/60 px-3 py-3">
                              <p className="text-sm font-semibold text-red-700">危险操作</p>
                              <p className="mt-1 text-xs leading-5 text-red-600">
                                删除实验室会同时清除其中全部试剂、成员关系与邀请，且不可恢复。
                              </p>
                              {deleteConfirm?.labId === item.lab.id ? (
                                <div className="mt-3 space-y-2.5">
                                  <label className="block text-xs font-medium text-red-700" htmlFor={`delete-confirm-${item.lab.id}`}>
                                    输入实验室名称「{item.lab.name}」以确认删除
                                  </label>
                                  <input
                                    id={`delete-confirm-${item.lab.id}`}
                                    className="input-base border-red-200 bg-white"
                                    value={deleteConfirm.typed}
                                    onChange={(event) =>
                                      setDeleteConfirm({ labId: item.lab.id, typed: event.target.value })
                                    }
                                    placeholder={item.lab.name}
                                  />
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                                      disabled={deleting || deleteConfirm.typed.trim() !== item.lab.name}
                                      onClick={() => void deleteLab(item.lab)}
                                    >
                                      {deleting ? "正在删除…" : "永久删除实验室"}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="mt-2.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                  onClick={() => setDeleteConfirm({ labId: item.lab.id, typed: "" })}
                                >
                                  删除实验室
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
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
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  可以新建一个实验室，在下方按名称申请加入同事的实验室，或使用邀请码直接加入。
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="app-panel p-5 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">创建或加入实验室</h2>
          <p className="section-copy mt-1.5 text-sm">新建团队空间、使用邀请码直接加入，或按名称申请加入。</p>

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
              <p className="text-sm font-semibold text-slate-950">邀请码加入</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">粘贴负责人或管理员提供的邀请码。</p>
              <label className="field-label mt-4" htmlFor="join-invite-id">
                邀请码
              </label>
              <input
                id="join-invite-id"
                className="input-base font-mono text-sm"
                placeholder="粘贴邀请码"
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

            <form className="border-t border-slate-200 pt-5" onSubmit={applyJoin}>
              <p className="text-sm font-semibold text-slate-950">按名称申请加入</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">搜索实验室并提交申请，负责人审批通过后即可进入。</p>
              <label className="field-label mt-4" htmlFor="apply-lab-search">
                搜索实验室
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="apply-lab-search"
                  className="input-base pl-9"
                  placeholder="输入实验室名称关键词"
                  autoComplete="off"
                  value={applyQuery}
                  onChange={(event) => {
                    setApplyQuery(event.target.value);
                    if (applySelected) setApplySelected(null);
                  }}
                />
              </div>
              {applySelected ? (
                <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-emerald-800">{applySelected.name}</p>
                    <p className="text-xs text-emerald-600">{applySelected.memberCount} 名成员 · 已选择</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                    onClick={() => setApplySelected(null)}
                  >
                    更换
                  </button>
                </div>
              ) : null}
              {!applySelected && applySearching ? <p className="mt-2 text-xs text-slate-500">搜索中…</p> : null}
              {!applySelected && !applySearching && applyQuery.trim() && applyResults.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">没有找到匹配的实验室。</p>
              ) : null}
              {!applySelected && applyResults.length ? (
                <ul className="mt-2 space-y-1.5" aria-label="搜索结果">
                  {applyResults.map((lab) => (
                    <li key={lab.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50"
                        onClick={() => {
                          setApplySelected(lab);
                          setApplyQuery("");
                          setApplyResults([]);
                        }}
                      >
                        <span className="truncate text-sm font-medium text-slate-900">{lab.name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{lab.memberCount} 名成员</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {applySelected ? (
                <>
                  <label className="field-label mt-3" htmlFor="apply-message">
                    给负责人的留言（选填）
                  </label>
                  <textarea
                    id="apply-message"
                    className="input-base min-h-20 resize-y"
                    maxLength={500}
                    placeholder="简单介绍自己，方便负责人审批"
                    value={applyMessage}
                    onChange={(event) => setApplyMessage(event.target.value)}
                  />
                </>
              ) : null}
              <button type="submit" className="button-secondary mt-3 w-full" disabled={applying || !applySelected}>
                {applying ? "正在提交…" : "提交加入申请"}
              </button>
              <div className="mt-3">
                <Feedback message={applyMsg} />
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="app-panel overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">加入申请</h2>
          <p className="section-copy mt-1.5 max-w-2xl text-sm">审批待加入的申请，或查看自己提交的申请进度。</p>
        </div>

        <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">待我审批</h3>
            <div className="mt-3 space-y-2.5">
              {pendingRequests.length ? (
                pendingRequests.map((request) => (
                  <article key={request.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {request.user.displayName || request.user.email}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {request.user.displayName ? `${request.user.email} · ` : ""}申请加入「{request.lab.name}」
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{formatTime(request.createdAt)}</span>
                    </div>
                    {request.message ? (
                      <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600 [overflow-wrap:anywhere]">
                        {request.message}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        className="button-primary px-3 py-1.5 text-xs"
                        disabled={reviewingId === request.id}
                        onClick={() => void reviewRequest(request, "approve")}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        disabled={reviewingId === request.id}
                        onClick={() => void reviewRequest(request, "reject")}
                      >
                        拒绝
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  暂无待审批的申请。
                </p>
              )}
            </div>
            <div className="mt-3">
              <Feedback message={reviewMsg} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-950">我的申请</h3>
            <div className="mt-3 space-y-2.5">
              {mineRequests.length ? (
                mineRequests.map((request) => {
                  const status = requestStatusStyle(request.status);
                  return (
                    <article
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{request.lab.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatTime(request.createdAt)} 提交
                          {request.status === "APPROVED" ? " · 你已是该实验室成员" : ""}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.chip}`}>
                        {status.label}
                      </span>
                    </article>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  还没有提交过加入申请。
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">邀请成员</h2>
            <p className="section-copy mt-1.5 max-w-2xl text-sm">
              负责人和管理员可以按邮箱创建邀请码；新成员在注册页选择「用邀请码加入」即可直接进入实验室，无需再建新实验室。
            </p>
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
              onChange={(event) => {
                const labId = event.target.value;
                const membership = items.find((item) => item.lab.id === labId);
                setInvite((previous) => ({
                  ...previous,
                  labId,
                  role: membership?.role === "PI" ? previous.role : "MEMBER",
                }));
              }}
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
              onChange={(event) => setInvite({ ...invite, role: event.target.value as AssignableRole })}
              disabled={!items.length || !canInvite}
            >
              <option value="MEMBER">成员</option>
              {canInviteAdmin ? <option value="ADMIN">管理员</option> : null}
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

        {createdInvite ? (
          <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <p className="text-sm font-semibold text-emerald-800">
              邀请 {createdInvite.email} 加入「{createdInvite.labName}」的邀请码（7 天内有效）：
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 [overflow-wrap:anywhere]">
                {createdInvite.code}
              </code>
              <button
                type="button"
                className="button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                onClick={() => void copyInviteCode(createdInvite.code)}
              >
                <CopyIcon className="h-3.5 w-3.5" />
                {copiedCode === createdInvite.code ? "已复制" : "复制邀请码"}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-700">
              把邀请码发给对方；TA 在注册页选择「用邀请码加入」，用该邮箱注册即可直接进入实验室。
            </p>
          </div>
        ) : null}

        {canInvite && invites.length ? (
          <div className="border-t border-slate-200 px-5 py-5 md:px-6">
            <h3 className="text-sm font-semibold text-slate-950">当前有效的邀请</h3>
            <ul className="mt-3 space-y-2">
              {invites.map((item) => {
                const inviteTone = roleStyle(item.role);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${inviteTone.chip}`}>
                        {inviteTone.label}
                      </span>
                      <span className="truncate text-sm text-slate-800">{item.email}</span>
                      {item.expiresAt ? (
                        <span className="shrink-0 text-xs text-slate-400">{formatTime(item.expiresAt)} 过期</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={() => void copyInviteCode(item.id)}
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      {copiedCode === item.id ? "已复制" : "复制邀请码"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
