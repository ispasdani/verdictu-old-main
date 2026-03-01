import { Skeleton } from "@/components/ui/skeleton";

function PricingCardSkeleton({ dark = false }: { dark?: boolean }) {
  const bar = dark ? "bg-white/20" : "bg-[#a1a1a1]";
  const border = dark ? "border-white/20" : "border-[#a1a1a1]";
  const bg = dark ? "bg-black" : "bg-white";

  return (
    <div
      className={`${bg} p-8 xl:p-10 flex flex-col justify-between gap-8 border-b ${border} xl:border-b-0 xl:border-r`}
    >
      <div className="flex flex-col gap-6">
        {/* Label */}
        <Skeleton className={`${bar} h-4 w-20 rounded-none`} />

        {/* Price block */}
        <div className="flex flex-col gap-2">
          <Skeleton className={`${bar} h-12 w-32 rounded-none`} />
          <Skeleton className={`${bar} h-4 w-48 rounded-none`} />
          <Skeleton className={`${bar} h-4 w-36 rounded-none`} />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <Skeleton className={`${bar} h-5 w-full rounded-none`} />
          <Skeleton className={`${bar} h-5 w-4/5 rounded-none`} />
        </div>

        {/* Feature list */}
        <div className={`flex flex-col gap-3 pt-6 border-t ${border}`}>
          {[100, 85, 95, 75, 90].map((w, i) => (
            <Skeleton
              key={i}
              className={`${bar} h-5 rounded-none`}
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <Skeleton className={`${bar} h-12 w-full rounded-none`} />
    </div>
  );
}

export default function PricingLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 max-w-[95rem] w-full mx-auto border border-[#a1a1a1]">
      <PricingCardSkeleton />
      <PricingCardSkeleton dark />
      <PricingCardSkeleton />
      <PricingCardSkeleton />
    </div>
  );
}
