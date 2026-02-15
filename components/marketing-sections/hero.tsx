import AIChatInput from "../marketing-general/aiChatInput";
import NewsLoading from "../marketing-general/news-ticker/loading";
import NewsTicker from "../marketing-general/news-ticker/news-ticker";
import PageTitle from "../marketing-general/page-title";
import { Suspense } from "react";

function Hero() {
  return (
    <main className="flex flex-col min-h-screen max-w-[95rem] w-full mx-auto px-4 lg:pt-0 sm:pt-4 xs:pt-2 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
      <PageTitle
        className="sr-only"
        imgSrc="/images/titles/law-and-clarity.svg"
        imgAlt="The words 'Law and Clarity' in bold uppercase lettering"
      >
        Law and Clarity
      </PageTitle>

      <Suspense fallback={<NewsLoading />}>
        <NewsTicker />
      </Suspense>

      <AIChatInput />
    </main>
  );
}

export default Hero;
