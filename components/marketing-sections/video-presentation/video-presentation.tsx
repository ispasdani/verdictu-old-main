"use client";

import Link from "next/link";
import Image from "next/image";
import { useArticleContext } from "@/context/article-context";
import Loading from "@/components/marketing-sections/video-presentation/loading";
import {
  getAllArticlesWithAuthors,
  getHeroImage,
  parseHumanDate,
} from "@/utils/article-utils";

export default function VideoPresentation() {
  const { data } = useArticleContext();

  if (!data?.length) return <Loading />;

  const all = getAllArticlesWithAuthors(data).sort((x, y) => {
    return (
      parseHumanDate(y.article.date).getTime() -
      parseHumanDate(x.article.date).getTime()
    );
  });

  const latest = all[0];
  if (!latest) return <Loading />;

  const latestArticle = latest.article;

  return (
    <div className="flex flex-col-reverse sm:flex-col gap-6 md:gap-12 py-6 md:py-10 max-w-[95rem] w-full mx-auto">
      <article className="flex flex-col-reverse sm:flex-col gap-6 md:gap-12">
        <article className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
          <h2 className="text-subtitle">
            <Link href={`/magazine/${latestArticle.slug}`}>
              {latestArticle.title}
            </Link>
          </h2>

          <article className="flex flex-col justify-between gap-2">
            <p>{latestArticle.description}</p>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                <span className="flex flex-wrap">
                  <p className="font-semibold pr-2">Text</p>
                  <p>{latest.authorName}</p>
                </span>

                <span className="flex flex-wrap">
                  <p className="font-semibold pr-2">Date</p>
                  <time dateTime={latestArticle.date}>
                    {latestArticle.date}
                  </time>
                </span>

                <span className="flex flex-wrap">
                  <p className="font-semibold pr-2">Read</p>
                  <p>{latestArticle.read}</p>
                </span>
              </div>

              <span className="px-3 py-2 border border-black rounded-full w-fit">
                <p className="uppercase">{latestArticle.label}</p>
              </span>
            </div>
          </article>
        </article>

        <div>
          <Image
            className="w-full object-cover aspect-[9/6]"
            src={getHeroImage(latestArticle)}
            alt={latestArticle.imgAlt}
            width={1488}
            height={992}
            priority
          />
        </div>
      </article>
    </div>
  );
}
