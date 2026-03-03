import { getArticles } from "@/utils/getArticles";
import Image from "next/image";
import Link from "next/link";

export default function ArticlesList() {
  const articles = getArticles().flatMap((author) => author.articles);
  return (
    <div className="flex flex-col max-w-[95rem] w-full mx-auto py-12 md:py-48">
      {articles.map((article, index) => (
        <div key={article.slug}>
          <div className="grid grid-cols-1 md:grid-cols-[auto_auto] justify-between md:items-center gap-3 md:gap-0">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-16">
              <p className="font-semibold">{article.label}</p>
              <Image
                className="w-[15rem] h-[15rem]"
                src={article.img}
                alt={article.imgAlt}
                width={240}
                height={240}
              />
              <h2 className="heading3-title">{article.title}</h2>
            </div>
            <div className="flex flex-col md:flex-row md:items-center flex-wrap gap-2">
              <p>{article.date}</p>
              <p>{article.read}</p>
              <Link className="flex gap-2" href={`articles/${article.slug}`}>
                <span className="uppercase font-semibold">Read</span>
                <img
                  src="/icons/ri_arrow-right-line.svg"
                  alt="An arrow pointing right"
                />
              </Link>
            </div>
          </div>
          {index < articles.length - 1 && (
            <div className="border border-black my-6" />
          )}
        </div>
      ))}
    </div>
  );
}
