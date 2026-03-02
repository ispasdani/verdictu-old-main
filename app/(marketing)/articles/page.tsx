import PageTitle from "@/components/marketing-general/page-title";
import { Suspense } from "react";

export const metadata = {
  title: "Podcasts  | Fyrre Magazine",
  description: "The latest podcasts list",
};

function ArticlesPage() {
  return (
    <main>
      <PageTitle
        className="sr-only"
        imgSrc="/images/titles/Podcast.svg"
        imgAlt="The word 'Podcast' in bold, uppercase lettering"
      >
        Podcast
      </PageTitle>
    </main>
  );
}

export default ArticlesPage;
