import articlesData from "@/json/articles.json";

export type ArticleBlock =
  | { img: string; summary: string }
  | { section1: string }
  | { quote: string[] }
  | { summary2: string }
  | { section2: string };

export type Article = {
  title: string;
  popular: boolean;
  popularity?: number;
  description: string;
  date: string; // e.g. "18 February 2026"
  read: string;
  label: string;
  img: string;
  imgAlt: string;
  slug: string;
  content: ArticleBlock[];
};

export type Author = {
  id: number;
  author: string;
  job: string;
  city: string;
  avatar: string;
  imgAlt: string;
  slug: string;
  biography?: { summary: string; body: string };
  articles: Article[];
};

export function getArticles(): Author[] {
  return articlesData as Author[];
}
