import Subheading from "@/components/marketing-general/subheading";
import ArticlesFeed from "@/components/marketing-sections/articles-feed";
import Features from "@/components/marketing-sections/features/features";
import Loading from "@/components/marketing-sections/features/features-loading";
import Hero from "@/components/marketing-sections/hero";
import OurMission from "@/components/marketing-sections/our-mission/our-mission";
import OurMissionLoading from "@/components/marketing-sections/our-mission/our-mission-loading";
import SuccessStories from "@/components/marketing-sections/success-stories/success-stories";
import SuccessStoriesLoading from "@/components/marketing-sections/success-stories/success-stories-loading";
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
          url="/about"
          linkText="Our story"
        >
          Our Mission
        </Subheading>
        <Suspense fallback={<OurMissionLoading />}>
          <OurMission />
        </Suspense>
      </div>

      <div className="flex flex-col h-full max-w-[95rem] w-full mx-auto px-4 lg:pt-0 sm:pt-4 xs:pt-2 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
        <Subheading
          className="text-subheading"
          url="/stories"
          linkText="All stories"
        >
          Success Stories
        </Subheading>
        <Suspense fallback={<SuccessStoriesLoading />}>
          <SuccessStories />
        </Suspense>
      </div>

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
