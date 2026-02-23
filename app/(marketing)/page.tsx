import Subheading from "@/components/marketing-general/subheading";
import ArticlesFeed from "@/components/marketing-sections/articles-feed";
import Hero from "@/components/marketing-sections/hero";
import VideoPresentation from "@/components/marketing-sections/video-presentation/video-presentation";

function MarketingPage() {
  return (
    <div>
      <Hero />
      <VideoPresentation />
      <div className="flex flex-col h-full max-w-[95rem] w-full mx-auto px-4 lg:pt-0 sm:pt-4 xs:pt-2 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
        <ArticlesFeed />
      </div>

      <div className="flex flex-col h-full max-w-[95rem] w-full mx-auto px-4 lg:pt-0 sm:pt-4 xs:pt-2 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
        <Subheading
          className="text-subheading"
          url="/features"
          linkText="All features"
        >
          Features
        </Subheading>
      </div>
    </div>
  );
}

export default MarketingPage;
