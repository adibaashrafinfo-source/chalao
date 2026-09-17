/**
 * Shown the moment a dashboard link is clicked, while the server fetches.
 *
 * Without this boundary Next waits for the whole page before it navigates, so a
 * click felt like nothing had happened. Next also prefetches up to this skeleton,
 * which makes the swap feel instant.
 */
export default function DashboardLoading() {
  return (
    <>
      {/* top bar */}
      <div className="flex flex-col gap-4 border-b border-border-subtle bg-surface px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-3.5 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Shimmer className="h-10 w-full rounded-full lg:w-64" />
          <Shimmer className="size-10 rounded-full" />
          <Shimmer className="size-10 rounded-full" />
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-7 w-24" />
              <Shimmer className="h-3 w-28" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <Shimmer className="h-4 w-36" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Shimmer key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-alt motion-reduce:animate-none ${className ?? ""}`} />;
}
