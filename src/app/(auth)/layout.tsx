import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image
            src="/logo-mark.png"
            alt=""
            width={36}
            height={36}
            priority
            unoptimized
            className="size-9 shrink-0 rounded-lg bg-white ring-1 ring-slate-200 dark:ring-slate-700"
          />
        <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          KediClient
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
