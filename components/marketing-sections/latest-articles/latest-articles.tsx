import { getArticles } from "@/utils/getArticles";
import { getAllArticlesWithAuthors, parseHumanDate } from "@/utils/article-utils";
import Image from "next/image";
import Link from "next/link";

export default function LatestArticles() {
  const data = getArticles();
  const latest = getAllArticlesWithAuthors(data)
    .sort(
      (x, y) =>
        parseHumanDate(y.article.date).getTime() -
        parseHumanDate(x.article.date).getTime()
    )
    .slice(0, 3);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 max-w-[95rem] w-full mx-auto border border-black border-collapse">
      {latest.map(({ article }) => (
        <article className="border border-black p-4 md:p-12" key={article.slug}>
          <Link href={`/articles/${article.slug}`}>
            <Image
              className="hover:scale-105 transition"
              src={article.img}
              alt={article.imgAlt}
              width={920}
              height={920}
            />
          </Link>
          <h2 className="heading3-title mt-8 mb-12">
            <Link href={`/articles/${article.slug}`}>{article.title}</Link>
          </h2>
          <div className="flex flex-wrap gap-4">
            <span className="flex">
              <p className="font-semibold pr-2">Date</p>
              <time dateTime={article.date}>{article.date}</time>
            </span>
            <span className="flex">
              <p className="font-semibold pr-2">Read</p>
              <p>{article.read}</p>
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
