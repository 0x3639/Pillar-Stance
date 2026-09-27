import React from "react";

/** Card — the base surface. Tight radius, theme-aware elevation. */
export function Card({ className = "", children, ...props }) {
  return <div className={`nom-card ${className}`.trim()} {...props}>{children}</div>;
}

export function CardHeader({ className = "", children, ...props }) {
  return <div className={`nom-card__header ${className}`.trim()} {...props}>{children}</div>;
}

export function CardTitle({ className = "", children, ...props }) {
  return <h3 className={`nom-card__title ${className}`.trim()} {...props}>{children}</h3>;
}

export function CardDescription({ className = "", children, ...props }) {
  return <p className={`nom-card__desc ${className}`.trim()} {...props}>{children}</p>;
}

export function CardContent({ className = "", children, ...props }) {
  return <div className={`nom-card__content ${className}`.trim()} {...props}>{children}</div>;
}

export function CardFooter({ className = "", children, ...props }) {
  return <div className={`nom-card__footer ${className}`.trim()} {...props}>{children}</div>;
}
