interface Props {
  size?: number;
  className?: string;
  /** Solid tinted tile vs bare bundled logo. */
  variant?: "tile" | "mark";
}

const logoUrl = "/icon.png";

/**
 * MGI brand mark.
 *
 * Uses the bundled public/icon.png instead of Lovable's generated asset URL so
 * the logo works in the static web build and inside the Tauri desktop bundle.
 */
export function MgiLogo({ size = 56, className, variant = "tile" }: Props) {
  if (variant === "mark") {
    return (
      <img
        src={logoUrl}
        alt="MGI logo"
        className={className}
        draggable={false}
        style={{
          display: "inline-block",
          width: size,
          height: size,
          objectFit: "contain",
        }}
      />
    );
  }

  const inner = Math.round(size * 0.78);
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
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          width: inner,
          height: inner,
          objectFit: "contain",
          display: "block",
        }}
      />
    </span>
  );
}
