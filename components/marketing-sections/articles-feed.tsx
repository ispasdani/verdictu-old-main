"use client";

import Link from "next/link";
import Image from "next/image";
import { Separator } from "@radix-ui/react-separator";
import { useArticleContext } from "@/context/article-context";
import Loading from "./video-presentation/loading";
import {
  getAllArticlesWithAuthors,
  parseHumanDate,
} from "@/utils/article-utils";
import ArticlesSidebar from "../marketing-general/articles-sidebar";

export default function ArticlesFeed() {
  const { data } = useArticleContext();
  if (!data?.length) return <Loading />;

  const all = getAllArticlesWithAuthors(data).sort((x, y) => {
    return (
      parseHumanDate(y.article.date).getTime() -
      parseHumanDate(x.article.date).getTime()
    );
  });

  const remaining = all.slice(1);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 xl:gap-24">
      <div className="lg:w-3/4">
        {remaining.map(({ article, authorName }, index) => (
          <article key={`${article.slug}-${index}`}>
            <article className="grid md:grid-cols-[0fr_1fr] gap-6 sm:gap-12">
              <Link href={`/magazine/${article.slug}`} className="h-60 w-60">
                <Image
                  className="w-full h-full object-cover hover:scale-105 transition"
                  src={article.img}
                  alt={article.imgAlt}
                  width={240}
                  height={240}
                />
              </Link>

              <article className="flex flex-col justify-between">
                <div className="mb-4 :md:mb-0">
                  <h3 className="heading3-title mb-3">
                    <Link href={`/magazine/${article.slug}`}>
                      {article.title}
                    </Link>
                  </h3>
                  <p>{article.description}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                    <span className="flex flex-wrap">
                      <p className="font-semibold pr-2">Text</p>
                      <p>{authorName}</p>
                    </span>

                    <span className="flex flex-wrap">
                      <p className="font-semibold pr-2">Date</p>
                      <time dateTime={article.date}>{article.date}</time>
                    </span>

                    <span className="flex flex-wrap">
                      <p className="font-semibold pr-2">Read</p>
                      <p>{article.read}</p>
                    </span>
                  </div>

                  <span className="px-3 py-2 border border-black rounded-full w-fit">
                    <p className="uppercase">{article.label}</p>
                  </span>
                </div>
              </article>
            </article>

            {index < remaining.length - 1 && (
              <Separator className="border border-black my-6" />
            )}
          </article>
        ))}
      </div>

      <div className="lg:w-1/4">
        <ArticlesSidebar />
      </div>
    </div>
  );
}
