import PageTitle from "@/components/marketing-general/page-title";
import ArticlesList from "@/components/marketing-sections/articles-list/articles-list";
import Loading from "@/components/marketing-sections/articles-list/loading";
import { Suspense } from "react";

export const metadata = {
  title: "Articles  | Fyrre Magazine",
  description: "The latest articles list",
};

function ArticlesPage() {
  return (
    <main>
      <PageTitle
        className="sr-only"
        imgSrc="/images/titles/Articles.svg"
        imgAlt="The word 'Articles' in bold, uppercase lettering"
      >
        Articles
      </PageTitle>
      <Suspense fallback={<Loading />}>
        <ArticlesList />
      </Suspense>
    </main>
  );
}

export default ArticlesPage;
