"use client";

import Image from "next/image";

type BrandLogoProps = {
  mode?: "full" | "icon";
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export function BrandLogo({
  mode = "full",
  className = "",
  titleClassName = "",
  subtitleClassName = "",
}: BrandLogoProps) {
  const iconOnly = mode === "icon";

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <Image src="/logo-dorlabaemon.svg" alt="Dorlabaemon logo" width={44} height={44} className="h-11 w-11 shrink-0" priority />
      {iconOnly ? null : (
        <div className="min-w-0">
          <p className={`text-base font-semibold tracking-[0.18em] text-white uppercase ${titleClassName}`.trim()}>
            Dorlabaemon
          </p>
          <p className={`text-xs text-zinc-400 ${subtitleClassName}`.trim()}>哆LabA梦</p>
        </div>
      )}
    </div>
  );
}
