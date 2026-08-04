"use client";

import { useMemo, useState } from "react";
import styles from "./animal-cage-workflows.module.css";

export type AnimalSex = "MALE" | "FEMALE" | "MIXED" | "UNKNOWN";
export type AnimalCountChangeType = "SET" | "ARRIVAL" | "DEPARTURE";

export type AnimalCageTag = {
  id?: string;
  /** Excel-style position, for example A1 or H12. */
  position: string;
  mouseCount: number;
  entryDate: string;
  entryAgeWeeks: number;
  strain: string;
  sex: AnimalSex;
  genotype?: string | null;
  project?: string | null;
  note?: string | null;
};

export type AnimalCageMovement = {
  type: AnimalCountChangeType;
  quantity: number;
  occurredOn: string;
  reason?: string | null;
};

export type AnimalOperationRecord = {
  id?: string;
  operation: string;
  occurredOn: string;
  target: {
    scope: "CAGES" | "RACK";
    cageIds: string[];
    cagePositions: string[];
    rackId?: string | null;
    rackName?: string | null;
  };
  operator?: string | null;
  note?: string | null;
};

export type AnimalCageOption = {
  id: string;
  position: string;
  rackId: string;
  rackName: string;
  mouseCount?: number;
};

export type AnimalRackOption = {
  id: string;
  name: string;
};

type CageEditorValues = Omit<AnimalCageTag, "mouseCount" | "entryAgeWeeks"> & {
  entryAgeWeeks: string;
  countMode: AnimalCountChangeType;
  countValue: string;
  countChangeDate: string;
  countChangeReason: string;
};

