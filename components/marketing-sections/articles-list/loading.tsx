import { Skeleton } from "@/components/ui/skeleton";
import ArticlesCard from "./articles-card";

export default function Loading() {
  return (
    <div className="flex flex-col max-w-[95rem] w-full mx-auto py-12 md:py-48">
      <div>
        <ArticlesCard />
        <Skeleton className="bg-[#a1a1a1] h-1 w-full my-6 rounded-none"></Skeleton>
        <ArticlesCard />
        <Skeleton className="bg-[#a1a1a1] h-1 w-full my-6 rounded-none"></Skeleton>
        <ArticlesCard />
        <Skeleton className="bg-[#a1a1a1] h-1 w-full my-6 rounded-none"></Skeleton>
        <ArticlesCard />
        <Skeleton className="bg-[#a1a1a1] h-1 w-full my-6 rounded-none"></Skeleton>
        <ArticlesCard />
      </div>
    </div>
  );
}
