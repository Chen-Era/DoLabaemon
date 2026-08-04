"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AnimalBatchAdmissionForm,
  AnimalBatchCageCreateForm,
  AnimalBatchOperationForm,
  AnimalCageEditor,
  AnimalOperationTimeline,
  createEmptyAnimalCageTag,
  type AnimalCageOption,
  type AnimalCageTag,
  type AnimalBatchAdmissionRecord,
  type AnimalBatchCageCreateRecord,
  type AnimalOperationRecord,
  type AnimalSex,
} from "@/components/animal/animal-cage-workflows";
import {
  AnimalRackBoard,
  type AnimalBulkRecordContext,
  type AnimalCage as BoardCage,
  type AnimalRack as BoardRack,
} from "@/components/animal/animal-rack-board";
import { requestJson } from "@/lib/http";
import styles from "./animals.module.css";

type Lab = { role: string; lab: { id: string; name: string } };
type ApiOperation = {
  id: string;
  operationType: string;
  operationAt: string;
  note?: string | null;
  batchId?: string | null;
  sourceScope?: string;
};
type ApiMouse = { id: string; operations?: ApiOperation[] };
type ApiCage = {
  id: string;
  rackId: string;
  rowIndex: number;
  columnIndex: number;
  positionName?: string;
  movedInAt: string;
  initialAgeWeeks: number;
  currentAgeWeeks?: number;
  strain?: string | null;
  sex: AnimalSex;
  genotype?: string | null;
  project?: string | null;
  note?: string | null;
  mouseCount?: number;
  mice?: ApiMouse[];
};
type ApiRack = {
  id: string;
  labId: string;
  name: string;
  rows: number;
  columns: number;
  note?: string | null;
  cages: ApiCage[];
};
type CageDialog = { rackId: string; position: string; cageId?: string };

function toInputDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function toBoardSex(sex: AnimalSex): NonNullable<BoardCage["sex"]> {
  switch (sex) {
    case "MALE":
      return "male";
    case "FEMALE":
      return "female";
    case "MIXED":
      return "mixed";
    default:
      return "unknown";
  }
}

function apiPosition(cage: Pick<ApiCage, "columnIndex" | "rowIndex" | "positionName">) {
  return cage.positionName ?? `${String.fromCharCode(64 + cage.columnIndex)}${cage.rowIndex}`;
}

function indicesFor(position: string) {
  const match = /^([A-Z])(\d{1,2})$/.exec(position);
  if (!match) return null;
  return { columnIndex: match[1].charCodeAt(0) - 64, rowIndex: Number(match[2]) };
}

function positionsForRack(rack: BoardRack) {
  return Array.from({ length: rack.rows }, (_, rowOffset) => (
    Array.from({ length: rack.columns }, (_, columnOffset) => `${String.fromCharCode(65 + columnOffset)}${rowOffset + 1}`)
  )).flat();
}

function toBoardRack(rack: ApiRack): BoardRack {
  const cages: BoardRack["cages"] = {};
  for (const cage of rack.cages) {
    cages[apiPosition(cage)] = {
      id: cage.id,
      mouseCount: cage.mouseCount ?? cage.mice?.length ?? 0,
      receivedAt: toInputDate(cage.movedInAt),
      receivedAgeWeeks: cage.initialAgeWeeks,
      strain: cage.strain,
      sex: toBoardSex(cage.sex),
      genotype: cage.genotype || "WT",
      project: cage.project ?? undefined,
      status: "normal",
      note: cage.note,
    };
  }
  return {
    id: rack.id,
    name: rack.name,
    rows: rack.rows,
    columns: rack.columns,
    room: rack.note ?? undefined,
    cages,
  };
}

function toCageTag(cage: ApiCage): AnimalCageTag {
  return {
    id: cage.id,
    position: apiPosition(cage),
    mouseCount: cage.mouseCount ?? cage.mice?.length ?? 0,
    entryDate: toInputDate(cage.movedInAt),
    entryAgeWeeks: cage.initialAgeWeeks,
    strain: cage.strain ?? "",
    sex: cage.sex,
    genotype: cage.genotype || "WT",
    project: cage.project,
    note: cage.note,
  };
}

