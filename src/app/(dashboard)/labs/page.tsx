"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon, ChevronDownIcon, CopyIcon, LabsIcon, SearchIcon } from "@/components/common/app-icons";
import { useLocale } from "@/components/common/locale-provider";
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
type Localize = (zh: string, en: string) => string;

function roleStyle(role: string, localize: Localize) {
  if (role === "PI") {
    return {
      label: localize("负责人", "Principal investigator"),
      chip: "border-violet-200 bg-violet-50 text-violet-700",
      marker: "bg-violet-500",
    };
  }
  if (role === "ADMIN") {
    return {
      label: localize("管理员", "Administrator"),
      chip: "border-cyan-200 bg-cyan-50 text-cyan-700",
      marker: "bg-cyan-500",
    };
  }
  return {
    label: localize("成员", "Member"),
    chip: "border-slate-200 bg-slate-50 text-slate-600",
    marker: "bg-slate-400",
  };
}

function requestStatusStyle(status: string, localize: Localize) {
  if (status === "APPROVED") {
    return { label: localize("已通过", "Approved"), chip: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  if (status === "REJECTED") {
    return { label: localize("已拒绝", "Rejected"), chip: "border-red-200 bg-red-50 text-red-600" };
  }
  return { label: localize("待审批", "Pending review"), chip: "border-amber-200 bg-amber-50 text-amber-700" };
}

function formatTime(value: string | null | undefined, locale: "zh" | "en") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const { locale, localize } = useLocale();
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
        setLoadError(data?.error ?? localize("加载实验室失败，请稍后重试。", "Unable to load labs. Please try again."));
        return;
      }
      setLoadError(null);
      syncItems(data?.items ?? []);
    } catch {
      setLoadError(localize("网络异常，暂时无法读取实验室工作区。", "A network error prevented the lab workspace from loading."));
    } finally {
      setLoading(false);
    }
  }, [localize, syncItems]);

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
      setCreateMsg({ kind: "error", text: localize("请输入实验室名称。", "Enter a lab name.") });
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
          ? { kind: "success", text: localize("实验室已创建，你是这里的负责人。", "Lab created. You are its principal investigator.") }
          : { kind: "error", text: data?.error ?? localize("创建失败", "Unable to create the lab.") },
      );
      if (response.ok) {
        setCreateForm({ name: "" });
        await loadLabs();
      }
    } catch {
      setCreateMsg({ kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") });
    } finally {
      setCreating(false);
    }
  }

  async function joinLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inviteId = joinForm.inviteId.trim();
    if (!inviteId) {
      setJoinMsg({ kind: "error", text: localize("请输入邀请码。", "Enter an invitation code.") });
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
          ? { kind: "success", text: localize("已加入实验室，现在可以开始使用。", "You have joined the lab and can get started.") }
          : { kind: "error", text: data?.error ?? localize("加入失败", "Unable to join the lab.") },
      );
      if (response.ok) {
        setJoinForm({ inviteId: "" });
        await loadLabs();
      }
    } catch {
      setJoinMsg({ kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") });
    } finally {
      setJoining(false);
    }
  }

  async function applyJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applySelected) {
      setApplyMsg({ kind: "error", text: localize("请先搜索并选择要申请加入的实验室。", "Search for and select a lab to join first.") });
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
        setApplyMsg({
          kind: "success",
          text: localize(
            `已向「${applySelected.name}」提交申请，等待负责人审批。`,
            `Your request to join “${applySelected.name}” has been submitted and is awaiting review.`,
          ),
        });
        setApplySelected(null);
        setApplyQuery("");
        setApplyMessage("");
        await loadJoinRequests();
      } else {
        const text =
          data?.code === "ALREADY_IN_LAB"
            ? localize("你已经是该实验室的成员。", "You are already a member of this lab.")
            : data?.code === "REQUEST_ALREADY_PENDING"
              ? localize("你已经提交过申请，请等待审批。", "You have already submitted a request. Please wait for review.")
              : (data?.error ?? localize("提交申请失败", "Unable to submit the request."));
        setApplyMsg({ kind: "error", text });
      }
    } catch {
      setApplyMsg({ kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") });
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
            ? {
                kind: "success",
                text: localize(
                  `已通过 ${request.user.email} 加入「${request.lab.name}」的申请。`,
                  `Approved ${request.user.email}'s request to join “${request.lab.name}”.`,
                ),
              }
            : {
                kind: "success",
                text: localize(`已拒绝 ${request.user.email} 的申请。`, `Rejected ${request.user.email}'s request.`),
              },
        );
        setPendingRequests((previous) => previous.filter((item) => item.id !== request.id));
        if (action === "approve" && expandedLabs[request.lab.id]) {
          await loadMembers(request.lab.id);
        }
      } else {
        setReviewMsg({ kind: "error", text: data?.error ?? localize("操作失败，请稍后重试。", "The action failed. Please try again.") });
      }
    } catch {
      setReviewMsg({ kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") });
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
        setMembersMsg((previous) => ({
          ...previous,
          [labId]: { kind: "error", text: data?.error ?? localize("加载成员失败", "Unable to load members.") },
        }));
      }
    } catch {
      setMembersMsg((previous) => ({
        ...previous,
        [labId]: { kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") },
      }));
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
          [labId]: {
            kind: "success",
            text: localize(
              `已将 ${member.displayName || member.email} 移出实验室。`,
              `${member.displayName || member.email} has been removed from the lab.`,
            ),
          },
        }));
      } else {
        setMembersMsg((previous) => ({
          ...previous,
          [labId]: { kind: "error", text: data?.error ?? localize("移除失败", "Unable to remove the member.") },
        }));
      }
    } catch {
      setMembersMsg((previous) => ({
        ...previous,
        [labId]: { kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") },
      }));
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
          [labId]: {
            kind: "success",
            text: localize(
              `已将 ${member.displayName || member.email} 设为${roleStyle(updatedRole, localize).label}。`,
              `${member.displayName || member.email} is now ${roleStyle(updatedRole, localize).label}.`,
            ),
          },
        }));
      } else {
        setMembersMsg((previous) => ({
          ...previous,
          [labId]: { kind: "error", text: data?.error ?? localize("更新角色失败", "Unable to update the role.") },
        }));
      }
    } catch {
      setMembersMsg((previous) => ({
        ...previous,
        [labId]: { kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") },
      }));
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
          [lab.id]: { kind: "error", text: data?.error ?? localize("删除实验室失败", "Unable to delete the lab.") },
        }));
      }
    } catch {
      setMembersMsg((previous) => ({
        ...previous,
        [lab.id]: { kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") },
      }));
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
      setInviteMsg({ kind: "error", text: localize("请选择要邀请成员加入的实验室。", "Select a lab to invite a member to.") });
      return;
    }
    const membership = items.find((item) => item.lab.id === invite.labId);
    if (!membership || !["PI", "ADMIN"].includes(membership.role)) {
      setInviteMsg({ kind: "error", text: localize("只有该实验室的负责人或管理员可以创建邀请。", "Only the lab's principal investigator or administrators can create invitations.") });
      return;
    }
    if (invite.role === "ADMIN" && membership.role !== "PI") {
      setInviteMsg({ kind: "error", text: localize("只有负责人可以授予管理员角色。", "Only the principal investigator can grant the administrator role.") });
      return;
    }
    if (!invite.email.trim()) {
      setInviteMsg({ kind: "error", text: localize("请输入成员邮箱。", "Enter the member's email address.") });
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
        setInviteMsg({ kind: "success", text: localize("邀请码已创建，发给新成员即可。", "Invitation code created. Send it to the new member.") });
        setInvite((previous) => ({ ...previous, email: "", role: "MEMBER" }));
        await loadInvites(invite.labId);
      } else {
        setInviteMsg({ kind: "error", text: data?.error ?? localize("邀请失败", "Unable to create the invitation.") });
      }
    } catch {
      setInviteMsg({ kind: "error", text: localize("网络异常，请稍后重试。", "A network error occurred. Please try again.") });
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
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{localize("实验室协作", "Lab collaboration")}</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-300">{localize("每个实验室单独管理成员、试剂和实验准备。", "Each lab manages its own members, reagents, and experiment preparation.")}</p>
            </div>
          </div>
          <p className="text-sm text-cyan-100">{loading ? localize("正在加载…", "Loading…") : localize(`已加入 ${items.length} 个实验室`, `Joined ${items.length} lab${items.length === 1 ? "" : "s"}`)}</p>
        </div>
      </section>

      {loadError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{loadError}</span>
          <button type="button" className="button-secondary shrink-0" onClick={() => void loadLabs()}>
            {localize("重新加载", "Reload")}
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.32fr)_minmax(20rem,0.68fr)]">
        <section className="app-panel overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">{localize("我的实验室", "My labs")}</h2>
              <p className="section-copy mt-1.5 max-w-xl text-sm">{localize("每个实验室的数据和权限都单独管理。", "Data and permissions are managed separately for each lab.")}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {loading ? localize("正在加载", "Loading") : localize("已加载", "Loaded")}
            </span>
          </div>

          <div className="p-4 md:p-5">
            {loading ? (
              <div className="space-y-3" aria-label={localize("正在加载实验室", "Loading labs")}>
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : items.length ? (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const tone = roleStyle(item.role, localize);
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
                            <p className="mt-1 text-sm text-slate-500">{localize(`你在这个实验室的角色是${tone.label}。`, `Your role in this lab is ${tone.label}.`)}</p>
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
                              {localize("管理成员", "Manage members")}
                              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {expanded ? (
                        <div className="border-t border-slate-200 px-4 py-4">
                          <h4 className="text-sm font-semibold text-slate-950">{localize("成员列表", "Members")}</h4>
                          <div className="mt-3 space-y-2">
                            {!members ? (
                              <p className="text-sm text-slate-500">{localize("正在加载成员…", "Loading members…")}</p>
                            ) : members.length ? (
                              members.map((member) => {
                                const memberTone = roleStyle(member.role, localize);
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
                                            aria-label={localize(`设置 ${member.displayName || member.email} 的角色`, `Set role for ${member.displayName || member.email}`)}
                                            value={member.role}
                                            disabled={memberBusy}
                                            onChange={(event) => {
                                              const role = event.target.value as AssignableRole;
                                              if (role !== member.role) void changeMemberRole(item.lab.id, member, role);
                                            }}
                                          >
                                            <option value="MEMBER">{localize("成员", "Member")}</option>
                                            <option value="ADMIN">{localize("管理员", "Administrator")}</option>
                                          </select>
                                        ) : (
                                          <button
                                            type="button"
                                            className="w-fit rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                                            aria-label={localize(`将 ${member.displayName || member.email} 设为成员`, `Set ${member.displayName || member.email} as a member`)}
                                            disabled={memberBusy}
                                            onClick={() => void changeMemberRole(item.lab.id, member, "MEMBER")}
                                          >
                                            {memberBusy ? localize("正在处理…", "Working…") : localize("设为成员", "Set as member")}
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
                                              {memberBusy ? localize("正在处理…", "Working…") : localize("确认移除", "Confirm removal")}
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                              onClick={() => setConfirmRemoveKey(null)}
                                            >
                                              {localize("取消", "Cancel")}
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="w-fit rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                            disabled={memberBusy}
                                            onClick={() => setConfirmRemoveKey(key)}
                                          >
                                            {localize("移除", "Remove")}
                                          </button>
                                        )
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-slate-500">{localize("暂无成员。", "No members yet.")}</p>
                            )}
                          </div>
                          <div className="mt-3">
                            <Feedback message={memberMsg ?? null} />
                          </div>

                          {isPi ? (
                            <div className="mt-4 rounded-lg border border-red-200 bg-red-50/60 px-3 py-3">
                              <p className="text-sm font-semibold text-red-700">{localize("危险操作", "Danger zone")}</p>
                              <p className="mt-1 text-xs leading-5 text-red-600">
                                {localize("删除实验室后，其中的试剂、成员关系和邀请都会被清除，且无法恢复。", "Deleting a lab permanently removes its reagents, memberships, and invitations.")}
                              </p>
                              {deleteConfirm?.labId === item.lab.id ? (
                                <div className="mt-3 space-y-2.5">
                                  <label className="block text-xs font-medium text-red-700" htmlFor={`delete-confirm-${item.lab.id}`}>
                                    {localize(`输入实验室名称「${item.lab.name}」以确认删除`, `Enter the lab name “${item.lab.name}” to confirm deletion`)}
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
                                      {deleting ? localize("正在删除…", "Deleting…") : localize("永久删除实验室", "Permanently delete lab")}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      {localize("取消", "Cancel")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="mt-2.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                  onClick={() => setDeleteConfirm({ labId: item.lab.id, typed: "" })}
                                >
                                  {localize("删除实验室", "Delete lab")}
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
                <h3 className="mt-4 font-semibold text-slate-950">{localize("还没有实验室工作区", "No lab workspace yet")}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  {localize("你可以创建实验室、按名称申请加入同事的实验室，或使用邀请码直接加入。", "Create a lab, request to join a colleague's lab by name, or join directly with an invitation code.")}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="app-panel p-5 md:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">{localize("创建或加入实验室", "Create or join a lab")}</h2>
          <p className="section-copy mt-1.5 text-sm">{localize("创建新实验室、用邀请码加入，或按名称提交加入申请。", "Create a new lab, join with an invitation code, or submit a request by name.")}</p>

          <div className="mt-5 space-y-5">
            <form className="border-t border-slate-200 pt-5" onSubmit={createLab}>
              <div>
                <p className="text-sm font-semibold text-slate-950">{localize("创建实验室", "Create a lab")}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{localize("创建者会自动成为负责人。", "The creator automatically becomes the principal investigator.")}</p>
              </div>
              <label className="field-label mt-4" htmlFor="create-lab-name">
                {localize("实验室名称", "Lab name")}
              </label>
              <input
                id="create-lab-name"
                className="input-base"
                placeholder={localize("例如：肿瘤免疫实验室", "e.g. Tumor Immunology Lab")}
                value={createForm.name}
                onChange={(event) => setCreateForm({ name: event.target.value })}
              />
              <button type="submit" className="button-primary mt-3 w-full" disabled={creating}>
                {creating ? localize("正在创建…", "Creating…") : localize("创建工作区", "Create workspace")}
              </button>
              <div className="mt-3">
                <Feedback message={createMsg} />
              </div>
            </form>

            <form className="border-t border-slate-200 pt-5" onSubmit={joinLab}>
              <p className="text-sm font-semibold text-slate-950">{localize("邀请码加入", "Join with an invitation code")}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{localize("粘贴负责人或管理员提供的邀请码。", "Paste an invitation code from the principal investigator or an administrator.")}</p>
              <label className="field-label mt-4" htmlFor="join-invite-id">
                {localize("邀请码", "Invitation code")}
              </label>
              <input
                id="join-invite-id"
                className="input-base font-mono text-sm"
                placeholder={localize("粘贴邀请码", "Paste invitation code")}
                value={joinForm.inviteId}
                onChange={(event) => setJoinForm({ inviteId: event.target.value })}
              />
              <button type="submit" className="button-secondary mt-3 w-full" disabled={joining}>
                {joining ? localize("正在加入…", "Joining…") : localize("使用邀请码加入", "Join with code")}
              </button>
              <div className="mt-3">
                <Feedback message={joinMsg} />
              </div>
            </form>

            <form className="border-t border-slate-200 pt-5" onSubmit={applyJoin}>
              <p className="text-sm font-semibold text-slate-950">{localize("按名称申请加入", "Request to join by name")}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{localize("搜索实验室并提交申请，负责人审批通过后即可进入。", "Search for a lab and submit a request. You can join once the principal investigator approves it.")}</p>
              <label className="field-label mt-4" htmlFor="apply-lab-search">
                {localize("搜索实验室", "Search labs")}
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="apply-lab-search"
                  className="input-base input-with-leading-icon"
                  placeholder={localize("输入实验室名称关键词", "Enter lab name keywords")}
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
                    <p className="text-xs text-emerald-600">{localize(`${applySelected.memberCount} 名成员 · 已选择`, `${applySelected.memberCount} member${applySelected.memberCount === 1 ? "" : "s"} · selected`)}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                    onClick={() => setApplySelected(null)}
                  >
                    {localize("更换", "Change")}
                  </button>
                </div>
              ) : null}
              {!applySelected && applySearching ? <p className="mt-2 text-xs text-slate-500">{localize("搜索中…", "Searching…")}</p> : null}
              {!applySelected && !applySearching && applyQuery.trim() && applyResults.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">{localize("没有找到匹配的实验室。", "No matching labs found.")}</p>
              ) : null}
              {!applySelected && applyResults.length ? (
                <ul className="mt-2 space-y-1.5" aria-label={localize("搜索结果", "Search results")}>
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
                        <span className="shrink-0 text-xs text-slate-500">{localize(`${lab.memberCount} 名成员`, `${lab.memberCount} member${lab.memberCount === 1 ? "" : "s"}`)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {applySelected ? (
                <>
                  <label className="field-label mt-3" htmlFor="apply-message">
                    {localize("给负责人的留言（选填）", "Message to the principal investigator (optional)")}
                  </label>
                  <textarea
                    id="apply-message"
                    className="input-base min-h-20 resize-y"
                    maxLength={500}
                    placeholder={localize("简单介绍自己，方便负责人审批", "Briefly introduce yourself to help with review")}
                    value={applyMessage}
                    onChange={(event) => setApplyMessage(event.target.value)}
                  />
                </>
              ) : null}
              <button type="submit" className="button-secondary mt-3 w-full" disabled={applying || !applySelected}>
                {applying ? localize("正在提交…", "Submitting…") : localize("提交加入申请", "Submit join request")}
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
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">{localize("加入申请", "Join requests")}</h2>
          <p className="section-copy mt-1.5 max-w-2xl text-sm">{localize("审批待加入的申请，或查看自己提交的申请进度。", "Review pending requests or track the requests you submitted.")}</p>
        </div>

        <div className="grid gap-6 p-5 md:p-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">{localize("待我审批", "Awaiting my review")}</h3>
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
                          {request.user.displayName ? `${request.user.email} · ` : ""}{localize(`申请加入「${request.lab.name}」`, `Requested to join “${request.lab.name}”`)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">{formatTime(request.createdAt, locale)}</span>
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
                        {localize("通过", "Approve")}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                        disabled={reviewingId === request.id}
                        onClick={() => void reviewRequest(request, "reject")}
                      >
                        {localize("拒绝", "Reject")}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  {localize("暂无待审批的申请。", "No requests are awaiting review.")}
                </p>
              )}
            </div>
            <div className="mt-3">
              <Feedback message={reviewMsg} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-950">{localize("我的申请", "My requests")}</h3>
            <div className="mt-3 space-y-2.5">
              {mineRequests.length ? (
                mineRequests.map((request) => {
                  const status = requestStatusStyle(request.status, localize);
                  return (
                    <article
                      key={request.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{request.lab.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {localize(`${formatTime(request.createdAt, locale)} 提交`, `Submitted ${formatTime(request.createdAt, locale)}`)}
                          {request.status === "APPROVED" ? localize(" · 你已是该实验室成员", " · You are now a member of this lab") : ""}
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
                  {localize("还没有提交过加入申请。", "You have not submitted any join requests yet.")}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">{localize("邀请成员", "Invite members")}</h2>
            <p className="section-copy mt-1.5 max-w-2xl text-sm">
              {localize("负责人和管理员可以按邮箱创建邀请码；新成员在注册页选择「用邀请码加入」即可直接进入实验室，无需再建新实验室。", "Principal investigators and administrators can create invitation codes by email. New members can choose “Join with an invitation code” during registration to enter the lab directly.")}
            </p>
          </div>
        </div>

        <form className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-[1.25fr_1.25fr_0.8fr_auto] lg:items-end" onSubmit={sendInvite}>
          <div>
            <label className="field-label" htmlFor="invite-lab">
              {localize("选择实验室", "Select lab")}
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
                <option value="">{localize("请先创建或加入实验室", "Create or join a lab first")}</option>
              )}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="invite-email">
              {localize("成员邮箱", "Member email")}
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
              {localize("授予角色", "Assign role")}
            </label>
            <select
              id="invite-role"
              className="input-base"
              value={invite.role}
              onChange={(event) => setInvite({ ...invite, role: event.target.value as AssignableRole })}
              disabled={!items.length || !canInvite}
            >
              <option value="MEMBER">{localize("成员", "Member")}</option>
              {canInviteAdmin ? <option value="ADMIN">{localize("管理员", "Administrator")}</option> : null}
            </select>
          </div>
          <button type="submit" className="button-primary h-10 whitespace-nowrap" disabled={!items.length || !canInvite || inviting}>
            {inviting ? localize("正在创建…", "Creating…") : localize("创建邀请", "Create invitation")}
          </button>
          {items.length && !canInvite ? (
            <p className="md:col-span-2 lg:col-span-4 text-sm text-amber-700">
              {localize("你不是这个实验室的负责人或管理员，无法创建邀请。", "You are not this lab's principal investigator or an administrator, so you cannot create invitations.")}
            </p>
          ) : null}
          <div className="md:col-span-2 lg:col-span-4">
            <Feedback message={inviteMsg} />
          </div>
        </form>

        {createdInvite ? (
          <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
            <p className="text-sm font-semibold text-emerald-800">
              {localize(`邀请 ${createdInvite.email} 加入「${createdInvite.labName}」的邀请码（7 天内有效）：`, `Invitation code for ${createdInvite.email} to join “${createdInvite.labName}” (valid for 7 days):`)}
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
                {copiedCode === createdInvite.code ? localize("已复制", "Copied") : localize("复制邀请码", "Copy invitation code")}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-700">
              {localize("把邀请码发给对方；TA 在注册页选择「用邀请码加入」，用该邮箱注册即可直接进入实验室。", "Send the code to the recipient. They can choose “Join with an invitation code” during registration with this email address to enter the lab directly.")}
            </p>
          </div>
        ) : null}

        {canInvite && invites.length ? (
          <div className="border-t border-slate-200 px-5 py-5 md:px-6">
            <h3 className="text-sm font-semibold text-slate-950">{localize("当前有效的邀请", "Active invitations")}</h3>
            <ul className="mt-3 space-y-2">
              {invites.map((item) => {
                const inviteTone = roleStyle(item.role, localize);
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
                        <span className="shrink-0 text-xs text-slate-400">{localize(`${formatTime(item.expiresAt, locale)} 过期`, `Expires ${formatTime(item.expiresAt, locale)}`)}</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      onClick={() => void copyInviteCode(item.id)}
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      {copiedCode === item.id ? localize("已复制", "Copied") : localize("复制邀请码", "Copy invitation code")}
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
