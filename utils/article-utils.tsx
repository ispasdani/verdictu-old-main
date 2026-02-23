import type { Author, Article } from "@/utils/getArticles";

export function parseHumanDate(dateStr: string) {
  // expects: "18 February 2026" OR "16 September 2023"
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length < 3) return new Date(0);

  const day = Number(parts[0]);
  const monthName = parts[1];
  const year = Number(parts[2]);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthIndex = months.indexOf(monthName);
  if (!day || monthIndex === -1 || !year) return new Date(0);

  return new Date(year, monthIndex, day);
}

export function getAllArticlesWithAuthors(data: Author[]) {
  return data.flatMap((a) =>
    a.articles.map((article) => ({
      article,
      authorName: a.author,
      authorSlug: a.slug,
      authorAvatar: a.avatar,
      authorCity: a.city,
      authorJob: a.job,
    })),
  );
}

export function getHeroImage(article: Article) {
  const imgBlock = article.content.find((b: any) => "img" in b && b.img);
  return (imgBlock as any)?.img || article.img;
}
