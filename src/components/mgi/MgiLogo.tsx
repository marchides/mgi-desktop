interface Props {
  size?: number;
  className?: string;
  /** Solid tinted tile vs bare mark. */
  variant?: "tile" | "mark";
  /**
   * For the `mark` variant only. Picks which artwork to render.
   * Defaults to `auto` which follows the current theme (white in dark, black in light).
   */
  tone?: "auto" | "black" | "white";
}

const blackZ = "/logo-z-black.png";
const whiteZ = "/logo-z-white.png";

/**
 * MGI brand mark — the Z glyph.
 *
 * `tile` renders the glyph inside the accent-tinted rounded tile, coloured via
 * CSS masking so the letter always uses the accent's on-accent tone (works for
 * light, dark, and metallic accents alike).
 *
 * `mark` renders the bare Z as a normal image (black on light, white in dark by default).
 */
export function MgiLogo({ size = 56, className, variant = "tile", tone = "auto" }: Props) {
  if (variant === "mark") {
    if (tone === "auto") {
      return (
        <span
          className={className}
          style={{ display: "inline-block", width: size, height: size, position: "relative" }}
          aria-label="MGI logo"
          role="img"
        >
          <img
            src={blackZ}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="dark:hidden"
            style={{ width: size, height: size, objectFit: "contain", display: "block" }}
          />
          <img
            src={whiteZ}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="hidden dark:block"
            style={{ width: size, height: size, objectFit: "contain", display: "block" }}
          />
        </span>
      );
    }
    return (
      <img
        src={tone === "white" ? whiteZ : blackZ}
        alt="MGI logo"
        className={className}
        draggable={false}
        style={{ display: "inline-block", width: size, height: size, objectFit: "contain" }}
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
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: inner,
          height: inner,
          backgroundColor: "oklch(var(--on-accent-oklch))",
          WebkitMaskImage: `url(${blackZ})`,
          maskImage: `url(${blackZ})`,
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
