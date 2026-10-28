import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

import { label, toneFor, type Tone } from "@/lib/constants";

/*
 * Admin UI kit — design direction 1b ("utilitarian"): cool greys, hairline
 * panels, 4–6px radii, uppercase micro-labels and mono figures. Every colour is
 * a token from globals.css, so light and dark come for free.
 */

/* ---------------------------------------------------------------- surfaces */

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("min-w-0 rounded-[6px] border border-ln bg-pn", className)} {...props}>
      {children}
    </div>
  );
}

/** Panel heading: bold title, optional faint " · sub", optional action on the right. */
export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-l2 px-3.5 py-2.5 text-[13px]",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="font-semibold">{title}</span>
        {description ? <span className="text-fa"> · {description}</span> : null}
      </span>
      {action ? <div className="min-w-0 max-w-full">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  titleExtra,
  description,
  actions,
  breadcrumb,
  mono = false,
}: {
  title: ReactNode;
  /** Rendered inline after the title, e.g. a status pill. */
  titleExtra?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  /** Invoice numbers read best in the mono face. */
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 flex-[1_1_320px]">
        {breadcrumb ? <div className="text-[12.5px]">{breadcrumb}</div> : null}
        <div className={cn("flex items-center gap-2.5", breadcrumb && "mt-1")}>
          <h1
            className={cn(
              "m-0 text-[20px]",
              mono ? "font-mono font-medium" : "font-semibold",
            )}
          >
            {title}
          </h1>
          {titleExtra}
        </div>
        {description ? (
          <div className="mt-0.5 max-w-[640px] text-[13px] text-mu">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[13px]">{actions}</div>
      ) : null}
    </div>
  );
}

/** "Projects / Northwind" style trail; plain strings render faint. */
export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <>
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {index > 0 ? <span className="text-fa"> / </span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </>
  );
}

/** "← Clients" back link above a form or detail title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href}>← {children}</Link>;
}

/* ----------------------------------------------------------------- badges */

export function toneStyle(tone: Tone): { f: string; d: string; b: string } {
  return { f: `var(--${tone}-f)`, d: `var(--${tone}-d)`, b: `var(--${tone}-b)` };
}

/** Outlined status pill used across the admin app. */
export function Badge({
  value,
  text,
  className,
}: {
  value: string;
  /** Override the label (defaults to the humanised value). */
  text?: string;
  className?: string;
}) {
  const tone = toneStyle(toneFor(value));
  return (
    <span
      className={cn(
        "inline-block rounded-[3px] border px-1.5 py-px text-[11px] whitespace-nowrap",
        className,
      )}
      style={{ borderColor: tone.d, color: tone.f }}
    >
      {text ?? label(value)}
    </span>
  );
}

/** Filled pill (category labels, "Primary", "You"). */
export function Pill({
  tone,
  accent = false,
  className,
  children,
  title,
}: {
  tone?: Tone;
  /** Use the accent-soft fill instead of a status tone. */
  accent?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  const style: CSSProperties = accent
    ? { background: "var(--acs)", color: "var(--ac)" }
    : tone
      ? { background: toneStyle(tone).b, color: toneStyle(tone).f }
      : {};
  return (
    <span
      title={title}
      className={cn("inline-block rounded-[3px] px-1.5 text-[11px] whitespace-nowrap", className)}
      style={style}
    >
      {children}
    </span>
  );
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-[30px] shrink-0 place-items-center rounded-full bg-acs text-[11px] font-semibold text-ac",
        className,
      )}
      aria-hidden
    >
      {text}
    </span>
  );
}

/** Small square category marker used beside activity entries. */
export function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      className="mt-1.5 size-1.5 shrink-0 rounded-[1px]"
      style={{ background: toneStyle(tone).d }}
      aria-hidden
    />
  );
}

/* ---------------------------------------------------------------- buttons */

const buttonVariants = {
  primary: "border border-transparent bg-ac text-white hover:bg-ach hover:text-white",
  secondary: "border border-inpb bg-pn text-tx hover:bg-hov hover:text-tx",
  danger: "border border-[var(--rose-d)] bg-transparent text-red hover:bg-redbg hover:text-red",
  success:
    "border border-[var(--emerald-d)] bg-[var(--emerald-b)] text-[var(--emerald-f)] hover:text-[var(--emerald-f)]",
  /** Text-only, accent coloured — "Reset password", "Edit". */
  link: "border-0 bg-transparent p-0 text-ac hover:text-ach",
  /** Text-only, red — inline "Delete", "Remove". */
  linkDanger: "border-0 bg-transparent p-0 text-red hover:opacity-80",
} as const;

