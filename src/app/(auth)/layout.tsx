import type { ReactNode } from "react";

import { LogoFull } from "@/components/logo";

/** Centered column for sign-in and sign-up; each page sets its own card. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center bg-bg p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-5">
        <div className="flex justify-center">
          <LogoFull />
        </div>
        {children}
      </div>
    </div>
  );
}
