import { getArticles } from "@/utils/getArticles";
import { getAllArticlesWithAuthors, getHeroImage } from "@/utils/article-utils";
import LatestArticles from "@/components/marketing-sections/latest-articles/latest-articles";
import PostNavigation from "@/components/marketing-general/post-navigation";
import SocialSharing from "@/components/marketing-general/social-sharing";
import Image from "next/image";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ title: string }>;
}) {
  const { title } = await params;
  const all = getAllArticlesWithAuthors(getArticles());
  const match = all.find(({ article }) => article.slug === title);

  if (!match) return {};

  return {
    title: `${match.article.title} | Verdictu`,
  };
}

export default async function ArticleDetails({
  params,
}: {
  params: Promise<{ title: string }>;
}) {
  const { title } = await params;
  const all = getAllArticlesWithAuthors(getArticles());
  const match = all.find(({ article }) => article.slug === title);

  if (!match) notFound();

  const { article, authorName } = match;
  const heroImage = getHeroImage(article);

  const summaryBlock = article.content.find(
    (b): b is { img: string; summary: string } => "summary" in b
  );
  const section1Block = article.content.find(
    (b): b is { section1: string } => "section1" in b
  );
  const quoteBlock = article.content.find(
    (b): b is { quote: string[] } => "quote" in b
  );
  const summary2Block = article.content.find(
    (b): b is { summary2: string } => "summary2" in b
  );
  const section2Block = article.content.find(
    (b): b is { section2: string } => "section2" in b
  );

  return (
    <main className="max-w-[95rem] w-full mx-auto px-4 pb-12 sm:pt-4 xs:pt-2 md:pb-4 sm:pb-2 xs:pb-2">
      <PostNavigation href="/articles">Article</PostNavigation>

      <article className="max-w-[75rem] w-full mx-auto flex flex-wrap gap-24">
        <article className="flex flex-col lg:w-1/4">
          <Image
            src={heroImage}
            alt={article.imgAlt}
            width={600}
            height={600}
            className="w-full object-cover"
          />
          <div className="flex justify-between mt-8 pb-12 border-b border-black">
            <p className="text-xl font-semibold">Share</p>
            <SocialSharing
              links={[
                {
                  href: "#",
                  ariaLabel: "Share on X",
                  src: "/icons/x-black.svg",
                  alt: "X logo",
                },
                {
                  href: "#",
                  ariaLabel: "Share on LinkedIn",
                  src: "/icons/linkedin-black.svg",
                  alt: "LinkedIn logo",
                },
                {
                  href: "#",
                  ariaLabel: "Share on Instagram",
                  src: "/icons/ri_instagram-line.svg",
                  alt: "Instagram logo",
                },
              ]}
            />
          </div>
          <div className="flex flex-col gap-4 pt-8">
            <div className="flex flex-wrap justify-between">
              <p className="font-semibold">Date</p>
              <time dateTime={article.date}>{article.date}</time>
            </div>
            <div className="flex flex-wrap justify-between">
              <p className="font-semibold">Read</p>
              <p>{article.read}</p>
            </div>
            <div className="flex flex-wrap justify-between">
              <p className="font-semibold">Author</p>
              <p>{authorName}</p>
            </div>
          </div>
        </article>

        <article className="flex flex-col flex-1 w-full">
          <p className="uppercase font-semibold">{article.label}</p>
          <h1 className="podcast-title">{article.title}</h1>

          {summaryBlock && (
            <p className="text-blog-summary pt-8 pb-16">
              {summaryBlock.summary}
            </p>
          )}

          {section1Block && (
            <p className="whitespace-pre-line">{section1Block.section1}</p>
          )}

          {quoteBlock && (
            <div className="border-t-2 border-b-2 border-black my-6">
              <div className="py-12">
                <p className="text-blog-quote pb-6">
                  &ldquo;{quoteBlock.quote[0]}
                </p>
                <p>{quoteBlock.quote[1]}</p>
              </div>
            </div>
          )}

          {summary2Block && (
            <p className="text-blog-summary pt-8 pb-16">
              {summary2Block.summary2}
            </p>
          )}

          {section2Block && (
            <p className="whitespace-pre-line">{section2Block.section2}</p>
          )}
        </article>
      </article>

      <div className="pb-12 md:pb-48">
        <h2 className="text-blog-subheading border-t-2 border-black mt-[9.5rem] pt-12 pb-12 md:pb-24">
          Latest Articles
        </h2>
        <LatestArticles />
      </div>
    </main>
  );
}