function operationRecords(cage: ApiCage, rack: ApiRack): AnimalOperationRecord[] {
  const operations = cage.mice?.flatMap((mouse) => mouse.operations ?? []) ?? [];
  const unique = new Map<string, ApiOperation>();
  for (const operation of operations) {
    // System-generated entry/exit records are one per mouse; show their
    // shared cage event once while preserving every individual record in data.
    const key = operation.batchId || `${operation.sourceScope ?? "MOUSE"}:${operation.operationType}:${operation.operationAt}:${operation.note ?? ""}`;
    unique.set(key, operation);
  }
  return [...unique.values()].map((operation) => ({
    id: operation.batchId || operation.id,
    operation: operation.operationType,
    occurredOn: toInputDate(operation.operationAt),
    target: {
      scope: "CAGES",
      cageIds: [cage.id],
      cagePositions: [apiPosition(cage)],
      rackId: rack.id,
      rackName: rack.name,
    },
    note: operation.note,
  }));
}

function responseItem<T>(data: unknown): T | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as { item?: T; rack?: T; cage?: T };
  return candidate.item ?? candidate.rack ?? candidate.cage ?? null;
}

export default function AnimalsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [labId, setLabId] = useState("");
  const [racks, setRacks] = useState<ApiRack[]>([]);
  const racksRef = useRef<ApiRack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cageDialog, setCageDialog] = useState<CageDialog | null>(null);
  const [detailCage, setDetailCage] = useState<ApiCage | null>(null);
  const [detailRack, setDetailRack] = useState<ApiRack | null>(null);
  const [cageLoading, setCageLoading] = useState(false);
  const [savingCage, setSavingCage] = useState(false);
  const [resettingCage, setResettingCage] = useState(false);
  const [cageMessage, setCageMessage] = useState<string | null>(null);
  const [bulkContext, setBulkContext] = useState<AnimalBulkRecordContext | null>(null);
  const [savingOperation, setSavingOperation] = useState(false);
  const [admissionContext, setAdmissionContext] = useState<AnimalBulkRecordContext | null>(null);
  const [savingAdmission, setSavingAdmission] = useState(false);
  const [cageBatchContext, setCageBatchContext] = useState<AnimalBulkRecordContext | null>(null);
  const [savingCageBatch, setSavingCageBatch] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const creatingRackIdsRef = useRef(new Set<string>());

  const setRackState = useCallback((next: ApiRack[]) => {
    racksRef.current = next;
    setRacks(next);
  }, []);

  const loadRacks = useCallback(async (nextLabId: string, { keepBoard = false }: { keepBoard?: boolean } = {}) => {
    if (!nextLabId) {
      setRackState([]);
      setLoading(false);
      return;
    }
    if (!keepBoard) setLoading(true);
    try {
      const { response, data } = await requestJson<{ items?: ApiRack[]; error?: string }>(
        `/api/animals/racks?labId=${encodeURIComponent(nextLabId)}`,
      );
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        setError(data?.error ?? "读取笼架失败，请稍后重试。");
        return;
      }
      setError(null);
      setRackState(data?.items ?? []);
    } catch {
      setError("网络异常，暂时无法读取笼架。");
    } finally {
      setLoading(false);
    }
  }, [setRackState]);

  useEffect(() => {
    let disposed = false;
    async function loadLabs() {
      try {
        const { response, data } = await requestJson<{ items?: Lab[]; error?: string }>("/api/labs/my");
        if (disposed) return;
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!response.ok) {
          setError(data?.error ?? "读取实验室失败，请稍后重试。");
          setLoading(false);
          return;
        }
        const nextLabs = data?.items ?? [];
        setLabs(nextLabs);
        setLabId(nextLabs[0]?.lab.id ?? "");
        if (!nextLabs.length) setLoading(false);
      } catch {
        if (!disposed) {
          setError("网络异常，暂时无法读取实验室。");
          setLoading(false);
        }
      }
    }
    void loadLabs();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!labId) return;
    void loadRacks(labId);
  }, [labId, loadRacks]);

  const boardRacks = useMemo(() => racks.map(toBoardRack), [racks]);
  const allCageOptions = useMemo<AnimalCageOption[]>(() => racks.flatMap((rack) => rack.cages.map((cage) => ({
    id: cage.id,
    position: apiPosition(cage),
    rackId: rack.id,
    rackName: rack.name,
    mouseCount: cage.mouseCount ?? cage.mice?.length ?? 0,
  }))), [racks]);

  function applyBoardRacks(nextBoards: BoardRack[]) {
    const previous = racksRef.current;
    const previousById = new Map(previous.map((rack) => [rack.id, rack]));
    const nextApi = nextBoards.map((board) => {
      const existing = previousById.get(board.id);
      return existing
        ? { ...existing, name: board.name, rows: board.rows, columns: board.columns, note: board.room ?? null }
        : {
            id: board.id,
            labId,
            name: board.name,
            rows: board.rows,
            columns: board.columns,
            note: board.room ?? null,
            cages: [],
          };
    });
    setRackState(nextApi);

    for (const board of nextBoards) {
      const existing = previousById.get(board.id);
      if (!existing) {
        if (creatingRackIdsRef.current.has(board.id)) continue;
        creatingRackIdsRef.current.add(board.id);
        void (async () => {
          try {
            const { response, data } = await requestJson<{ error?: string }>("/api/animals/racks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ labId, name: board.name, rows: board.rows, columns: board.columns, note: board.room || null }),
            });
            if (!response.ok) throw new Error(data?.error ?? "创建笼架失败");
            const latest = toBoardRack((racksRef.current.find((rack) => rack.id === board.id) ?? nextApi.find((rack) => rack.id === board.id))!);
            const created = responseItem<ApiRack>(data);
            if (created && (created.name !== latest.name || created.rows !== latest.rows || created.columns !== latest.columns || (created.note ?? "") !== (latest.room ?? ""))) {
              await requestJson(`/api/animals/racks/${encodeURIComponent(created.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: latest.name, rows: latest.rows, columns: latest.columns, note: latest.room || null }),
              });
            }
            await loadRacks(labId, { keepBoard: true });
          } catch (createError) {
            setError(createError instanceof Error ? createError.message : "创建笼架失败，请稍后重试。");
          } finally {
            creatingRackIdsRef.current.delete(board.id);
          }
        })();
        continue;
      }
      if (
        existing.name === board.name &&
        existing.rows === board.rows &&
        existing.columns === board.columns &&
        (existing.note ?? "") === (board.room ?? "")
      ) continue;
      void (async () => {
        const { response, data } = await requestJson<{ error?: string }>(`/api/animals/racks/${encodeURIComponent(board.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: board.name, rows: board.rows, columns: board.columns, note: board.room || null }),
        });
        if (!response.ok) {
          setError(data?.error ?? "保存笼架设置失败；已恢复到最近一次保存的状态。");
          void loadRacks(labId, { keepBoard: true });
        }
      })();
    }
  }

  async function openCage(context: { rack: BoardRack; position: string; cage?: BoardCage }) {
    setCageDialog({ rackId: context.rack.id, position: context.position, cageId: context.cage?.id });
    setCageMessage(null);
    setDetailCage(null);
    setDetailRack(null);
    if (!context.cage?.id) return;
    setCageLoading(true);
    try {
      const { response, data } = await requestJson<{ item?: ApiRack; error?: string }>(`/api/animals/racks/${encodeURIComponent(context.rack.id)}`);
      if (!response.ok) throw new Error(data?.error ?? "读取笼牌详情失败");
      const fullRack = responseItem<ApiRack>(data);
      const fullCage = fullRack?.cages.find((cage) => cage.id === context.cage?.id) ?? null;
      setDetailRack(fullRack);
      setDetailCage(fullCage);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "读取笼牌详情失败，请稍后重试。");
    } finally {
      setCageLoading(false);
    }
  }

  const selectedApiCage = useMemo(() => {
    if (!cageDialog?.cageId) return null;
    return detailCage ?? racks.flatMap((rack) => rack.cages).find((cage) => cage.id === cageDialog.cageId) ?? null;
  }, [cageDialog, detailCage, racks]);
  const selectedTag = useMemo(() => selectedApiCage ? toCageTag(selectedApiCage) : cageDialog ? createEmptyAnimalCageTag(cageDialog.position) : null, [cageDialog, selectedApiCage]);

  async function saveCage(result: { cage: AnimalCageTag; movement: { type: "SET" | "ARRIVAL" | "DEPARTURE"; quantity: number; occurredOn: string; reason?: string | null } | null }) {
    if (!cageDialog || !selectedTag) return;
    const indices = indicesFor(cageDialog.position);
    if (!indices) return;
    setSavingCage(true);
    setCageMessage(null);
    try {
      let cageId = selectedApiCage?.id;
      if (!cageId) {
        const { response, data } = await requestJson<{ item?: ApiCage; error?: string }>("/api/animals/cages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labId,
            rackId: cageDialog.rackId,
            ...indices,
            movedInAt: result.cage.entryDate,
            initialAgeWeeks: result.cage.entryAgeWeeks,
            strain: result.cage.strain || null,
            sex: result.cage.sex,
            genotype: result.cage.genotype?.trim() || "WT",
            project: result.cage.project || null,
            note: result.cage.note || null,
            mouseCount: result.cage.mouseCount,
          }),
        });
        if (!response.ok) throw new Error(data?.error ?? "新建笼牌失败");
        cageId = responseItem<ApiCage>(data)?.id;
      } else {
        const { response, data } = await requestJson<{ error?: string }>(`/api/animals/cages/${encodeURIComponent(cageId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movedInAt: result.cage.entryDate,
            initialAgeWeeks: result.cage.entryAgeWeeks,
            strain: result.cage.strain || null,
            sex: result.cage.sex,
            genotype: result.cage.genotype?.trim() || "WT",
            project: result.cage.project || null,
            note: result.cage.note || null,
          }),
        });
        if (!response.ok) throw new Error(data?.error ?? "保存笼牌失败");
        const previousCount = selectedApiCage?.mouseCount ?? selectedApiCage?.mice?.length ?? 0;
        const difference = result.cage.mouseCount - previousCount;
        const movement = result.movement;
        if (movement && difference !== 0) {
          const action = movement.type === "ARRIVAL" || (movement.type === "SET" && difference > 0) ? "ADMIT" : "DEPART";
          const residentPayload = action === "ADMIT"
            ? { action, count: Math.abs(difference), movedAt: movement.occurredOn, note: movement.reason || null }
            : { action, count: Math.abs(difference), movedAt: movement.occurredOn, leaveReason: movement.reason || null };
          const resident = await requestJson<{ error?: string }>(`/api/animals/cages/${encodeURIComponent(cageId)}/residents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(residentPayload),
          });
          if (!resident.response.ok) throw new Error(resident.data?.error ?? "更新小鼠数量失败");
        }
      }
      await loadRacks(labId, { keepBoard: true });
      if (cageId) {
        const currentRack = racksRef.current.find((rack) => rack.id === cageDialog.rackId);
        if (currentRack) await openCage({ rack: toBoardRack(currentRack), position: cageDialog.position, cage: { id: cageId, mouseCount: result.cage.mouseCount } });
      }
      setError(null);
      setCageMessage("笼牌已保存，笼架中的数量和信息已同步更新。");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "保存笼牌失败，请稍后重试。";
      setError(message);
      setCageMessage(message);
    } finally {
      setSavingCage(false);
    }
  }

  async function resetCage() {
    const cageId = selectedApiCage?.id;
    const position = selectedTag?.position;
    if (!cageId || !position) return;
    setResettingCage(true);
    setCageMessage(null);
    try {
      const { response, data } = await requestJson<{ error?: string }>(`/api/animals/cages/${encodeURIComponent(cageId)}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(data?.error ?? "重置笼牌失败");
      setCageDialog(null);
      setDetailCage(null);
      setDetailRack(null);
      setError(null);
      setStatusMessage(`${position} 笼牌已重置，笼位现可重新创建笼牌。`);
      await loadRacks(labId, { keepBoard: true });
    } catch (resetError) {
      const message = resetError instanceof Error ? resetError.message : "重置笼牌失败，请稍后重试。";
      setError(message);
      setCageMessage(message);
    } finally {
      setResettingCage(false);
    }
  }

  async function saveCageBatch(record: AnimalBatchCageCreateRecord) {
    if (!cageBatchContext) return;
    const positions = record.positions.map(indicesFor);
    if (positions.some((position) => !position)) {
      setError("存在无效的笼位坐标，请重新选择。");
      return;
    }
    setSavingCageBatch(true);
    try {
      const { response, data } = await requestJson<{ error?: string; items?: ApiCage[] }>("/api/animals/cages/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          rackId: cageBatchContext.rack.id,
          positions,
          movedInAt: record.entryDate,
          initialAgeWeeks: record.entryAgeWeeks,
          strain: record.strain,
          sex: record.sex,
          genotype: record.genotype || "WT",
          project: record.project ?? null,
          note: record.note ?? null,
          mouseCount: record.mouseCount,
        }),
      });
      if (!response.ok) throw new Error(data?.error ?? "批量创建笼牌失败");
      const createdCount = data?.items?.length ?? record.positions.length;
      setCageBatchContext(null);
      setError(null);
      setStatusMessage(`已创建 ${createdCount} 张笼牌，并登记 ${createdCount * record.mouseCount} 只初始小鼠。`);
      await loadRacks(labId, { keepBoard: true });
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "批量创建笼牌失败，请稍后重试。");
    } finally {
      setSavingCageBatch(false);
    }
  }

  async function saveBulkOperation(record: AnimalOperationRecord) {
    setSavingOperation(true);
    try {
      const payload = record.target.scope === "RACK"
        ? { labId, sourceScope: "RACK", rackId: record.target.rackId, operationType: record.operation, operationAt: record.occurredOn, note: [record.operator ? `操作人员：${record.operator}` : "", record.note ?? ""].filter(Boolean).join("；") || null }
        : { labId, sourceScope: "CAGE", cageIds: record.target.cageIds, operationType: record.operation, operationAt: record.occurredOn, note: [record.operator ? `操作人员：${record.operator}` : "", record.note ?? ""].filter(Boolean).join("；") || null };
      const { response, data } = await requestJson<{ error?: string }>("/api/animals/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(data?.error ?? "批量登记失败");
      setBulkContext(null);
      setError(null);
      await loadRacks(labId, { keepBoard: true });
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "批量登记失败，请稍后重试。");
    } finally {
      setSavingOperation(false);
    }
  }

  async function saveBatchAdmission(record: AnimalBatchAdmissionRecord) {
    setSavingAdmission(true);
    try {
      const payload = record.target.scope === "RACK"
        ? { labId, sourceScope: "RACK", rackId: record.target.rackId, count: record.countPerCage, movedAt: record.movedAt, note: record.note ?? null }
        : { labId, sourceScope: "CAGE", cageIds: record.target.cageIds, count: record.countPerCage, movedAt: record.movedAt, note: record.note ?? null };
      const { response, data } = await requestJson<{ error?: string; affectedCageCount?: number; admittedCount?: number }>("/api/animals/residents/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(data?.error ?? "批量入驻失败");
      setAdmissionContext(null);
      setError(null);
      setStatusMessage(`已向 ${data?.affectedCageCount ?? record.target.cageIds.length} 个笼牌批量入驻 ${data?.admittedCount ?? 0} 只小鼠。`);
      await loadRacks(labId, { keepBoard: true });
    } catch (admissionError) {
      setError(admissionError instanceof Error ? admissionError.message : "批量入驻失败，请稍后重试。");
    } finally {
      setSavingAdmission(false);
    }
  }

  const selectedOperationRecords = selectedApiCage && detailRack ? operationRecords(selectedApiCage, detailRack) : [];
  const selectedOperationCageIds = bulkContext
    ? bulkContext.positions.map((position) => bulkContext.rack.cages[position]?.id).filter((id): id is string => Boolean(id))
    : [];
  const selectedAdmissionCageIds = admissionContext
    ? admissionContext.positions.map((position) => admissionContext.rack.cages[position]?.id).filter((id): id is string => Boolean(id))
    : [];
  const batchCageRack = cageBatchContext
    ? boardRacks.find((rack) => rack.id === cageBatchContext.rack.id) ?? cageBatchContext.rack
    : null;
  const availableBatchCagePositions = batchCageRack
    ? positionsForRack(batchCageRack).filter((position) => !batchCageRack.cages[position])
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <p className="section-kicker">动物房 · ANIMAL CARE</p>
          <h1>实验动物管理</h1>
          <p>以笼架为单位查看每个笼位，笼牌、周龄和操作记录始终保持在同一条工作流中。</p>
        </div>
        {labs.length ? (
          <div className={styles.labSelect}>
            <label htmlFor="animal-lab-select">当前实验室</label>
            <select id="animal-lab-select" className="input-base" value={labId} onChange={(event) => setLabId(event.target.value)}>
              {labs.map((lab) => <option key={lab.lab.id} value={lab.lab.id}>{lab.lab.name}</option>)}
            </select>
          </div>
        ) : null}
      </header>

      {error ? <p className="danger-panel text-sm" role="alert">{error}</p> : null}
      {statusMessage ? <p className="success-panel text-sm" role="status">{statusMessage}</p> : null}

      {!loading && !labs.length ? (
        <section className={styles.emptyState}>
          <div>
            <span className={styles.emptySymbol} aria-hidden="true">⌁</span>
            <h2>先加入一个实验室</h2>
            <p>实验动物记录归属于实验室，加入或创建实验室后即可建立笼架并协作维护。</p>
          </div>
        </section>
      ) : loading ? (
        <section className={styles.loadingBoard} role="status">正在读取动物房记录…</section>
      ) : (
        <AnimalRackBoard
          racks={boardRacks}
          onRacksChange={applyBoardRacks}
          onCageOpen={(context) => void openCage(context)}
          onBulkRecord={setBulkContext}
          onBulkAdmission={setAdmissionContext}
          onBulkCageCreate={setCageBatchContext}
        />
      )}

      {cageDialog && selectedTag ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingCage && !resettingCage) setCageDialog(null);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`${selectedTag.position} 笼牌`}>
            <header className={styles.modalHeader}>
              <p><strong>{selectedTag.position}</strong> · 笼牌与小鼠动态</p>
              <button type="button" className={styles.modalClose} onClick={() => setCageDialog(null)} disabled={savingCage || resettingCage} aria-label="关闭笼牌">×</button>
            </header>
            <div className={styles.modalBody}>
              {cageLoading ? <p className="text-sm text-slate-500">正在读取笼牌历史…</p> : null}
              {cageMessage ? <p className={`${cageMessage.startsWith("笼牌已保存") ? "success-panel" : "danger-panel"} mb-4 text-sm`} role="status">{cageMessage}</p> : null}
              <div className={styles.cageWorkflow}>
                <AnimalCageEditor
                  cage={selectedTag}
                  busy={savingCage || resettingCage}
                  resetBusy={resettingCage}
                  onCancel={() => setCageDialog(null)}
                  onSave={saveCage}
                  onReset={selectedApiCage?.id ? resetCage : undefined}
                />
                <section className={styles.historyPanel}>
                  <h2>操作记录</h2>
                  <p>按鼠或整笼批量登记的项目会自动汇总在这里。</p>
                  <AnimalOperationTimeline records={selectedOperationRecords} emptyText="这个笼位还没有可显示的操作记录。" />
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {cageBatchContext && batchCageRack ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingCageBatch) setCageBatchContext(null);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="批量创建笼牌">
            <header className={styles.modalHeader}>
              <p><strong>{batchCageRack.name}</strong> · 选择空笼位后可一次创建相同笼牌</p>
              <button type="button" className={styles.modalClose} onClick={() => setCageBatchContext(null)} disabled={savingCageBatch} aria-label="关闭批量创建笼牌">×</button>
            </header>
            <div className={styles.modalBody}>
              <AnimalBatchCageCreateForm
                rackName={batchCageRack.name}
                availablePositions={availableBatchCagePositions}
                initialSelectedPositions={cageBatchContext.positions}
                busy={savingCageBatch}
                onSubmit={saveCageBatch}
              />
            </div>
          </section>
        </div>
      ) : null}

      {bulkContext ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingOperation) setBulkContext(null);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="批量录入动物操作">
            <header className={styles.modalHeader}>
              <p><strong>{bulkContext.rack.name}</strong> · 已从笼架中选择 {bulkContext.positions.length} 个笼位</p>
              <button type="button" className={styles.modalClose} onClick={() => setBulkContext(null)} disabled={savingOperation} aria-label="关闭批量录入">×</button>
            </header>
            <div className={styles.modalBody}>
              <AnimalBatchOperationForm
                cages={allCageOptions}
                racks={racks.map((rack) => ({ id: rack.id, name: rack.name }))}
                initialSelectedCageIds={selectedOperationCageIds}
                busy={savingOperation}
                onSubmit={saveBulkOperation}
              />
            </div>
          </section>
        </div>
      ) : null}

      {admissionContext ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingAdmission) setAdmissionContext(null);
        }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="批量入驻小鼠">
            <header className={styles.modalHeader}>
              <p><strong>{admissionContext.rack.name}</strong> · 已从笼架中选择 {admissionContext.positions.length} 个笼位</p>
              <button type="button" className={styles.modalClose} onClick={() => setAdmissionContext(null)} disabled={savingAdmission} aria-label="关闭批量入驻">×</button>
            </header>
            <div className={styles.modalBody}>
              <AnimalBatchAdmissionForm
                cages={allCageOptions}
                racks={racks.map((rack) => ({ id: rack.id, name: rack.name }))}
                initialSelectedCageIds={selectedAdmissionCageIds}
                busy={savingAdmission}
                onSubmit={saveBatchAdmission}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
