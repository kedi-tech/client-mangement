import Link from "next/link";

import { PortalCard, PortalHero, PortalMain, portalButtonClass } from "@/components/portal-ui";

/** 404 inside the portal — also what another client's record ids resolve to. */
export default function PortalNotFound() {
  return (
    <>
      <PortalHero title="Page not found" />
      <PortalMain>
        <PortalCard raised className="flex flex-col items-start gap-3 px-7 py-10">
          <p className="m-0 max-w-[480px] text-[14.5px] leading-[1.55] text-mu">
            The record you are looking for may have been deleted, or the link is wrong.
          </p>
          <Link href="/portal" className={portalButtonClass}>
            Back to overview
          </Link>
        </PortalCard>
      </PortalMain>
    </>
  );
}
