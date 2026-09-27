import React from "react";

/** Standalone formatter, also used by <Amount>. */
export function formatNumber(value, { decimals = 8, compact = false, locale = "en-US" } = {}) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  if (compact && Math.abs(n) >= 10000) {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(n);
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Amount — token amounts / balances / fees.
 * Mono + tabular-nums; dims insignificant trailing zeros so decimals align.
 * The data is the hero — always use this for on-chain numbers, never raw text.
 */
export function Amount({
  value,
  decimals = 8,
  symbol,
  fiat,
  compact = false,
  locale = "en-US",
  dimTrailingZeros = true,
  className = "",
  ...props
}) {
  const n = typeof value === "string" ? Number(value) : value;
  let significant = String(value);
  let zeros = "";

  if (Number.isFinite(n)) {
    if (compact && Math.abs(n) >= 10000) {
      significant = formatNumber(n, { compact: true, locale });
    } else {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(n);
      if (!dimTrailingZeros || !formatted.includes(".")) {
        significant = formatted;
      } else {
        const match = formatted.match(/^(.*?)(0+)$/);
        if (!match) {
          significant = formatted;
        } else if (match[1].endsWith(".")) {
          const dot = formatted.indexOf(".");
          significant = formatted.slice(0, dot);
          zeros = formatted.slice(dot);
        } else {
          significant = match[1];
          zeros = match[2];
        }
      }
    }
  }

  return (
    <span className={className} style={{ display: "inline-flex", flexDirection: "column" }} {...props}>
      <span className="font-mono tabular-nums">
        <span>{significant}</span>
        {zeros && <span style={{ color: "color-mix(in oklab, var(--muted-foreground) 60%, transparent)" }}>{zeros}</span>}
        {symbol && <span style={{ marginLeft: 4, color: "var(--muted-foreground)" }}>{symbol}</span>}
      </span>
      {fiat && (
        <span className="font-mono tabular-nums" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{fiat}</span>
      )}
    </span>
  );
}
