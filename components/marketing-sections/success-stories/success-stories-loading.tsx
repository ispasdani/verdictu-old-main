import { Skeleton } from "@/components/ui/skeleton";

export default function SuccessStoriesLoading() {
  return (
    <div className="border border-[#a1a1a1] max-w-[95rem] w-full mx-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 md:px-12 py-4 border-b border-[#a1a1a1]">
        <Skeleton className="bg-[#a1a1a1] h-4 w-16 rounded-none" />
        <div className="flex gap-2">
          <Skeleton className="bg-[#a1a1a1] w-10 h-10 rounded-none" />
          <Skeleton className="bg-[#a1a1a1] w-10 h-10 rounded-none" />
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]">
        {/* Quote side */}
        <div className="p-8 md:p-12 border-b border-[#a1a1a1] md:border-b-0 md:border-r flex flex-col gap-6">
          <Skeleton className="bg-[#a1a1a1] h-8 w-36 rounded-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="bg-[#a1a1a1] h-10 w-full rounded-none" />
            <Skeleton className="bg-[#a1a1a1] h-10 w-full rounded-none" />
            <Skeleton className="bg-[#a1a1a1] h-10 w-4/5 rounded-none" />
          </div>
        </div>

        {/* Person side */}
        <div className="p-8 md:p-12 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="bg-[#a1a1a1] h-6 w-36 rounded-none" />
            <Skeleton className="bg-[#a1a1a1] h-5 w-44 rounded-none" />
          </div>
          <div className="flex flex-col gap-3 pt-6 border-t border-[#a1a1a1]">
            <Skeleton className="bg-[#a1a1a1] h-4 w-20 rounded-none" />
            <Skeleton className="bg-[#a1a1a1] h-9 w-44 rounded-none" />
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="flex border-t border-[#a1a1a1]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-1.5 bg-[#e5e5e5]" />
        ))}
      </div>
    </div>
  );
}
