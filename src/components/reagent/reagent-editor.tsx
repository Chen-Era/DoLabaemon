"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon } from "@/components/common/app-icons";
import { requestJson } from "@/lib/http";
import { reagentCategoryLabel } from "@/lib/reagent-category";
import { reagentCategoryValues } from "@/lib/reagent-ingest/types";
import { experimentTags } from "@/lib/rules/catalog";

export type ReagentEditorInitial = {
  id: string;
  name: string;
  catalogNo: string;
  category: string;
  subCategory?: string | null;
  vendor?: string | null;
  note?: string | null;
  storageCondition?: string | null;
  unit?: string | null;
  quantity?: number | null;
  arrivalDate?: string | null;
  expiryDate?: string | null;
  experimentTags?: string[];
  antibodyMeta?: {
    role?: string | null;
    hostSpecies?: string | null;
    targetSpecies?: string | null;
    targetName?: string | null;
  } | null;
  primerMeta?: {
    targetName?: string | null;
    isReferenceGene?: boolean | null;
  } | null;
};

type ReagentEditorProps = {
  labId: string;
  mode: "create" | "edit";
  initial?: ReagentEditorInitial | null;
  onClose: () => void;
  onSaved: () => void;
};

type EditorValues = {
  name: string;
  catalogNo: string;
  category: string;
  subCategory: string;
  vendor: string;
  note: string;
  storageCondition: string;
  unit: string;
  quantity: string;
  arrivalDate: string;
  expiryDate: string;
  tags: Record<string, boolean>;
  antibodyRole: string;
  antibodyTargetName: string;
  antibodyHostSpecies: string;
  antibodyTargetSpecies: string;
  primerTargetName: string;
  primerIsReferenceGene: boolean;
};

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function emptyValues(): EditorValues {
  return {
    name: "",
    catalogNo: "",
    category: "OTHER",
    subCategory: "",
    vendor: "",
    note: "",
    storageCondition: "",
    unit: "",
    quantity: "",
    arrivalDate: "",
    expiryDate: "",
    tags: {},
    antibodyRole: "",
    antibodyTargetName: "",
    antibodyHostSpecies: "",
    antibodyTargetSpecies: "",
    primerTargetName: "",
    primerIsReferenceGene: false,
  };
}

