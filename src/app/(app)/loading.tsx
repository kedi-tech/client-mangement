/**
 * Shown the instant a link is clicked, inside the rail and top bar, while the
 * page's data loads — so navigation always feels immediate.
 */
export default function AppLoading() {
  const bar = "animate-pulse rounded-[4px] bg-l2";
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-2">
          <div className={`${bar} h-6 w-48`} />
          <div className={`${bar} h-3.5 w-72`} />
        </div>
        <div className={`${bar} h-8 w-28`} />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-ln bg-pn min-[720px]:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 px-4 py-3.5">
            <div className={`${bar} h-3 w-24`} />
            <div className={`${bar} h-6 w-16`} />
          </div>
        ))}
      </div>
      <div className="rounded-[6px] border border-ln bg-pn">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-l2 px-3.5 py-3 last:border-b-0">
            <div className={`${bar} h-3.5 flex-1`} />
            <div className={`${bar} h-3.5 w-20`} />
            <div className={`${bar} h-3.5 w-16`} />
          </div>
        ))}
      </div>
    </div>
  );
}
