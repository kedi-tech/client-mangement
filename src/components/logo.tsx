import Image from "next/image";

import { cn } from "@/lib/cn";

/*
 * The KediClient logo. Both PNGs have a white background, so they sit on a
 * white rounded tile — that keeps them clean on the dark rail and in dark mode.
 */

/** The "KC" mark on its own, square. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-[6px] bg-white", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-mark.png"
        alt=""
        width={size}
        height={size}
        priority
        unoptimized
        className="size-full object-contain p-[2px]"
      />
    </span>
  );
}

/** Mark plus the "KediClient" word, for the rail and drawer. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 text-[15px] font-semibold", className)}>
      <LogoMark />
      KediClient
    </span>
  );
}

/** The full logo with wordmark and tagline, for the sign-in screens. */
export function LogoFull({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block rounded-[8px] bg-white px-4 py-3", className)}>
      <Image
        src="/logo.png"
        alt="KediClient"
        width={768}
        height={557}
        priority
        unoptimized
        className="h-auto w-[180px]"
      />
    </span>
  );
}
