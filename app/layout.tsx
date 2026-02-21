import Container from "@/components/marketing-general/container";
import "./globals.css";
import type { Metadata } from "next";
import ArticleContextProvider from "./providers/article-context-provider";

export const metadata: Metadata = {
  title: {
    default: "Relative - Modern Next.js Template",
    template: "%s | Relative",
  },
  description:
    "A modern, fully featured Next.js template built with Shadcn/UI, TailwindCSS and TypeScript, perfect for your next web application.",
  keywords: [
    "Next.js",
    "React",
    "JavaScript",
    "TypeScript",
    "TailwindCSS",
    "Template",
    "Shadcn/UI",
    "Web Development",
  ],
  authors: [{ name: "Relative Team" }],
  creator: "Relative Team",
  publisher: "Relative",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "48x48" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon.ico" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicon/favicon.ico" }],
  },
  openGraph: {
    title: "Relative - Modern Next.js Template",
    description:
      "A modern, fully featured Next.js template built with Shadcn/UI, TailwindCSS and TypeScript, perfect for your next web application.",
    siteName: "Relative",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Relative - Modern Next.js Template",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Relative - Modern Next.js Template",
    description:
      "A modern, fully featured Next.js template built with Shadcn/UI, TailwindCSS and TypeScript, perfect for your next web application.",
    images: ["/og-image.jpg"],
    creator: "@Relative",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link
          rel="icon"
          href="/logos/FyrreMagazineFavicon.svg"
          type="image/x-icon"
        />
      </head>
      <body>
        <ArticleContextProvider>
          <Container>{children}</Container>
        </ArticleContextProvider>
      </body>
    </html>
  );
}
