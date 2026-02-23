import Link from "next/link";
import Image from "next/image";
import { getFeatures } from "@/utils/getFeatures";

export default async function Features() {
  const data = await getFeatures();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-3 max-w-[95rem] w-full mx-auto ">
      {data.map((feature) => (
        <article className="border border-black p-4 md:p-12" key={feature.id}>
          <Link href={`/features/${feature.slug}`}>
            <Image
              className="hover:scale-105 transition"
              src={feature.img}
              alt={feature.imgAlt}
              width={920}
              height={920}
              priority
            />
          </Link>

          <h2 className="heading3-title mt-8 mb-12">
            <Link href={`/features/${feature.slug}`}>{feature.title}</Link>
          </h2>

          <div className="flex flex-wrap gap-4">
            <span className="flex">
              <p className="font-semibold pr-2">Date</p>
              <time dateTime={feature.date}>{feature.date}</time>
            </span>

            <span className="flex">
              <p className="font-semibold pr-2">Length</p>
              <p>{feature.duration}</p>
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