const buttonSizes = {
  sm: "rounded-[4px] px-2.5 py-[3px] text-[12px]",
  md: "rounded-[4px] px-3 py-1.5 text-[13px]",
  lg: "rounded-[4px] px-3.5 py-[7px] text-[13px]",
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  const textOnly = variant === "link" || variant === "linkDanger";
  return cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-[inherit] transition-colors disabled:opacity-60",
    buttonVariants[variant],
    textOnly ? "text-[12px]" : buttonSizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ------------------------------------------------------------------ forms */

/** `md` is a full-page form; `sm` is an inline panel inside a card. */
export type ControlSize = "sm" | "md";

const controlBase =
  "block w-full min-w-0 rounded-[4px] border border-inpb bg-inp text-tx disabled:opacity-60";

export function controlClass(size: ControlSize = "md", className?: string) {
  return cn(
    controlBase,
    size === "md" ? "px-2.5 py-[7px] text-[13.5px]" : "px-[9px] py-1.5 text-[13px]",
    className,
  );
}

export function Field({
  label: fieldLabel,
  htmlFor,
  hint,
  errors,
  required,
  size = "md",
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  size?: ControlSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col font-medium",
        size === "md" ? "gap-[5px] text-[12.5px]" : "gap-1 text-[12px]",
        className,
      )}
    >
      <label htmlFor={htmlFor}>
        {fieldLabel}
        {required ? " *" : null}
      </label>
      {children}
      {hint ? <span className="text-[12px] font-normal text-mu">{hint}</span> : null}
      {errors?.length ? (
        <span className="text-[12px] font-normal text-red" role="alert">
          {errors[0]}
        </span>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  size: controlSize = "md",
  ...props
}: Omit<ComponentProps<"input">, "size"> & { size?: ControlSize }) {
  return <input className={controlClass(controlSize, className)} {...props} />;
}

export function Textarea({
  className,
  size: controlSize = "md",
  ...props
}: ComponentProps<"textarea"> & { size?: ControlSize }) {
  return <textarea className={controlClass(controlSize, cn("resize-y", className))} {...props} />;
}

export function Select({
  className,
  size: controlSize = "md",
  children,
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: ControlSize }) {
  return (
    <select className={controlClass(controlSize, cn("pr-7", className))} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label: text, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="flex items-center gap-2 self-end pb-1.5 text-[12.5px]">
      <input type="checkbox" {...props} />
      {text}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-[4px] px-3 py-[9px] text-[13px]"
      style={{ background: "var(--rose-b)", color: "var(--rose-f)" }}
    >
      {message}
    </div>
  );
}

export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="status" className="text-[12.5px] text-grn">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------ grid tables */

/**
 * The design lays lists out as CSS grids rather than <table>s, so a whole row
 * can be one link. `cols` is a grid-template-columns string shared by the head
 * and every row; `minWidth` keeps columns readable and scrolls on small screens.
 */
export function GridTable({ minWidth, children }: { minWidth: number; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

export function GridHead({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <div
      className="grid gap-3 border-b border-ln px-3.5 py-2 text-[11px] tracking-[.05em] text-mu uppercase"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

const rowClass =
  "grid items-center gap-3 border-b border-l2 px-3.5 py-[9px] text-[13px] text-tx last:border-b-0";

export function GridRow({
  cols,
  href,
  className,
  children,
}: {
  cols: string;
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  const style = { gridTemplateColumns: cols };
  if (href) {
    return (
      <Link href={href} className={cn(rowClass, "hover:bg-hov hover:text-tx", className)} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <div className={cn(rowClass, className)} style={style}>
      {children}
    </div>
  );
}

/** Two-line cell: bold-ish primary text with a faint line below. */
export function Stack({
  primary,
  secondary,
  primaryClassName,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  primaryClassName?: string;
}) {
  return (
    <span className="min-w-0">
      <span className={cn("block truncate", primaryClassName ?? "font-medium")}>{primary}</span>
      {secondary ? <span className="block truncate text-[11.5px] text-fa">{secondary}</span> : null}
    </span>
  );
}

/** A plain list row inside a panel (activity, contacts, notes…). */
export function PanelRow({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("border-b border-l2 px-3.5 py-[9px] last:border-b-0", className)} {...props}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- stats tiles */

/** Joined tile strip: 2 columns on phones, 4 from 720px. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[6px] border border-ln bg-pn min-[720px]:grid-cols-4">
      {children}
    </div>
  );
}

export function StatTile({
  label: tileLabel,
  value,
  sub,
  href,
  warn = false,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  /** Red value and tinted fill — e.g. overdue invoices. */
  warn?: boolean;
  valueClassName?: string;
}) {
  const body = (
    <>
      <span className="text-[11px] tracking-[.06em] text-mu uppercase">{tileLabel}</span>
      <span
        className={cn(
          "font-mono text-[22px] font-medium min-[720px]:text-[24px]",
          warn ? "text-red" : "text-tx",
          valueClassName,
        )}
      >
        {value}
      </span>
      {sub ? <span className={cn("text-[12px]", warn ? "text-red" : "text-fa")}>{sub}</span> : null}
    </>
  );
  const className = cn(
    "-mr-px -mb-px flex flex-col gap-1 border-r border-b border-l2 px-4 py-3.5 text-tx",
    warn && "bg-redbg",
  );
  return href ? (
    <Link href={href} className={cn(className, "hover:text-tx")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Stand-alone money card (client page). */
export function MoneyCard({
  label: cardLabel,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[6px] border border-ln bg-pn px-3.5 py-3">
      <div className="text-[11px] tracking-[.06em] text-mu uppercase">{cardLabel}</div>
      <div className={cn("mt-1 font-mono text-[20px] font-medium", valueClassName)}>{value}</div>
    </div>
  );
}

/* --------------------------------------------------------- empty / misc */

/** Dashed placeholder used when a whole list is empty. */
export function EmptyBox({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 rounded-[6px] border border-dashed border-inpb bg-pn px-4 py-11 text-center",
        className,
      )}
    >
      <span className="text-[14px] font-medium">{title}</span>
      {description ? <span className="max-w-[380px] text-[13px] text-mu">{description}</span> : null}
      {action}
    </div>
  );
}

/** Muted one-liner inside a panel when its list is empty. */
export function EmptyRow({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={cn("px-3.5 py-[18px] text-[13px] text-mu", center && "py-7 text-center")}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- key/value */

export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("m-0 flex flex-col px-3.5 pt-1.5 pb-3", className)}>{children}</dl>;
}

export function DetailRow({
  term,
  termWidth = 96,
  children,
}: {
  term: string;
  termWidth?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="grid gap-2.5 border-b border-l2 py-1.5 text-[12.5px]"
      style={{ gridTemplateColumns: `${termWidth}px minmax(0,1fr)` }}
    >
      <dt className="text-mu">{term}</dt>
      <dd className="m-0 break-words">{children}</dd>
    </div>
  );
}

/** Thin progress bar. Width is clamped to 0–100. */
export function ProgressBar({
  percent,
  color = "var(--ac)",
  height = 6,
}: {
  percent: number;
  color?: string;
  height?: number;
}) {
  return (
    <div className="flex-1 rounded-full bg-l2" style={{ height }}>
      <div
        className="rounded-full"
        style={{ height, width: `${Math.max(0, Math.min(100, percent))}%`, background: color }}
      />
    </div>
  );
}

/** Small uppercase section label inside a document (Bill to, Notes…). */
export function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] tracking-[.06em] text-mu uppercase", className)}>{children}</div>
  );
}

/* ------------------------------------------------------------ form panel */

/**
 * Class for a full-page form panel: one bordered card, 18px padding, a
 * two-column grid from 720px (three with `cols={3}`). Use `col-span-full` on
 * wide fields.
 */
export function formPanelClass(cols: 2 | 3 = 2, className?: string) {
  return cn(
    "grid grid-cols-1 gap-3.5 rounded-[6px] border border-ln bg-pn p-[18px]",
    cols === 3 ? "min-[720px]:grid-cols-3" : "min-[720px]:grid-cols-2",
    className,
  );
}

/** Save + Cancel row at the foot of a form panel. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="col-span-full flex flex-wrap gap-2">{children}</div>;
}
