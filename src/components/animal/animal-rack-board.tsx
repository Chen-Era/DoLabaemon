"use client";

import { useState } from "react";
import styles from "./animal-rack-board.module.css";

export type AnimalCageSex = "male" | "female" | "mixed" | "unknown";
export type AnimalCageStatus = "normal" | "breeding" | "experiment" | "quarantine";

/**
 * A single cage card. The map key in `AnimalRack.cages` is the Excel-like
 * cage position (for example, "A1" or "H12").
 */
export type AnimalCage = {
  id: string;
  mouseCount: number;
  capacity?: number;
  receivedAt?: string | null;
  receivedAgeWeeks?: number | null;
  strain?: string | null;
  sex?: AnimalCageSex | null;
  genotype?: string | null;
  project?: string | null;
  status?: AnimalCageStatus | null;
  note?: string | null;
};

export type AnimalRack = {
  id: string;
  name: string;
  rows: number;
  columns: number;
  room?: string | null;
  cages: Record<string, AnimalCage | undefined>;
};

export type AnimalBulkRecordContext = {
  rack: AnimalRack;
  positions: string[];
};

type AnimalRackBoardProps = {
  /** Controlled rack data, useful when the page persists data through an API. */
  racks?: AnimalRack[];
  /** Initial local data for a standalone page or prototype. */
  initialRacks?: AnimalRack[];
  className?: string;
  onRacksChange?: (racks: AnimalRack[]) => void;
  onCageOpen?: (context: { rack: AnimalRack; position: string; cage?: AnimalCage }) => void;
  onBulkRecord?: (context: AnimalBulkRecordContext) => void;
  onBulkAdmission?: (context: AnimalBulkRecordContext) => void;
  onBulkCageCreate?: (context: AnimalBulkRecordContext) => void;
};

const MAX_RACK_SIDE = 26;

const demoRacks: AnimalRack[] = [
  {
    id: "rack-1",
    name: "笼架 01",
    room: "SPF · A 区",
    rows: 5,
    columns: 6,
    cages: {
      A1: { id: "cage-a1", mouseCount: 5, capacity: 5, receivedAt: "2026-07-18", receivedAgeWeeks: 6, strain: "C57BL/6J", sex: "male", genotype: "WT", status: "normal" },
      B1: { id: "cage-b1", mouseCount: 4, capacity: 5, receivedAt: "2026-07-18", receivedAgeWeeks: 6, strain: "C57BL/6J", sex: "male", genotype: "WT", status: "normal" },
      C1: { id: "cage-c1", mouseCount: 5, capacity: 5, receivedAt: "2026-07-04", receivedAgeWeeks: 7, strain: "C57BL/6J", sex: "female", genotype: "WT", status: "normal" },
      D1: { id: "cage-d1", mouseCount: 3, capacity: 5, receivedAt: "2026-07-04", receivedAgeWeeks: 7, strain: "C57BL/6J", sex: "female", genotype: "WT", status: "normal" },
      A2: { id: "cage-a2", mouseCount: 4, capacity: 5, receivedAt: "2026-06-27", receivedAgeWeeks: 8, strain: "Balb/c", sex: "female", genotype: "Foxp3-Cre", status: "breeding" },
      B2: { id: "cage-b2", mouseCount: 1, capacity: 1, receivedAt: "2026-06-20", receivedAgeWeeks: 8, strain: "Balb/c", sex: "male", genotype: "Foxp3-Cre", status: "breeding" },
      C2: { id: "cage-c2", mouseCount: 5, capacity: 5, receivedAt: "2026-07-11", receivedAgeWeeks: 6, strain: "C57BL/6J", sex: "mixed", genotype: "Pten fl/fl", status: "experiment" },
      D2: { id: "cage-d2", mouseCount: 4, capacity: 5, receivedAt: "2026-07-25", receivedAgeWeeks: 5, strain: "C57BL/6J", sex: "male", genotype: "Pten fl/fl", status: "experiment" },
      F4: { id: "cage-f4", mouseCount: 3, capacity: 5, receivedAt: "2026-07-30", receivedAgeWeeks: 5, strain: "Nude", sex: "female", genotype: "WT", status: "quarantine", note: "隔离观察至 8/13" },
    },
  },
  {
    id: "rack-2",
    name: "笼架 02",
    room: "SPF · A 区",
    rows: 4,
    columns: 5,
    cages: {
      A1: { id: "cage-2-a1", mouseCount: 4, capacity: 5, receivedAt: "2026-07-15", receivedAgeWeeks: 6, strain: "C57BL/6J", sex: "female", genotype: "Rosa26-LSL", status: "experiment" },
      B1: { id: "cage-2-b1", mouseCount: 4, capacity: 5, receivedAt: "2026-07-15", receivedAgeWeeks: 6, strain: "C57BL/6J", sex: "female", genotype: "Rosa26-LSL", status: "experiment" },
      C3: { id: "cage-2-c3", mouseCount: 5, capacity: 5, receivedAt: "2026-07-21", receivedAgeWeeks: 5, strain: "ICR", sex: "mixed", genotype: "WT", status: "normal" },
    },
  },
];