const operationOptions = ["给药", "称重", "采血", "基因鉴定", "换笼", "观察记录", "其他"];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function normalizedDate(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function dateIsAfter(value: string, reference: string) {
  const date = normalizedDate(value);
  const referenceDate = normalizedDate(reference);
  return Boolean(date && referenceDate && date.getTime() > referenceDate.getTime());
}

function dateIsBefore(value: string, reference: string) {
  const date = normalizedDate(value);
  const referenceDate = normalizedDate(reference);
  return Boolean(date && referenceDate && date.getTime() < referenceDate.getTime());
}

function sexLabel(sex: AnimalSex) {
  switch (sex) {
    case "MALE":
      return "雄";
    case "FEMALE":
      return "雌";
    case "MIXED":
      return "雌雄混合";
    default:
      return "未标注";
  }
}

function countModeLabel(mode: AnimalCountChangeType) {
  switch (mode) {
    case "ARRIVAL":
      return "新入驻";
    case "DEPARTURE":
      return "离开笼位";
    default:
      return "设置当前数量";
  }
}

function toEditorValues(cage: AnimalCageTag): CageEditorValues {
  const today = localDateString();
  return {
    ...cage,
    genotype: cage.genotype?.trim() || "WT",
    project: cage.project ?? "",
    note: cage.note ?? "",
    entryAgeWeeks: String(cage.entryAgeWeeks),
    countMode: "SET",
    countValue: String(cage.mouseCount),
    countChangeDate: today,
    countChangeReason: "",
  };
}

function cleanOptional(value: string) {
  const cleaned = value.trim();
  return cleaned || null;
}

function displayDate(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return value || "—";
  return `${parsed.getFullYear()} 年 ${parsed.getMonth() + 1} 月 ${parsed.getDate()} 日`;
}

/** Converts zero-based grid coordinates into the product's A1-style cage position. */
export function animalCagePosition(rowIndex: number, columnIndex: number) {
  if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex) || rowIndex < 0 || rowIndex > 25 || columnIndex < 0 || columnIndex > 25) {
    throw new RangeError("笼位坐标必须位于 1–26 行和 A–Z 列之间。");
  }
  return `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
}

/** Calculates a current age from the age at entry; callers can pass a stable date for tests. */
export function animalAgeAt(entryDate: string, entryAgeWeeks: number, asOfDate = localDateString()) {
  const entry = normalizedDate(entryDate);
  const asOf = normalizedDate(asOfDate);
  const startingDays = Math.max(0, Math.round(entryAgeWeeks * 7));
  const elapsedDays = entry && asOf ? Math.max(0, Math.floor((asOf.getTime() - entry.getTime()) / 86_400_000)) : 0;
  const totalDays = startingDays + elapsedDays;
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays };
}

export function formatAnimalAge(entryDate: string, entryAgeWeeks: number, asOfDate?: string) {
  const age = animalAgeAt(entryDate, entryAgeWeeks, asOfDate);
  return `${age.weeks} 周 ${age.days} 天`;
}

export function createEmptyAnimalCageTag(position: string): AnimalCageTag {
  return {
    position,
    mouseCount: 0,
    entryDate: localDateString(),
    entryAgeWeeks: 0,
    strain: "",
    sex: "UNKNOWN",
    genotype: "WT",
    project: "",
    note: "",
  };
}

export function AnimalCageLabel({ cage, asOfDate, className = "" }: { cage: AnimalCageTag; asOfDate?: string; className?: string }) {
  const age = formatAnimalAge(cage.entryDate, cage.entryAgeWeeks, asOfDate);
  const isEmpty = cage.mouseCount === 0;

  return (
    <article className={`${styles.cageLabel} ${isEmpty ? styles.cageLabelEmpty : ""} ${className}`.trim()} aria-label={`${cage.position} 笼牌`}>
      <div className={styles.cageLabelHeader}>
        <span className={styles.positionChip}>{cage.position}</span>
        <span className={`${styles.countChip} ${isEmpty ? styles.countChipEmpty : ""}`}>{isEmpty ? "空笼" : `${cage.mouseCount} 只`}</span>
      </div>
      <div className={styles.cageMainLine}>
        <strong>{cage.strain || "未填写品系"}</strong>
        <span className={styles.sexText}>{sexLabel(cage.sex)}</span>
      </div>
      <p className={styles.cageGenotype}>{cage.genotype?.trim() || "野生型（WT）"}</p>
      <dl className={styles.cageFacts}>
        <div>
          <dt>当前周龄</dt>
          <dd>{age}</dd>
        </div>
        <div>
          <dt>进驻日期</dt>
          <dd>{displayDate(cage.entryDate)}</dd>
        </div>
      </dl>
      {cage.project?.trim() ? <p className={styles.cageProject}>{cage.project}</p> : null}
    </article>
  );
}

export type AnimalCageEditorProps = {
  cage: AnimalCageTag;
  asOfDate?: string;
  submitLabel?: string;
  busy?: boolean;
  resetBusy?: boolean;
  onCancel?: () => void;
  onSave: (result: { cage: AnimalCageTag; movement: AnimalCageMovement | null }) => void | Promise<void>;
  /** Only supplied for an existing cage tag; removes the tag after a deliberate confirmation. */
  onReset?: () => void | Promise<void>;
};

/**
 * A self-contained cage-tag form. It returns both the updated cage and an optional
 * stock movement so persistence code can keep its tag and audit log in sync.
 */
export function AnimalCageEditor({ cage, asOfDate = localDateString(), submitLabel = "保存笼牌", busy = false, resetBusy = false, onCancel, onSave, onReset }: AnimalCageEditorProps) {
  const [values, setValues] = useState<CageEditorValues>(() => toEditorValues(cage));
  const [error, setError] = useState<string | null>(null);
  const [resetConfirmationOpen, setResetConfirmationOpen] = useState(false);
  const baselineCount = Math.max(0, Math.trunc(cage.mouseCount));
  const enteredCount = Number(values.countValue);
  const nextCount = values.countMode === "SET"
    ? enteredCount
    : values.countMode === "ARRIVAL"
      ? baselineCount + enteredCount
      : baselineCount - enteredCount;

  function updateValue<Key extends keyof CageEditorValues>(key: Key, value: CageEditorValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const entryAgeWeeks = Number(values.entryAgeWeeks);
    const count = Number(values.countValue);
    if (!values.strain.trim()) {
      setError("请填写品系，便于在笼架中快速识别。");
      return;
    }
    if (!normalizedDate(values.entryDate)) {
      setError("请选择有效的进驻日期。");
      return;
    }
    if (dateIsAfter(values.entryDate, asOfDate)) {
      setError("进驻日期不能晚于今天。");
      return;
    }
    if (!Number.isFinite(entryAgeWeeks) || entryAgeWeeks < 0 || entryAgeWeeks > 260) {
      setError("进驻时周龄需为 0–260 周之间的数字。");
      return;
    }
    if (!Number.isInteger(count) || count < 0 || count > 999) {
      setError(`${countModeLabel(values.countMode)}数量需为 0–999 之间的整数。`);
      return;
    }
    if (values.countMode === "DEPARTURE" && count > baselineCount) {
      setError(`离开数量不能超过当前 ${baselineCount} 只小鼠。`);
      return;
    }
    if (values.countMode !== "SET") {
      if (!normalizedDate(values.countChangeDate)) {
        setError("请选择数量变动日期。");
        return;
      }
      if (dateIsAfter(values.countChangeDate, asOfDate)) {
        setError("数量变动日期不能晚于今天。");
        return;
      }
      if (dateIsBefore(values.countChangeDate, values.entryDate)) {
        setError("数量变动日期不能早于进驻日期。");
        return;
      }
    }

    const changedCount = nextCount !== baselineCount;
    const updatedCage: AnimalCageTag = {
      id: cage.id,
      position: cage.position,
      mouseCount: nextCount,
      entryDate: values.entryDate,
      entryAgeWeeks,
      strain: values.strain.trim(),
      sex: values.sex,
      genotype: cleanOptional(values.genotype ?? ""),
      project: cleanOptional(values.project ?? ""),
      note: cleanOptional(values.note ?? ""),
    };
    const movement: AnimalCageMovement | null = changedCount
      ? {
          type: values.countMode,
          quantity: values.countMode === "SET" ? nextCount : count,
          occurredOn: values.countMode === "SET" ? asOfDate : values.countChangeDate,
          reason: cleanOptional(values.countChangeReason),
        }
      : null;
    await onSave({ cage: updatedCage, movement });
  }

  const countFieldLabel = values.countMode === "SET" ? "当前小鼠数量" : `${countModeLabel(values.countMode)}数量`;

  return (
    <form className={styles.editor} onSubmit={onSubmit} noValidate>
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.eyebrow}>笼牌信息</p>
          <h2>{cage.position} 笼位</h2>
          <p>填写后笼架会即时显示小鼠数量、品系和当前周龄。</p>
        </div>
        <div className={styles.ageCallout} aria-label="自动计算的当前周龄">
          <span>当前周龄</span>
          <strong>{formatAnimalAge(values.entryDate, Number(values.entryAgeWeeks) || 0, asOfDate)}</strong>
        </div>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>进驻日期 <em>*</em></span>
          <input type="date" value={values.entryDate} max={asOfDate} onChange={(event) => updateValue("entryDate", event.target.value)} required />
          <small>使用日期菜单选择；周龄会从此日期开始累加。</small>
        </label>
        <label className={styles.field}>
          <span>进驻时周龄（周）<em>*</em></span>
          <input type="number" min="0" max="260" step="0.1" inputMode="decimal" value={values.entryAgeWeeks} onChange={(event) => updateValue("entryAgeWeeks", event.target.value)} required />
          <small>可填写半周，例如 6.5。</small>
        </label>
        <label className={styles.field}>
          <span>品系 <em>*</em></span>
          <input value={values.strain} placeholder="例如 C57BL/6J" onChange={(event) => updateValue("strain", event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>性别 <em>*</em></span>
          <select value={values.sex} onChange={(event) => updateValue("sex", event.target.value as AnimalSex)}>
            <option value="UNKNOWN">未标注</option>
            <option value="MALE">雄</option>
            <option value="FEMALE">雌</option>
            <option value="MIXED">雌雄混合</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>基因型</span>
          <input value={values.genotype ?? ""} placeholder="例如 Cre+/−" onChange={(event) => updateValue("genotype", event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>所属课题</span>
          <input value={values.project ?? ""} placeholder="例如 PD-1 阻断实验" onChange={(event) => updateValue("project", event.target.value)} />
        </label>
      </div>

      <fieldset className={styles.countPanel}>
        <legend>小鼠数量动态更新</legend>
        <p>保留每一次进、出笼变化，避免只改总数后无法追溯。</p>
        <div className={styles.segmentedControl} aria-label="数量变动方式">
          {(["SET", "ARRIVAL", "DEPARTURE"] as const).map((mode) => (
            <label key={mode} className={values.countMode === mode ? styles.segmentActive : ""}>
              <input type="radio" name={`animal-count-mode-${cage.id ?? cage.position}`} value={mode} checked={values.countMode === mode} onChange={() => updateValue("countMode", mode)} />
              {countModeLabel(mode)}
            </label>
          ))}
        </div>
        <div className={styles.countFields}>
          <label className={styles.field}>
            <span>{countFieldLabel} <em>*</em></span>
            <input type="number" min="0" max="999" step="1" inputMode="numeric" value={values.countValue} onChange={(event) => updateValue("countValue", event.target.value)} required />
          </label>
          {values.countMode !== "SET" ? (
            <>
              <label className={styles.field}>
                <span>变动日期 <em>*</em></span>
                <input type="date" value={values.countChangeDate} min={values.entryDate || undefined} max={asOfDate} onChange={(event) => updateValue("countChangeDate", event.target.value)} required />
              </label>
              <label className={styles.field}>
                <span>变动原因</span>
                <input value={values.countChangeReason} placeholder="例如 分笼、终点取材" onChange={(event) => updateValue("countChangeReason", event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
        <div className={styles.countResult} aria-live="polite">
          <span>保存后当前数量</span>
          <strong>{Number.isFinite(nextCount) && nextCount >= 0 ? `${nextCount} 只` : "—"}</strong>
          {values.countMode !== "SET" ? <small>原有 {baselineCount} 只</small> : null}
        </div>
      </fieldset>

      <label className={`${styles.field} ${styles.fullWidth}`}>
        <span>备注</span>
        <textarea rows={3} value={values.note ?? ""} placeholder="可记录来源、禁配信息或其他注意事项" onChange={(event) => updateValue("note", event.target.value)} />
      </label>

      {cage.id && onReset ? (
        <section className={styles.resetPanel} aria-label="危险操作">
          <div className={styles.resetPanelHeading}>
            <div>
              <p>危险操作</p>
              <h3>重置笼牌</h3>
            </div>
            {!resetConfirmationOpen ? (
              <button className={styles.resetTrigger} type="button" onClick={() => setResetConfirmationOpen(true)} disabled={busy || resetBusy}>
                重置笼牌…
              </button>
            ) : null}
          </div>
          {resetConfirmationOpen ? (
            <div className={styles.resetConfirmation} role="alert">
              <p>确认后将清空该笼位当前在笼的 <strong>{baselineCount}</strong> 只小鼠，并移除这张笼牌；笼位会恢复为可创建笼牌的状态。此操作不可撤销。</p>
              <div className={styles.resetActions}>
                <button className="button-secondary" type="button" onClick={() => setResetConfirmationOpen(false)} disabled={resetBusy}>取消</button>
                <button className={styles.resetConfirmButton} type="button" onClick={() => void onReset()} disabled={busy || resetBusy}>
                  {resetBusy ? "正在重置…" : "确认重置笼牌"}
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.resetHint}>用于撤销错误建档或清空已结束的笼位；不会影响其他笼位。</p>
          )}
        </section>
      ) : null}

      {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
      <div className={styles.formActions}>
        {onCancel ? <button className="button-secondary" type="button" onClick={onCancel} disabled={busy}>取消</button> : null}
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "保存中…" : submitLabel}</button>
      </div>
    </form>
  );
}

export type AnimalBatchCageCreateRecord = {
  positions: string[];
  entryDate: string;
  entryAgeWeeks: number;
  strain: string;
  sex: AnimalSex;
  genotype: string;
  project?: string | null;
  mouseCount: number;
  note?: string | null;
};

export type AnimalBatchCageCreateFormProps = {
  rackName: string;
  availablePositions: string[];
  initialSelectedPositions?: string[];
  asOfDate?: string;
  busy?: boolean;
  onSubmit: (record: AnimalBatchCageCreateRecord) => void | Promise<void>;
};

/** Creates a matching cage card in several empty Excel-style positions at once. */
export function AnimalBatchCageCreateForm({
  rackName,
  availablePositions,
  initialSelectedPositions = [],
  asOfDate = localDateString(),
  busy = false,
  onSubmit,
}: AnimalBatchCageCreateFormProps) {
  const [selectedPositions, setSelectedPositions] = useState<string[]>(() => initialSelectedPositions.filter((position) => availablePositions.includes(position)));
  const [entryDate, setEntryDate] = useState(asOfDate);
  const [entryAgeWeeks, setEntryAgeWeeks] = useState("0");
  const [strain, setStrain] = useState("");
  const [sex, setSex] = useState<AnimalSex>("UNKNOWN");
  const [genotype, setGenotype] = useState("WT");
  const [project, setProject] = useState("");
  const [mouseCount, setMouseCount] = useState("0");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visiblePositions = useMemo(() => {
    const term = query.trim().toUpperCase();
    return term ? availablePositions.filter((position) => position.includes(term)) : availablePositions;
  }, [availablePositions, query]);
  const count = Number(mouseCount);
  const totalMice = Number.isInteger(count) && count >= 0 ? selectedPositions.length * count : 0;

  function togglePosition(position: string) {
    setSelectedPositions((current) => current.includes(position) ? current.filter((item) => item !== position) : [...current, position]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const ageWeeks = Number(entryAgeWeeks);
    if (!selectedPositions.length) {
      setError("请至少选择一个空笼位。");
      return;
    }
    if (!normalizedDate(entryDate) || dateIsAfter(entryDate, asOfDate)) {
      setError("请选择今天或之前的进驻日期。");
      return;
    }
    if (!Number.isFinite(ageWeeks) || ageWeeks < 0 || ageWeeks > 260) {
      setError("进驻时周龄需为 0–260 周之间的数字。");
      return;
    }
    if (!strain.trim()) {
      setError("请填写品系，便于在笼架中快速识别。");
      return;
    }
    if (!Number.isInteger(count) || count < 0 || count > 500) {
      setError("每个笼牌的初始数量须为 0–500 只。");
      return;
    }
    await onSubmit({
      positions: selectedPositions,
      entryDate,
      entryAgeWeeks: ageWeeks,
      strain: strain.trim(),
      sex,
      genotype: genotype.trim() || "WT",
      project: cleanOptional(project),
      mouseCount: count,
      note: cleanOptional(note),
    });
  }

  return (
    <form className={styles.batchForm} onSubmit={submit} noValidate>
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.eyebrow}>笼架 · {rackName}</p>
          <h2>批量创建笼牌</h2>
          <p>同一批次会在所选空笼位创建相同笼牌，并为每笼生成初始小鼠记录。</p>
        </div>
      </div>

      <fieldset className={styles.targetPanel}>
        <legend>选择空笼位</legend>
        <div className={styles.cagePicker}>
          <div className={styles.cagePickerHeader}>
            <label className={styles.searchField}>
              <span className="sr-only">筛选空笼位</span>
              <input value={query} placeholder="筛选笼位，例如 A1 或 12" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button type="button" className="button-ghost" onClick={() => setSelectedPositions(visiblePositions)} disabled={!visiblePositions.length}>全选筛选结果</button>
            <button type="button" className="button-ghost" onClick={() => setSelectedPositions([])} disabled={!selectedPositions.length}>清空</button>
          </div>
          <div className={styles.cageOptionList} aria-label="选择要创建笼牌的空笼位">
            {visiblePositions.map((position) => {
              const checked = selectedPositions.includes(position);
              return (
                <label className={`${styles.cageOption} ${checked ? styles.cageOptionChecked : ""}`} key={position}>
                  <input type="checkbox" checked={checked} onChange={() => togglePosition(position)} />
                  <span><strong>{position}</strong><small>空笼位</small></span>
                </label>
              );
            })}
            {!visiblePositions.length ? <p className={styles.emptyPicker}>没有符合条件的空笼位。</p> : null}
          </div>
        </div>
        <p className={styles.targetSummary}><span>将创建</span><strong>{selectedPositions.length ? `${selectedPositions.join("、")} · ${selectedPositions.length} 张笼牌` : "尚未选择笼位"}</strong></p>
      </fieldset>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>进驻日期 <em>*</em></span>
          <input type="date" value={entryDate} max={asOfDate} onChange={(event) => setEntryDate(event.target.value)} required />
          <small>周龄会从此日期开始自动累加。</small>
        </label>
        <label className={styles.field}>
          <span>进驻时周龄（周）<em>*</em></span>
          <input type="number" min="0" max="260" step="0.1" inputMode="decimal" value={entryAgeWeeks} onChange={(event) => setEntryAgeWeeks(event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>品系 <em>*</em></span>
          <input value={strain} placeholder="例如 C57BL/6J" onChange={(event) => setStrain(event.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>性别 <em>*</em></span>
          <select value={sex} onChange={(event) => setSex(event.target.value as AnimalSex)}>
            <option value="UNKNOWN">未标注</option>
            <option value="MALE">雄</option>
            <option value="FEMALE">雌</option>
            <option value="MIXED">雌雄混合</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>基因型</span>
          <input value={genotype} placeholder="留空即野生型（WT）" onChange={(event) => setGenotype(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>所属课题</span>
          <input value={project} placeholder="例如 PD-1 阻断实验" onChange={(event) => setProject(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>每笼初始小鼠数量 <em>*</em></span>
          <input type="number" min="0" max="500" step="1" inputMode="numeric" value={mouseCount} onChange={(event) => setMouseCount(event.target.value)} required />
          <small>本批将创建共 {totalMice} 只小鼠记录。</small>
        </label>
      </div>

      <label className={`${styles.field} ${styles.fullWidth}`}>
        <span>备注</span>
        <textarea rows={3} value={note} placeholder="可记录来源、禁配信息或其他注意事项" onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
      <div className={styles.formActions}>
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "创建中…" : `创建 ${selectedPositions.length} 张笼牌`}</button>
      </div>
    </form>
  );
}

export type AnimalBatchOperationFormProps = {
  cages: AnimalCageOption[];
  racks?: AnimalRackOption[];
  /** Preselects cage targets when opened from the rack-board multi-select flow. */
  initialSelectedCageIds?: string[];
  asOfDate?: string;
  busy?: boolean;
  onSubmit: (record: AnimalOperationRecord) => void | Promise<void>;
};

/** Batch operation entry that deliberately supports both a hand-picked cage list and an entire rack. */
export function AnimalBatchOperationForm({ cages, racks, initialSelectedCageIds = [], asOfDate = localDateString(), busy = false, onSubmit }: AnimalBatchOperationFormProps) {
  const [scope, setScope] = useState<"CAGES" | "RACK">("CAGES");
  const [selectedCageIds, setSelectedCageIds] = useState<string[]>(() => initialSelectedCageIds.filter((id) => cages.some((cage) => cage.id === id)));
  const [selectedRackId, setSelectedRackId] = useState("");
  const [operation, setOperation] = useState(operationOptions[0]);
  const [customOperation, setCustomOperation] = useState("");
  const [occurredOn, setOccurredOn] = useState(asOfDate);
  const [operator, setOperator] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rackOptions = useMemo(() => {
    const fromCages = cages.reduce<AnimalRackOption[]>((all, cage) => (
      all.some((rack) => rack.id === cage.rackId) ? all : [...all, { id: cage.rackId, name: cage.rackName }]
    ), []);
    return racks?.length ? racks : fromCages;
  }, [cages, racks]);
  const targetCages = useMemo(() => (
    scope === "RACK" ? cages.filter((cage) => cage.rackId === selectedRackId) : cages.filter((cage) => selectedCageIds.includes(cage.id))
  ), [cages, scope, selectedCageIds, selectedRackId]);
  const visibleCages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? cages.filter((cage) => `${cage.rackName} ${cage.position}`.toLowerCase().includes(term)) : cages;
  }, [cages, query]);
  const selectedRack = rackOptions.find((rack) => rack.id === selectedRackId) ?? null;
  const targetSummary = scope === "RACK"
    ? `${selectedRack?.name ?? "未选择笼架"} · ${targetCages.length} 个笼位`
    : targetCages.length ? targetCages.map((cage) => cage.position).join("、") : "尚未选择笼位";

  function toggleCage(cageId: string) {
    setSelectedCageIds((current) => current.includes(cageId) ? current.filter((id) => id !== cageId) : [...current, cageId]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const operationName = operation === "其他" ? customOperation.trim() : operation;
    if (!operationName) {
      setError("请选择操作类型，或填写自定义操作名称。");
      return;
    }
    if (!normalizedDate(occurredOn) || dateIsAfter(occurredOn, asOfDate)) {
      setError("请选择今天或之前的操作日期。");
      return;
    }
    if (scope === "RACK" && !selectedRackId) {
      setError("请选择需要批量登记的笼架。");
      return;
    }
    if (!targetCages.length) {
      setError(scope === "RACK" ? "所选笼架暂无笼位。" : "请至少选择一个笼位。");
      return;
    }
    await onSubmit({
      operation: operationName,
      occurredOn,
      target: {
        scope,
        cageIds: targetCages.map((cage) => cage.id),
        cagePositions: targetCages.map((cage) => cage.position),
        rackId: scope === "RACK" ? selectedRackId : null,
        rackName: scope === "RACK" ? selectedRack?.name ?? null : null,
      },
      operator: cleanOptional(operator),
      note: cleanOptional(note),
    });
  }

  return (
    <form className={styles.batchForm} onSubmit={submit} noValidate>
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.eyebrow}>统一登记</p>
          <h2>批量录入操作</h2>
          <p>一条记录可以覆盖多个笼位，也可覆盖整个笼架。</p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>操作类型 <em>*</em></span>
          <select value={operation} onChange={(event) => setOperation(event.target.value)}>
            {operationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>操作日期 <em>*</em></span>
          <input type="date" value={occurredOn} max={asOfDate} onChange={(event) => setOccurredOn(event.target.value)} required />
          <small>使用日期菜单选择已完成操作的日期。</small>
        </label>
        {operation === "其他" ? (
          <label className={`${styles.field} ${styles.fullWidth}`}>
            <span>自定义操作 <em>*</em></span>
            <input value={customOperation} placeholder="例如 肿瘤体积测量" onChange={(event) => setCustomOperation(event.target.value)} required />
          </label>
        ) : null}
      </div>

      <fieldset className={styles.targetPanel}>
        <legend>作用范围</legend>
        <div className={styles.segmentedControl} aria-label="批量录入范围">
          <label className={scope === "CAGES" ? styles.segmentActive : ""}>
            <input type="radio" name="animal-operation-scope" value="CAGES" checked={scope === "CAGES"} onChange={() => setScope("CAGES")} />
            按笼位选择
          </label>
          <label className={scope === "RACK" ? styles.segmentActive : ""}>
            <input type="radio" name="animal-operation-scope" value="RACK" checked={scope === "RACK"} onChange={() => setScope("RACK")} />
            整个笼架
          </label>
        </div>

        {scope === "RACK" ? (
          <label className={styles.field}>
            <span>笼架 <em>*</em></span>
            <select value={selectedRackId} onChange={(event) => setSelectedRackId(event.target.value)}>
              <option value="">请选择笼架</option>
              {rackOptions.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
            </select>
          </label>
        ) : (
          <div className={styles.cagePicker}>
            <div className={styles.cagePickerHeader}>
              <label className={styles.searchField}>
                <span className="sr-only">筛选笼位</span>
                <input value={query} placeholder="按笼架或笼位筛选，例如 2 号架 A1" onChange={(event) => setQuery(event.target.value)} />
              </label>
              <button type="button" className="button-ghost" onClick={() => setSelectedCageIds(visibleCages.map((cage) => cage.id))} disabled={!visibleCages.length}>全选筛选结果</button>
              <button type="button" className="button-ghost" onClick={() => setSelectedCageIds([])} disabled={!selectedCageIds.length}>清空</button>
            </div>
            <div className={styles.cageOptionList} aria-label="选择笼位">
              {visibleCages.map((cage) => {
                const checked = selectedCageIds.includes(cage.id);
                return (
                  <label className={`${styles.cageOption} ${checked ? styles.cageOptionChecked : ""}`} key={cage.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCage(cage.id)} />
                    <span><strong>{cage.position}</strong><small>{cage.rackName}{typeof cage.mouseCount === "number" ? ` · ${cage.mouseCount} 只` : ""}</small></span>
                  </label>
                );
              })}
              {!visibleCages.length ? <p className={styles.emptyPicker}>没有匹配的笼位。</p> : null}
            </div>
          </div>
        )}
        <p className={styles.targetSummary}><span>将记录至</span><strong>{targetSummary}</strong></p>
      </fieldset>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>操作人员</span>
          <input value={operator} placeholder="例如 张三" onChange={(event) => setOperator(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>备注</span>
          <input value={note} placeholder="例如 剂量、采样编号或异常说明" onChange={(event) => setNote(event.target.value)} />
        </label>
      </div>
      {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
      <div className={styles.formActions}>
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "登记中…" : `登记至 ${targetCages.length} 个笼位`}</button>
      </div>
    </form>
  );
}

export type AnimalBatchAdmissionRecord = {
  countPerCage: number;
  movedAt: string;
  note?: string | null;
  target: AnimalOperationRecord["target"];
};

export type AnimalBatchAdmissionFormProps = Omit<AnimalBatchOperationFormProps, "onSubmit"> & {
  onSubmit: (record: AnimalBatchAdmissionRecord) => void | Promise<void>;
};

/** Batch admission keeps cage-card metadata intact and only appends residents to the selected cards. */
export function AnimalBatchAdmissionForm({ cages, racks, initialSelectedCageIds = [], asOfDate = localDateString(), busy = false, onSubmit }: AnimalBatchAdmissionFormProps) {
  const [scope, setScope] = useState<"CAGES" | "RACK">("CAGES");
  const [selectedCageIds, setSelectedCageIds] = useState<string[]>(() => initialSelectedCageIds.filter((id) => cages.some((cage) => cage.id === id)));
  const [selectedRackId, setSelectedRackId] = useState("");
  const [countPerCage, setCountPerCage] = useState("1");
  const [movedAt, setMovedAt] = useState(asOfDate);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rackOptions = useMemo(() => {
    const fromCages = cages.reduce<AnimalRackOption[]>((all, cage) => (
      all.some((rack) => rack.id === cage.rackId) ? all : [...all, { id: cage.rackId, name: cage.rackName }]
    ), []);
    return racks?.length ? racks : fromCages;
  }, [cages, racks]);
  const targetCages = useMemo(() => (
    scope === "RACK" ? cages.filter((cage) => cage.rackId === selectedRackId) : cages.filter((cage) => selectedCageIds.includes(cage.id))
  ), [cages, scope, selectedCageIds, selectedRackId]);
  const visibleCages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? cages.filter((cage) => `${cage.rackName} ${cage.position}`.toLowerCase().includes(term)) : cages;
  }, [cages, query]);
  const selectedRack = rackOptions.find((rack) => rack.id === selectedRackId) ?? null;
  const parsedCount = Number(countPerCage);
  const totalCount = Number.isInteger(parsedCount) && parsedCount > 0 ? targetCages.length * parsedCount : 0;
  const targetSummary = scope === "RACK"
    ? `${selectedRack?.name ?? "未选择笼架"} · ${targetCages.length} 个笼牌`
    : targetCages.length ? targetCages.map((cage) => cage.position).join("、") : "尚未选择笼牌";

  function toggleCage(cageId: string) {
    setSelectedCageIds((current) => current.includes(cageId) ? current.filter((id) => id !== cageId) : [...current, cageId]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 500) {
      setError("每个笼牌的入驻数量须为 1–500 只。");
      return;
    }
    if (!normalizedDate(movedAt) || dateIsAfter(movedAt, asOfDate)) {
      setError("请选择今天或之前的入驻日期。");
      return;
    }
    if (scope === "RACK" && !selectedRackId) {
      setError("请选择需要批量入驻的笼架。");
      return;
    }
    if (!targetCages.length) {
      setError(scope === "RACK" ? "所选笼架暂无可入驻的笼牌。" : "请至少选择一个已有笼牌的笼位。");
      return;
    }
    await onSubmit({
      countPerCage: parsedCount,
      movedAt,
      note: cleanOptional(note),
      target: {
        scope,
        cageIds: targetCages.map((cage) => cage.id),
        cagePositions: targetCages.map((cage) => cage.position),
        rackId: scope === "RACK" ? selectedRackId : null,
        rackName: scope === "RACK" ? selectedRack?.name ?? null : null,
      },
    });
  }

  return (
    <form className={styles.batchForm} onSubmit={submit} noValidate>
      <div className={styles.editorHeading}>
        <div>
          <p className={styles.eyebrow}>小鼠动态</p>
          <h2>批量入驻</h2>
          <p>会在每个目标笼牌中新增相同数量的小鼠，并同步生成可追溯的入驻记录。</p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>每个笼牌入驻数量 <em>*</em></span>
          <input type="number" min="1" max="500" inputMode="numeric" value={countPerCage} onChange={(event) => setCountPerCage(event.target.value)} required />
          <small>将新增共 {totalCount} 只小鼠。</small>
        </label>
        <label className={styles.field}>
          <span>入驻日期 <em>*</em></span>
          <input type="date" value={movedAt} max={asOfDate} onChange={(event) => setMovedAt(event.target.value)} required />
          <small>使用日期菜单选择小鼠实际入驻日期。</small>
        </label>
      </div>

      <fieldset className={styles.targetPanel}>
        <legend>入驻范围</legend>
        <div className={styles.segmentedControl} aria-label="批量入驻范围">
          <label className={scope === "CAGES" ? styles.segmentActive : ""}>
            <input type="radio" name="animal-admission-scope" value="CAGES" checked={scope === "CAGES"} onChange={() => setScope("CAGES")} />
            按笼位选择
          </label>
          <label className={scope === "RACK" ? styles.segmentActive : ""}>
            <input type="radio" name="animal-admission-scope" value="RACK" checked={scope === "RACK"} onChange={() => setScope("RACK")} />
            整个笼架
          </label>
        </div>

        {scope === "RACK" ? (
          <label className={styles.field}>
            <span>笼架 <em>*</em></span>
            <select value={selectedRackId} onChange={(event) => setSelectedRackId(event.target.value)}>
              <option value="">请选择笼架</option>
              {rackOptions.map((rack) => <option key={rack.id} value={rack.id}>{rack.name}</option>)}
            </select>
          </label>
        ) : (
          <div className={styles.cagePicker}>
            <div className={styles.cagePickerHeader}>
              <label className={styles.searchField}>
                <span className="sr-only">筛选笼牌</span>
                <input value={query} placeholder="按笼架或笼位筛选，例如 2 号架 A1" onChange={(event) => setQuery(event.target.value)} />
              </label>
              <button type="button" className="button-ghost" onClick={() => setSelectedCageIds(visibleCages.map((cage) => cage.id))} disabled={!visibleCages.length}>全选筛选结果</button>
              <button type="button" className="button-ghost" onClick={() => setSelectedCageIds([])} disabled={!selectedCageIds.length}>清空</button>
            </div>
            <div className={styles.cageOptionList} aria-label="选择入驻笼牌">
              {visibleCages.map((cage) => {
                const checked = selectedCageIds.includes(cage.id);
                return (
                  <label className={`${styles.cageOption} ${checked ? styles.cageOptionChecked : ""}`} key={cage.id}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCage(cage.id)} />
                    <span><strong>{cage.position}</strong><small>{cage.rackName}{typeof cage.mouseCount === "number" ? ` · 当前 ${cage.mouseCount} 只` : ""}</small></span>
                  </label>
                );
              })}
              {!visibleCages.length ? <p className={styles.emptyPicker}>还没有可入驻的笼牌；请先在空笼位创建笼牌。</p> : null}
            </div>
          </div>
        )}
        <p className={styles.targetSummary}><span>将入驻至</span><strong>{targetSummary}</strong></p>
      </fieldset>

      <label className={`${styles.field} ${styles.fullWidth}`}>
        <span>备注</span>
        <input value={note} placeholder="例如 批次编号、来源或运输情况" onChange={(event) => setNote(event.target.value)} />
      </label>
      {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
      <div className={styles.formActions}>
        <button className="button-primary" type="submit" disabled={busy}>{busy ? "入驻中…" : `确认入驻 ${totalCount} 只`}</button>
      </div>
    </form>
  );
}

export function AnimalOperationTimeline({ records, emptyText = "还没有操作记录。" }: { records: AnimalOperationRecord[]; emptyText?: string }) {
  const orderedRecords = useMemo(() => [...records].sort((left, right) => right.occurredOn.localeCompare(left.occurredOn)), [records]);
  if (!orderedRecords.length) return <p className={styles.emptyTimeline}>{emptyText}</p>;

  return (
    <ol className={styles.timeline} aria-label="小鼠操作记录">
      {orderedRecords.map((record, index) => (
        <li key={record.id ?? `${record.occurredOn}-${record.operation}-${index}`}>
          <div className={styles.timelineMarker} aria-hidden="true" />
          <div className={styles.timelineCard}>
            <div className={styles.timelineHeader}>
              <div>
                <time dateTime={record.occurredOn}>{displayDate(record.occurredOn)}</time>
                <h3>{record.operation}</h3>
              </div>
              {record.operator ? <span className={styles.operatorChip}>{record.operator}</span> : null}
            </div>
            <p className={styles.timelineTarget}>
              {record.target.scope === "RACK" && record.target.rackName ? `${record.target.rackName} · ` : ""}
              {record.target.cagePositions.join("、") || "未标注笼位"}
            </p>
            {record.note ? <p className={styles.timelineNote}>{record.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
