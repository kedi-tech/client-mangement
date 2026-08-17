import clsx from "clsx";

/** Accessible progress bar shared by the portal and the admin project pages. */
export function ProgressBar({
  percent,
  label,
  tone = "emerald",
  className,
}: {
  percent: number;
  label?: string;
  tone?: "emerald" | "indigo" | "rose";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = {
    emerald: "bg-emerald-500",
    indigo: "bg-indigo-500",
    rose: "bg-rose-500",
  }[tone];

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      >
        <div className={clsx("h-full rounded-full transition-all", fill)} style={{ width: `${clamped}%` }} />
      </div>
      {label ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
      ) : null}
    </div>
  );
}
