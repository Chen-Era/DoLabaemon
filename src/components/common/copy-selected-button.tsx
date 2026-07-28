"use client";

import { useState } from "react";
import { reagentCategoryLabel } from "@/lib/reagent-category";

export function CopySelectedButton({
  rows,
}: {
  rows: Array<{
    name: string;
    catalogNo: string;
    category: string;
    uploadedByName?: string | null;
    uploadedAt?: string | null;
  }>;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!rows.length) return;
    const header = "name\tcatalogNo\tcategory\tuploader\tuploadedAt";
    const body = rows
      .map((x) =>
        [x.name, x.catalogNo, reagentCategoryLabel(x.category), x.uploadedByName || "上传者未知", x.uploadedAt || "时间未知"].join("\t"),
      )
      .join("\n");
    await navigator.clipboard.writeText(`${header}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button type="button" onClick={onCopy} className="button-secondary" disabled={!rows.length}>
      {copied ? "已复制" : `复制所选${rows.length ? `（${rows.length}）` : ""}`}
    </button>
  );
}
