import PageTitle from "@/components/marketing-general/page-title";

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
    </main>
  );
}

export default ArticlesPage;
