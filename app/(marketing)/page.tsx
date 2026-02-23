import Subheading from "@/components/marketing-general/subheading";
import ArticlesFeed from "@/components/marketing-sections/articles-feed";
import Features from "@/components/marketing-sections/features/features";
import Loading from "@/components/marketing-sections/features/features-loading";
import Hero from "@/components/marketing-sections/hero";
import VideoPresentation from "@/components/marketing-sections/video-presentation/video-presentation";
import { Suspense } from "react";

function MarketingPage() {
  return (
    <div>
      <Hero />
      <VideoPresentation />

      <div className="flex flex-col h-full max-w-[95rem] w-full mx-auto px-4 lg:pt-0 sm:pt-4 xs:pt-2 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
        <Subheading
          className="text-subheading"
          url="/features"
          linkText="All features"
        >
          Features
        </Subheading>
        <Suspense fallback={<Loading />}>
          <Features />
        </Suspense>
      </div>
      <div className="flex flex-col h-full max-w-[95rem] w-full mx-auto px-4 lg:pt-0 sm:pt-4 xs:pt-2 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
        <Subheading
          className="text-subheading"
          url="/articles"
          linkText="All articles"
        >
          Articles
        </Subheading>
        <ArticlesFeed />
      </div>
    </div>
  );
}

export default MarketingPage;
