import React from "react";

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/**
 * Address — addresses & hashes. Truncates to start…end, mono, full value on
 * hover (title), inline copy, optional explorer link (hovers blue).
 */
export function Address({
  address,
  start = 6,
  end = 4,
  truncate = true,
  copy = true,
  href,
  className = "",
  ...props
}) {
  const [copied, setCopied] = React.useState(false);
  const display =
    truncate && address.length > start + end + 1
      ? `${address.slice(0, start)}…${address.slice(-end)}`
      : address;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { setCopied(false); }
  };

  const Value = href ? "a" : "span";
  const valueProps = href ? { href, target: "_blank", rel: "noreferrer" } : {};

  return (
    <span className={`nom-address ${className}`.trim()} {...props}>
      <Value title={address} {...valueProps}>{display}</Value>
      {copy && (
        <button type="button" className="nom-iconbtn" aria-label={copied ? "Copied" : "Copy address"} onClick={onCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      )}
    </span>
  );
}
