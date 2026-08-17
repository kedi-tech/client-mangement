import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          CM
        </span>
        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Client Management
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
