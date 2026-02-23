"use client";

import { createContext, useContext } from "react";
import type { Author } from "@/utils/getArticles";

type ArticleContextType = { data: Author[] };

export const ArticleContext = createContext<ArticleContextType | null>(null);

export function useArticleContext() {
  const ctx = useContext(ArticleContext);
  if (!ctx)
    throw new Error(
      "useArticleContext must be used within an ArticleContextProvider",
    );
  return ctx;
}
