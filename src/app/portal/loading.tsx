import { PortalHero, PortalMain } from "@/components/portal-ui";

/** Instant placeholder inside the portal band while a page's data loads. */
export default function PortalLoading() {
  const bar = "animate-pulse rounded-full bg-track";
  return (
    <>
      <PortalHero title=" " />
      <PortalMain>
        <div aria-busy="true" aria-label="Loading" className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-[20px] bg-card p-[22px] shadow-soft">
              <div className={`${bar} h-3.5 w-24`} />
              <div className={`${bar} h-8 w-32`} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-[20px] bg-card p-[22px]">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2.5">
              <div className={`${bar} h-4 w-56`} />
              <div className={`${bar} h-2.5 w-full`} />
            </div>
          ))}
        </div>
      </PortalMain>
    </>
  );
}
