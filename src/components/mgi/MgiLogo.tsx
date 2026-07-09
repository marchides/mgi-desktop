import zaiLogo from "@/assets/zai-logo.png.asset.json";

interface Props {
  size?: number;
  className?: string;
  /** Solid tinted tile (accent bg + white mark) vs bare mark on transparent. */
  variant?: "tile" | "mark";
}

/**
 * MGI brand mark based on the Z.ai logomark.
 * - "tile"  : accent-filled rounded square with the Z rendered in white via CSS mask.
 * - "mark"  : just the Z, tinted with the current accent color.
 */
export function MgiLogo({ size = 56, className, variant = "tile" }: Props) {
  if (variant === "mark") {
    return (
      <span
        role="img"
        aria-label="MGI logo"
        className={className}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          backgroundColor: "oklch(var(--accent-oklch))",
          WebkitMaskImage: `url(${zaiLogo.url})`,
          maskImage: `url(${zaiLogo.url})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    );
  }

  const inner = Math.round(size * 0.72);
  return (
    <span
      role="img"
      aria-label="MGI logo"
      className={className}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        background:
          "linear-gradient(135deg, oklch(var(--accent-oklch)), oklch(var(--accent-oklch) / 0.7))",
        boxShadow:
          "0 1px 2px rgb(0 0 0 / 0.15), inset 0 1px 0 oklch(var(--on-accent-oklch) / 0.15)",
      }}
    >
      <span
        style={{
          width: inner,
          height: inner,
          backgroundColor: "oklch(var(--on-accent-oklch))",
          WebkitMaskImage: `url(${zaiLogo.url})`,
          maskImage: `url(${zaiLogo.url})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </span>
  );
}
