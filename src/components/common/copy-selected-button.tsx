"use client";

import { useState } from "react";

export function CopySelectedButton({ rows }: { rows: Array<{ name: string; catalogNo: string; category: string }> }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!rows.length) return;
    const header = "name\tcatalogNo\tcategory";
    const body = rows.map((x) => `${x.name}\t${x.catalogNo}\t${x.category}`).join("\n");
    await navigator.clipboard.writeText(`${header}\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button type="button" onClick={onCopy} className="button-secondary" disabled={!rows.length}>
      {copied ? "Copied" : `Copy Selected${rows.length ? ` (${rows.length})` : ""}`}
    </button>
  );
}
