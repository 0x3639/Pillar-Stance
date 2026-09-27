import React from "react";

/**
 * Badge — generic chip. Status variants (success/warning/pending) are soft
 * tints so they read as state, not action. `highlight` is the reserved brand
 * pink for "new"/featured — use sparingly.
 */
export function Badge({ variant = "default", className = "", children, ...props }) {
  const cls = `nom-badge nom-badge--${variant} ${className}`.trim();
  return (
    <span className={cls} {...props}>
      {children}
    </span>
  );
}
