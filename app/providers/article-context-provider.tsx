"use client";

import { ArticleContext } from "@/context/article-context";
import { getArticles } from "@/utils/getArticles";

export default function ArticleContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = getArticles();
  return (
    <ArticleContext.Provider value={{ data }}>
      {children}
    </ArticleContext.Provider>
  );
}