const statusMeta: Record<AnimalCageStatus, { label: string; shortLabel: string }> = {
  normal: { label: "常规饲养", shortLabel: "常规" },
  breeding: { label: "繁育组", shortLabel: "繁育" },
  experiment: { label: "实验进行中", shortLabel: "实验" },
  quarantine: { label: "隔离观察", shortLabel: "隔离" },
};

const sexMeta: Record<AnimalCageSex, { label: string; symbol: string }> = {
  male: { label: "雄", symbol: "♂" },
  female: { label: "雌", symbol: "♀" },
  mixed: { label: "混合", symbol: "♀♂" },
  unknown: { label: "未记录", symbol: "—" },
};

function clampDimension(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_RACK_SIDE, Math.max(1, Math.trunc(value)));
}

function columnName(index: number) {
  return String.fromCharCode(65 + index);
}

function cagePosition(column: number, row: number) {
  return `${columnName(column)}${row + 1}`;
}

function formatDate(value?: string | null) {
  if (!value) return "未记录";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function currentAge(cage?: AnimalCage) {
  if (!cage?.receivedAt || cage.receivedAgeWeeks == null) return "年龄未记录";
  const arrived = new Date(`${cage.receivedAt}T00:00:00`);
  if (Number.isNaN(arrived.getTime())) return `${cage.receivedAgeWeeks} 周龄`;
  const elapsedWeeks = Math.max(0, Math.floor((Date.now() - arrived.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  return `${cage.receivedAgeWeeks + elapsedWeeks} 周龄`;
}

function cageStatus(cage?: AnimalCage): AnimalCageStatus {
  return cage?.status ?? "normal";
}

function sexFor(cage?: AnimalCage): AnimalCageSex {
  return cage?.sex ?? "unknown";
}

function summarizeRack(rack: AnimalRack) {
  const cages = Object.values(rack.cages).filter((cage): cage is AnimalCage => Boolean(cage));
  return {
    occupied: cages.length,
    mice: cages.reduce((total, cage) => total + cage.mouseCount, 0),
    capacity: rack.rows * rack.columns,
  };
}

function addRackName(racks: AnimalRack[]) {
  const suffix = String(racks.length + 1).padStart(2, "0");
  return `笼架 ${suffix}`;
}

/**
 * A presentation-first cage rack board. It manages local rack layout state
 * while cage CRUD and operation forms stay in the owning page/data layer.
 */
export function AnimalRackBoard({
  racks: controlledRacks,
  initialRacks,
  className,
  onRacksChange,
  onCageOpen,
  onBulkRecord,
  onBulkAdmission,
  onBulkCageCreate,
}: AnimalRackBoardProps) {
  const [localRacks, setLocalRacks] = useState<AnimalRack[]>(() => initialRacks ?? demoRacks);
  const racks = controlledRacks ?? localRacks;
  const [activeRackId, setActiveRackId] = useState(() => racks[0]?.id ?? "");
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);

  const activeRack = racks.find((rack) => rack.id === activeRackId) ?? racks[0];
  const activeRackStats = activeRack ? summarizeRack(activeRack) : { occupied: 0, mice: 0, capacity: 0 };
  const selectedCage = activeRack && selectedPosition ? activeRack.cages[selectedPosition] : undefined;
  const columns = activeRack ? Array.from({ length: activeRack.columns }, (_, index) => index) : [];
  const rows = activeRack ? Array.from({ length: activeRack.rows }, (_, index) => index) : [];

  function changeRacks(nextRacks: AnimalRack[]) {
    if (controlledRacks === undefined) setLocalRacks(nextRacks);
    onRacksChange?.(nextRacks);
  }

  function selectRack(rackId: string) {
    setActiveRackId(rackId);
    setSelectedPosition(null);
    setSelectedPositions([]);
    setSelectionMode(false);
    setSettingsOpen(false);
    setDetailOpen(true);
  }

  function createRack() {
    const rack: AnimalRack = {
      id: `rack-${Date.now()}`,
      name: addRackName(racks),
      rows: 6,
      columns: 8,
      cages: {},
    };
    changeRacks([...racks, rack]);
    setActiveRackId(rack.id);
    setSelectedPosition(null);
    setSelectedPositions([]);
    setSettingsOpen(true);
    setDetailOpen(false);
  }

  function updateActiveRack(patch: Partial<Pick<AnimalRack, "name" | "room" | "rows" | "columns">>) {
    if (!activeRack) return;
    const nextRacks = racks.map((rack) => (rack.id === activeRack.id ? { ...rack, ...patch } : rack));
    changeRacks(nextRacks);
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => {
      if (current) setSelectedPositions([]);
      return !current;
    });
  }

  function handleCellClick(position: string, cage?: AnimalCage) {
    if (!activeRack) return;
    if (selectionMode) {
      setSelectedPositions((current) =>
        current.includes(position) ? current.filter((item) => item !== position) : [...current, position],
      );
      return;
    }
    setSelectedPosition(position);
    setDetailOpen(true);
    onCageOpen?.({ rack: activeRack, position, cage });
  }

  function selectAllOccupied() {
    if (!activeRack) return;
    setSelectedPositions(Object.keys(activeRack.cages).filter((position) => Boolean(activeRack.cages[position])));
  }

  function startBulkRecord() {
    if (!activeRack || !selectedPositions.length) return;
    onBulkRecord?.({ rack: activeRack, positions: selectedPositions });
  }

  function startBulkAdmission() {
    if (!activeRack || !selectedPositions.length) return;
    onBulkAdmission?.({ rack: activeRack, positions: selectedPositions });
  }

  function startRackAdmission() {
    if (!activeRack) return;
    onBulkAdmission?.({ rack: activeRack, positions: Object.keys(activeRack.cages) });
  }

  function startBulkCageCreate() {
    if (!activeRack || !selectedPositions.length) return;
    onBulkCageCreate?.({ rack: activeRack, positions: selectedPositions });
  }

  function startRackCageCreate() {
    if (!activeRack) return;
    onBulkCageCreate?.({ rack: activeRack, positions: [] });
  }

  if (!activeRack) {
    return (
      <section className={`${styles.emptyState}${className ? ` ${className}` : ""}`} aria-label="实验动物笼架">
        <div>
          <span className={styles.eyebrow}>动物房</span>
          <h2>还没有笼架</h2>
          <p>新建笼架后，可按 Excel 坐标管理每一个笼位。</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={createRack}>
          <span aria-hidden="true">＋</span> 新建笼架
        </button>
      </section>
    );
  }

  return (
    <section className={`${styles.board}${className ? ` ${className}` : ""}`} aria-label="实验动物笼架管理">
      <header className={styles.topline}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>动物房 · CAGE MAP</span>
          <div className={styles.titleLine}>
            <h2>实验动物管理</h2>
            <span className={styles.rackCount}>{racks.length} 个笼架</span>
          </div>
          <p>笼位沿用 Excel 坐标：横向 A–Z，纵向 1–26。</p>
        </div>

        <div className={styles.topActions}>
          {onBulkCageCreate ? (
            <button type="button" className={styles.secondaryButton} onClick={startRackCageCreate} disabled={Object.keys(activeRack.cages).length >= activeRack.rows * activeRack.columns}>
              <span aria-hidden="true">▦</span> 批量建笼牌
            </button>
          ) : null}
          {onBulkAdmission ? (
            <button type="button" className={styles.secondaryButton} onClick={startRackAdmission} disabled={!Object.keys(activeRack.cages).length}>
              <span aria-hidden="true">＋</span> 批量入驻
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.secondaryButton} ${selectionMode ? styles.isActive : ""}`.trim()}
            onClick={toggleSelectionMode}
            aria-pressed={selectionMode}
          >
            <span aria-hidden="true">⌑</span>
            {selectionMode ? "完成选择" : "批量选择"}
          </button>
          <button type="button" className={styles.primaryButton} onClick={createRack}>
            <span aria-hidden="true">＋</span> 新建笼架
          </button>
        </div>
      </header>

      <div className={styles.rackTabs} role="tablist" aria-label="笼架列表">
        {racks.map((rack) => {
          const stats = summarizeRack(rack);
          const selected = rack.id === activeRack.id;
          return (
            <button
              type="button"
              key={rack.id}
              className={`${styles.rackTab} ${selected ? styles.rackTabActive : ""}`.trim()}
              role="tab"
              aria-selected={selected}
              onClick={() => selectRack(rack.id)}
            >
              <span className={styles.rackTabName}>{rack.name}</span>
              <span className={styles.rackTabMeta}>{rack.rows} × {rack.columns} · {stats.mice} 只</span>
            </button>
          );
        })}
      </div>

      <div className={styles.workspace}>
        <div className={styles.mapPanel}>
          <div className={styles.rackToolbar}>
            <div className={styles.rackIdentity}>
              <span className={styles.rackMark} aria-hidden="true">R</span>
              <div>
                <div className={styles.rackTitleRow}>
                  <h3>{activeRack.name}</h3>
                  {activeRack.room ? <span className={styles.roomBadge}>{activeRack.room}</span> : null}
                </div>
                <p>{activeRackStats.occupied} / {activeRackStats.capacity} 个笼位已使用</p>
              </div>
            </div>
            <button
              type="button"
              className={`${styles.configureButton} ${settingsOpen ? styles.isActive : ""}`.trim()}
              onClick={() => setSettingsOpen((current) => !current)}
              aria-expanded={settingsOpen}
            >
              <span aria-hidden="true">⚙</span> 设置笼架
            </button>
          </div>

          {settingsOpen ? (
            <div className={styles.configPanel}>
              <label>
                <span>笼架名称</span>
                <input
                  value={activeRack.name}
                  maxLength={40}
                  onChange={(event) => updateActiveRack({ name: event.target.value || "未命名笼架" })}
                  aria-label="笼架名称"
                />
              </label>
              <label>
                <span>行数（1–26）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={MAX_RACK_SIDE}
                  value={activeRack.rows}
                  onChange={(event) => updateActiveRack({ rows: clampDimension(event.currentTarget.valueAsNumber) })}
                  aria-label="笼架行数"
                />
              </label>
              <label>
                <span>列数（A–Z）</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={MAX_RACK_SIDE}
                  value={activeRack.columns}
                  onChange={(event) => updateActiveRack({ columns: clampDimension(event.currentTarget.valueAsNumber) })}
                  aria-label="笼架列数"
                />
              </label>
              <label>
                <span>房间 / 区域</span>
                <input
                  value={activeRack.room ?? ""}
                  maxLength={40}
                  placeholder="例如：SPF · A 区"
                  onChange={(event) => updateActiveRack({ room: event.target.value || null })}
                  aria-label="笼架房间或区域"
                />
              </label>
              <p className={styles.configHint}>可随时调整笼架尺寸；已存在笼位的笼牌不会被删除。</p>
            </div>
          ) : null}

          {selectionMode ? (
            <div className={styles.selectionBar} role="status">
              <span><strong>{selectedPositions.length}</strong> 个笼位已选择</span>
              <div>
                <button type="button" className={styles.textButton} onClick={selectAllOccupied}>选择所有已用笼位</button>
                <button type="button" className={styles.admissionButton} disabled={!selectedPositions.length} onClick={startBulkCageCreate}>
                  批量建笼牌
                </button>
                <button type="button" className={styles.admissionButton} disabled={!selectedPositions.length} onClick={startBulkAdmission}>
                  批量入驻
                </button>
                <button type="button" className={styles.batchButton} disabled={!selectedPositions.length} onClick={startBulkRecord}>
                  批量录入操作 <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.gridScroll}>
            <div className={styles.cageGrid} style={{ "--animal-grid-columns": activeRack.columns } as React.CSSProperties}>
              <div className={styles.cornerCell} aria-hidden="true" />
              {columns.map((column) => (
                <div className={styles.columnHeader} key={column}>{columnName(column)}</div>
              ))}
              {rows.flatMap((row) => [
                <div className={styles.rowHeader} key={`row-${row}`}>{row + 1}</div>,
                ...columns.map((column) => {
                  const position = cagePosition(column, row);
                  const cage = activeRack.cages[position];
                  const status = cageStatus(cage);
                  const sex = sexFor(cage);
                  const isCurrent = selectedPosition === position;
                  const isSelected = selectedPositions.includes(position);
                  const capacity = cage?.capacity;
                  const displayName = cage?.strain || "未设置笼牌";
                  const cageLabel = cage
                    ? `${position}，${displayName}，${cage.project ? `课题：${cage.project}，` : ""}${cage.mouseCount} 只，${sexMeta[sex].label}，${statusMeta[status].label}`
                    : `${position}，空笼位`;
                  return (
                    <button
                      type="button"
                      key={position}
                      className={`${styles.cageCell} ${cage ? styles.occupied : styles.empty} ${styles[`status${status[0].toUpperCase()}${status.slice(1)}`]} ${isCurrent ? styles.current : ""} ${isSelected ? styles.selected : ""}`.trim()}
                      onClick={() => handleCellClick(position, cage)}
                      aria-label={cageLabel}
                      aria-pressed={selectionMode ? isSelected : undefined}
                    >
                      <span className={styles.cellTopline}>
                        <span className={styles.cellPosition}>{position}</span>
                        {cage ? (
                          <span className={styles.statusPill}>{statusMeta[status].shortLabel}</span>
                        ) : null}
                      </span>
                      {cage ? (
                        <>
                          <span className={styles.cageName} title={displayName}>{displayName}</span>
                          <span className={styles.cageGenotype} title={cage.genotype || "野生型（WT）"}>{cage.genotype || "野生型（WT）"}</span>
                          {cage.project ? <span className={styles.cageProject} title={`所属课题：${cage.project}`}>{cage.project}</span> : null}
                          <span className={styles.cellBottomline}>
                            <span className={styles.mouseCount}>
                              <strong>{cage.mouseCount}</strong>
                              {capacity ? ` / ${capacity} 只` : " 只"}
                            </span>
                            <span className={styles.sexChip}>{sexMeta[sex].symbol}</span>
                          </span>
                        </>
                      ) : (
                        <span className={styles.emptyPrompt}><span aria-hidden="true">＋</span> 空笼位</span>
                      )}
                    </button>
                  );
                }),
              ])}
            </div>
          </div>

          <footer className={styles.legend} aria-label="笼位状态说明">
            {Object.entries(statusMeta).map(([status, meta]) => (
              <span key={status}><i className={`${styles.legendDot} ${styles[`dot${status[0].toUpperCase()}${status.slice(1)}`]}`} />{meta.label}</span>
            ))}
            <span className={styles.legendEmpty}><i className={styles.emptyDot} />空笼位</span>
          </footer>
        </div>

        {detailOpen ? (
          <aside className={styles.detailPanel} aria-live="polite">
            <div className={styles.detailHeader}>
              <div>
                <span className={styles.detailKicker}>笼位详情</span>
                <h3>{selectedPosition ?? "请选择一个笼位"}</h3>
              </div>
              <button type="button" className={styles.closeDetail} onClick={() => setDetailOpen(false)} aria-label="关闭笼位详情">×</button>
            </div>

            {selectedPosition && selectedCage ? (
              <>
                <div className={`${styles.detailCard} ${styles[`detail${cageStatus(selectedCage)[0].toUpperCase()}${cageStatus(selectedCage).slice(1)}`]}`}>
                  <div className={styles.detailTitleRow}>
                    <span className={styles.detailStrain}>{selectedCage.strain || "品系未记录"}</span>
                    <span className={styles.detailStatus}>{statusMeta[cageStatus(selectedCage)].label}</span>
                  </div>
                  <div className={styles.detailMouseNumber}>
                    <strong>{selectedCage.mouseCount}</strong>
                    <span>{selectedCage.capacity ? `/ ${selectedCage.capacity} 只` : "只"}</span>
                  </div>
                  <p>{selectedCage.genotype || "野生型（WT）"}</p>
                </div>

                <dl className={styles.detailList}>
                  <div><dt>进驻日期</dt><dd>{formatDate(selectedCage.receivedAt)}</dd></div>
                  <div><dt>当前周龄</dt><dd>{currentAge(selectedCage)}</dd></div>
                  <div><dt>性别</dt><dd>{sexMeta[sexFor(selectedCage)].symbol} {sexMeta[sexFor(selectedCage)].label}</dd></div>
                  <div><dt>所属课题</dt><dd>{selectedCage.project || "未设置"}</dd></div>
                  <div><dt>笼牌编号</dt><dd>{selectedCage.id}</dd></div>
                </dl>

                {selectedCage.note ? <p className={styles.note}><span aria-hidden="true">i</span>{selectedCage.note}</p> : null}
                <button
                  type="button"
                  className={styles.detailAction}
                  onClick={() => onCageOpen?.({ rack: activeRack, position: selectedPosition, cage: selectedCage })}
                >
                  打开笼牌与操作记录 <span aria-hidden="true">→</span>
                </button>
              </>
            ) : selectedPosition ? (
              <div className={styles.noCageDetail}>
                <span className={styles.noCageIcon} aria-hidden="true">＋</span>
                <h4>这是一个空笼位</h4>
                <p>可在此新建笼牌，登记小鼠进驻、周龄、品系和基因型。</p>
                <button type="button" className={styles.detailAction} onClick={() => onCageOpen?.({ rack: activeRack, position: selectedPosition })}>
                  新建笼牌 <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <div className={styles.noCageDetail}>
                <span className={styles.noCageIcon} aria-hidden="true">⌁</span>
                <h4>从笼架中选择一个笼位</h4>
                <p>笼牌信息、实时周龄和最近操作会在这里一目了然。</p>
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
