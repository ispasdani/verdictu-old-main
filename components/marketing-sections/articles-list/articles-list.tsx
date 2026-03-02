import { getArticles } from "@/utils/getArticles";

export default async function ArticlesList() {
  const data = await getArticles();
  return (
    <div className="flex flex-col max-w-[95rem] w-full mx-auto py-12 md:py-48">
      ArticlesList
    </div>
  );
}
