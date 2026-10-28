import Link from "next/link";

import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="flex max-w-[520px] flex-col items-start gap-3">
        <span className="font-mono text-[13px] text-fa">404</span>
        <h1 className="m-0 text-[24px] font-semibold">Page not found</h1>
        <p className="m-0 text-[14px] leading-[1.55] text-mu">
          The record you are looking for may have been deleted, or the link is wrong.
        </p>
        <Link href="/" className={buttonClass("primary", "lg")}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
