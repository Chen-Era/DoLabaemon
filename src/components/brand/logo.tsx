"use client";

import Image from "next/image";

type BrandLogoProps = {
  mode?: "full" | "icon";
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  imageClassName?: string;
};

export function BrandLogo({
  mode = "full",
  className = "",
  titleClassName = "",
  subtitleClassName = "",
  imageClassName = "",
}: BrandLogoProps) {
  const iconOnly = mode === "icon";

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <Image
        src="/logo.png"
        alt="Dorlabaemon logo"
        width={860}
        height={263}
        className={`h-11 w-auto shrink-0 object-contain ${imageClassName}`.trim()}
        priority
      />
      {iconOnly ? null : (
        <div className="min-w-0">
          <p className={`text-base font-semibold tracking-[0.08em] text-slate-900 ${titleClassName}`.trim()}>
            Dorlabaemon
          </p>
          <p className={`text-xs text-slate-500 ${subtitleClassName}`.trim()}>试剂管理系统</p>
        </div>
      )}
    </div>
  );
}