function valuesFromInitial(initial: ReagentEditorInitial): EditorValues {
  const base = emptyValues();
  return {
    ...base,
    name: initial.name ?? "",
    catalogNo: initial.catalogNo ?? "",
    category: initial.category || "OTHER",
    subCategory: initial.subCategory ?? "",
    vendor: initial.vendor ?? "",
    note: initial.note ?? "",
    storageCondition: initial.storageCondition ?? "",
    unit: initial.unit ?? "",
    quantity: typeof initial.quantity === "number" ? String(initial.quantity) : "",
    arrivalDate: toDateInput(initial.arrivalDate),
    expiryDate: toDateInput(initial.expiryDate),
    tags: Object.fromEntries((initial.experimentTags ?? []).map((tag) => [tag, true])),
    antibodyRole: initial.antibodyMeta?.role ?? "",
    antibodyTargetName: initial.antibodyMeta?.targetName ?? "",
    antibodyHostSpecies: initial.antibodyMeta?.hostSpecies ?? "",
    antibodyTargetSpecies: initial.antibodyMeta?.targetSpecies ?? "",
    primerTargetName: initial.primerMeta?.targetName ?? "",
    primerIsReferenceGene: initial.primerMeta?.isReferenceGene ?? false,
  };
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function ReagentEditor({ labId, mode, initial, onClose, onSaved }: ReagentEditorProps) {
  const [values, setValues] = useState<EditorValues>(() =>
    mode === "edit" && initial ? valuesFromInitial(initial) : emptyValues(),
  );
  const [tagFilter, setTagFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function setField<K extends keyof EditorValues>(key: K, value: EditorValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const visibleTags = useMemo(() => {
    const lowered = tagFilter.trim().toLowerCase();
    if (!lowered) return experimentTags;
    return experimentTags.filter((tag) => tag.toLowerCase().includes(lowered));
  }, [tagFilter]);

  const selectedTagCount = useMemo(() => Object.values(values.tags).filter(Boolean).length, [values.tags]);

  function buildPayload() {
    const quantityText = values.quantity.trim();
    const quantity = quantityText ? Number(quantityText) : null;
    const tags = Object.entries(values.tags)
      .filter(([, checked]) => checked)
      .map(([tag]) => tag);
    const antibodyMeta =
      values.category === "ANTIBODY" && values.antibodyRole
        ? {
            role: values.antibodyRole,
            targetName: nullableText(values.antibodyTargetName),
            hostSpecies: nullableText(values.antibodyHostSpecies),
            targetSpecies: nullableText(values.antibodyTargetSpecies),
          }
        : null;
    const primerMeta =
      values.category === "PRIMER" && (values.primerTargetName.trim() || values.primerIsReferenceGene)
        ? {
            targetName: nullableText(values.primerTargetName),
            isReferenceGene: values.primerIsReferenceGene,
          }
        : null;
    return {
      name: values.name.trim(),
      catalogNo: values.catalogNo.trim(),
      category: values.category,
      subCategory: nullableText(values.subCategory),
      vendor: nullableText(values.vendor),
      note: nullableText(values.note),
      storageCondition: nullableText(values.storageCondition),
      unit: nullableText(values.unit),
      quantity,
      arrivalDate: values.arrivalDate || null,
      expiryDate: values.expiryDate || null,
      experimentTags: tags,
      antibodyMeta,
      primerMeta,
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const payload = buildPayload();
    if (!payload.name || !payload.catalogNo) {
      setError("请填写试剂名称与货号。");
      return;
    }
    if (payload.quantity !== null && (!Number.isFinite(payload.quantity) || payload.quantity < 0)) {
      setError("数量需要是不小于 0 的数字。");
      return;
    }
    setSaving(true);
    try {
      const isEdit = mode === "edit" && initial;
      const { response, data } = await requestJson<{ error?: string; code?: string }>(
        isEdit ? `/api/reagents/${encodeURIComponent(initial.id)}` : "/api/reagents/create",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? payload : { ...payload, labId }),
        },
      );
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (response.status === 409 || data?.code === "CATALOG_NO_EXISTS") {
        setError("该货号在当前实验室已存在，可直接编辑原有记录。");
        return;
      }
      if (!response.ok) {
        setError(data?.error ?? (isEdit ? "保存失败，请稍后重试。" : "新建失败，请稍后重试。"));
        return;
      }
      onSaved();
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "edit" ? "编辑试剂" : "新建试剂";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="关闭"
        className="fixed inset-0 cursor-default bg-slate-900/45"
        onClick={saving ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative my-auto w-full max-w-3xl rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {mode === "edit" ? "修改库存信息，保存后立即生效。" : "手动录入一条库存记录，带 * 为必填项。"}
            </p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} disabled={saving} aria-label="关闭">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="editor-name">
                试剂名称 *
              </label>
              <input
                id="editor-name"
                ref={nameInputRef}
                className="input-base"
                value={values.name}
                onChange={(e) => setField("name", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="editor-catalog">
                货号 *
              </label>
              <input
                id="editor-catalog"
                className="input-base font-mono"
                value={values.catalogNo}
                onChange={(e) => setField("catalogNo", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label" htmlFor="editor-category">
                类别 *
              </label>
              <select
                id="editor-category"
                className="input-base"
                value={values.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                {reagentCategoryValues.map((category) => (
                  <option key={category} value={category}>
                    {reagentCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="editor-subcategory">
                子类
              </label>
              <input
                id="editor-subcategory"
                className="input-base"
                placeholder="例如：一抗、裂解液"
                value={values.subCategory}
                onChange={(e) => setField("subCategory", e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="editor-vendor">
                供应商
              </label>
              <input
                id="editor-vendor"
                className="input-base"
                value={values.vendor}
                onChange={(e) => setField("vendor", e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="editor-storage">
                储存条件
              </label>
              <input
                id="editor-storage"
                className="input-base"
                placeholder="例如：-20°C、4°C 避光"
                value={values.storageCondition}
                onChange={(e) => setField("storageCondition", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="editor-quantity">
                  库存数量
                </label>
                <input
                  id="editor-quantity"
                  type="number"
                  min="0"
                  step="any"
                  className="input-base"
                  placeholder="留空表示未记录"
                  value={values.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="editor-unit">
                  单位
                </label>
                <input
                  id="editor-unit"
                  className="input-base"
                  placeholder="支 / 瓶 / mL"
                  value={values.unit}
                  onChange={(e) => setField("unit", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="editor-arrival">
                  到货日期
                </label>
                <input
                  id="editor-arrival"
                  type="date"
                  className="input-base"
                  value={values.arrivalDate}
                  onChange={(e) => setField("arrivalDate", e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="editor-expiry">
                  有效期至
                </label>
                <input
                  id="editor-expiry"
                  type="date"
                  className="input-base"
                  value={values.expiryDate}
                  onChange={(e) => setField("expiryDate", e.target.value)}
                />
              </div>
            </div>
          </div>

          {values.category === "ANTIBODY" ? (
            <fieldset className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--bg-muted)] px-4 py-3">
              <legend className="px-1 text-xs font-semibold text-slate-600">抗体信息</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="editor-antibody-role">
                    抗体角色
                  </label>
                  <select
                    id="editor-antibody-role"
                    className="input-base"
                    value={values.antibodyRole}
                    onChange={(e) => setField("antibodyRole", e.target.value)}
                  >
                    <option value="">未标注</option>
                    <option value="PRIMARY">一抗</option>
                    <option value="SECONDARY">二抗</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="editor-antibody-target">
                    靶点名称
                  </label>
                  <input
                    id="editor-antibody-target"
                    className="input-base"
                    placeholder="例如：LC3B"
                    value={values.antibodyTargetName}
                    onChange={(e) => setField("antibodyTargetName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="editor-antibody-host">
                    宿主种属
                  </label>
                  <input
                    id="editor-antibody-host"
                    className="input-base"
                    placeholder="例如：Rabbit"
                    value={values.antibodyHostSpecies}
                    onChange={(e) => setField("antibodyHostSpecies", e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="editor-antibody-species">
                    目标种属
                  </label>
                  <input
                    id="editor-antibody-species"
                    className="input-base"
                    placeholder="例如：Human, Mouse"
                    value={values.antibodyTargetSpecies}
                    onChange={(e) => setField("antibodyTargetSpecies", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          ) : null}

          {values.category === "PRIMER" ? (
            <fieldset className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--bg-muted)] px-4 py-3">
              <legend className="px-1 text-xs font-semibold text-slate-600">引物信息</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="editor-primer-target">
                    靶基因
                  </label>
                  <input
                    id="editor-primer-target"
                    className="input-base"
                    placeholder="例如：GAPDH"
                    value={values.primerTargetName}
                    onChange={(e) => setField("primerTargetName", e.target.value)}
                  />
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={values.primerIsReferenceGene}
                    onChange={(e) => setField("primerIsReferenceGene", e.target.checked)}
                  />
                  内参基因
                </label>
              </div>
            </fieldset>
          ) : null}

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <label className="field-label" htmlFor="editor-tag-filter">
                实验标签{selectedTagCount ? `（已选 ${selectedTagCount}）` : ""}
              </label>
            </div>
            <input
              id="editor-tag-filter"
              className="input-base"
              placeholder="输入关键词筛选标签"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />
            <div className="mt-2 grid max-h-36 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[var(--line)] px-3 py-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTags.map((tag) => (
                <label key={tag} className="flex items-center gap-2 py-0.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-blue-600"
                    checked={!!values.tags[tag]}
                    onChange={(e) => setField("tags", { ...values.tags, [tag]: e.target.checked })}
                  />
                  <span className="font-mono">{tag}</span>
                </label>
              ))}
              {!visibleTags.length ? <p className="py-1 text-xs text-slate-400">没有匹配的标签</p> : null}
            </div>
          </div>

          <div className="mt-4">
            <label className="field-label" htmlFor="editor-note">
              备注
            </label>
            <textarea
              id="editor-note"
              className="input-base min-h-20 resize-y"
              placeholder="用途、稀释比、批次等补充信息"
              value={values.note}
              onChange={(e) => setField("note", e.target.value)}
            />
          </div>

          {error ? <p className="danger-panel mt-4 px-3 py-2 text-sm">{error}</p> : null}

          <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4 pb-1">
            <button type="button" className="button-secondary" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "保存中..." : mode === "edit" ? "保存修改" : "确认新建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
