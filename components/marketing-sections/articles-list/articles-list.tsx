import { getArticles } from "@/utils/getArticles";
import Image from "next/image";
import Link from "next/link";

export default async function ArticlesList() {
  const data = await getArticles();
  return (
    <div className="flex flex-col max-w-[95rem] w-full mx-auto py-12 md:py-48">
      {data.map((articles, index) => (
        <div key={articles.id}>
          <div className="grid grid-cols-1 md:grid-cols-[auto_auto] justify-between md:items-center gap-3 md:gap-0">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-16">
              <p className="font-semibold">{articles.episode.slice(7)}</p>
              <Image
                className="w-[15rem] h-[15rem]"
                src={articles.img}
                alt={articles.imgAlt}
                width={240}
                height={240}
              />
              <h2 className="heading3-title">{articles.title}</h2>
            </div>
            <div className="flex flex-col md:flex-row md:items-center flex-wrap gap-2">
              <p>{articles.date}</p>
              <p>{articles.duration}</p>
              <Link className="flex gap-2" href={`articles/${articles.slug}`}>
                <span className="uppercase font-semibold">Read</span>
                <img
                  src="/icons/ri_arrow-right-line.svg"
                  alt="An arrow pointing right"
                />
              </Link>
            </div>
          </div>
          {index < data.length - 1 && (
            <div className="border border-black my-6" />
          )}
        </div>
      ))}
    </div>
  );
}
