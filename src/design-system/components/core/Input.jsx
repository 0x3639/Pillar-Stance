import React from "react";

/** Input — text/numeric field. Pass `numeric` for mono tabular figures + decimal keypad. */
export function Input({ numeric = false, className = "", ...props }) {
  return (
    <input
      className={`nom-input ${className}`.trim()}
      data-numeric={numeric ? "" : undefined}
      inputMode={numeric ? "decimal" : undefined}
      {...props}
    />
  );
}
