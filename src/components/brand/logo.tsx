import Image from "next/image";

type BrandLogoProps = {
  mode?: "full" | "icon";
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  mode = "full",
  className = "",
  imageClassName = "",
  priority = false,
}: BrandLogoProps) {
  const iconOnly = mode === "icon";
  const iconSizeClass = imageClassName || "h-10 w-10";
  const iconWidthClass = /(?:^|\s)w-/.test(iconSizeClass) ? "" : "w-10";

  return (
    <div className={`brand-logo flex min-w-0 items-center ${className}`.trim()}>
      {iconOnly ? (
        <span className={`brand-logo-icon block shrink-0 overflow-hidden ${iconSizeClass} ${iconWidthClass}`.trim()}>
          <Image
            src="/logo.png"
            alt="Dorlabaemon"
            width={859}
            height={263}
            className="h-full w-auto max-w-none object-contain object-left"
            priority={priority}
          />
        </span>
      ) : (
        <span
          className={`brand-logo-full relative block w-44 shrink-0 overflow-hidden ${imageClassName}`.trim()}
          style={{ aspectRatio: "820 / 197" }}
        >
          <Image
            src="/logo.png"
            alt="Dorlabaemon"
            width={859}
            height={263}
            className="absolute h-auto max-w-none"
            style={{ left: "-3.05%", top: "-19.29%", width: "104.76%" }}
            priority={priority}
          />
        </span>
      )}
    </div>
  );
}
