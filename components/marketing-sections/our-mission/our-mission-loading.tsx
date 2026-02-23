import { Skeleton } from "@/components/ui/skeleton";

export default function OurMissionLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 border border-[#a1a1a1] max-w-[95rem] w-full mx-auto">
      <Skeleton className="bg-[#a1a1a1] rounded-none min-h-[32rem]" />

      <div className="p-8 md:p-12 flex flex-col justify-center gap-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="bg-[#a1a1a1] h-4 w-28 rounded-none" />
          <div className="flex flex-col gap-2">
            <Skeleton className="bg-[#a1a1a1] h-9 w-full rounded-none" />
            <Skeleton className="bg-[#a1a1a1] h-9 w-3/4 rounded-none" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="bg-[#a1a1a1] h-5 w-full rounded-none" />
          <Skeleton className="bg-[#a1a1a1] h-5 w-full rounded-none" />
          <Skeleton className="bg-[#a1a1a1] h-5 w-full rounded-none" />
          <Skeleton className="bg-[#a1a1a1] h-5 w-2/3 rounded-none" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="bg-[#a1a1a1] h-5 w-full rounded-none" />
          <Skeleton className="bg-[#a1a1a1] h-5 w-full rounded-none" />
          <Skeleton className="bg-[#a1a1a1] h-5 w-4/5 rounded-none" />
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-[#a1a1a1]">
          <Skeleton className="bg-[#a1a1a1] h-6 w-40 rounded-none" />
          <Skeleton className="bg-[#a1a1a1] h-5 w-52 rounded-none" />
        </div>
      </div>
    </div>
  );
}
