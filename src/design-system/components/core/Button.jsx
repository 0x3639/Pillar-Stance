import React from "react";

/**
 * Button — the primary action primitive.
 * Default variant carries the signature plasma gradient; reserve it for the
 * main action. Renders as <a> when `href` is passed.
 */
export function Button({
  variant = "default",
  size = "default",
  href,
  className = "",
  children,
  ...props
}) {
  const variantClass = {
    default: "nom-btn--primary",
    primary: "nom-btn--primary",
    destructive: "nom-btn--destructive",
    outline: "nom-btn--outline",
    secondary: "nom-btn--secondary",
    ghost: "nom-btn--ghost",
    link: "nom-btn--link",
  }[variant] || "nom-btn--primary";

  const cls = `nom-btn nom-btn--${size} ${variantClass} ${className}`.trim();
  const Tag = href ? "a" : "button";
  return (
    <Tag className={cls} href={href} {...props}>
      {children}
    </Tag>
  );
}
