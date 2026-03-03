"use client";

import menu from "@/data/menu";
import featuresData from "@/json/features.json";
import {
  BookOpen,
  ChevronDown,
  FileEdit,
  FileText,
  GitCompare,
  HardDrive,
  Scale,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import SocialSharing from "./social-sharing";

const featureIcons: Record<string, ReactNode> = {
  "jurisdiction-first-answers": <Scale className="size-4" />,
  "source-backed-clarity": <BookOpen className="size-4" />,
  "compare-mode-documents": <GitCompare className="size-4" />,
  "draft-mode-templates": <FileText className="size-4" />,
  "smart-workflows": <Workflow className="size-4" />,
  "ai-text-editor": <FileEdit className="size-4" />,
  "local-private-ai": <HardDrive className="size-4" />,
  "security": <ShieldCheck className="size-4" />,
};

const MobileNav = () => {
  const [productsOpen, setProductsOpen] = useState(false);

  return (
    <nav
      className="flex flex-col flex-1 justify-end gap-6"
      aria-labelledby="mobile-nav"
    >
      {/* Products accordion */}
      <div className="flex flex-col gap-2">
        <button
          className="flex items-center gap-1"
          onClick={() => setProductsOpen((prev) => !prev)}
          aria-expanded={productsOpen}
        >
          Products
          <ChevronDown
            className={`size-3.5 transition-transform duration-200 ${productsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {productsOpen && (
          <div className="flex flex-col gap-1 pl-2 border-l border-border">
            {featuresData.map((feature) => (
              <Link
                key={feature.slug}
                href={`/features/${feature.slug}`}
                className="flex items-start gap-2.5 py-2"
              >
                <div className="mt-0.5 shrink-0 text-muted-foreground">
                  {featureIcons[feature.slug]}
                </div>
                <div>
                  <div className="text-sm font-medium leading-none">
                    {feature.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {feature.content[0].summary}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {menu.map((menuItem, index) => (
        <Link key={index} href={menuItem.href}>
          {menuItem.label}
        </Link>
      ))}
      <svg
        width="15"
        height="1"
        viewBox="0 0 15 1"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="15" height="1" fill="black" />
      </svg>
      <SocialSharing
        links={[
          {
            href: "#",
            ariaLabel: "Visit our Instagram page",
            src: "/icons/ri_instagram-line.svg",
            alt: "Instagram logo",
          },
          {
            href: "#",
            ariaLabel: "Visit our X page",
            src: "/icons/x-black.svg",
            alt: "X logo",
          },
          {
            href: "#",
            ariaLabel: "Visit our YouTube page",
            src: "/icons/ri_youtube-fill.svg",
            alt: "YouTube logo",
          },
          {
            href: "#",
            ariaLabel: "Visit our LinkedIn page",
            src: "/icons/linkedin-black.svg",
            alt: "LinkedIn logo",
          },
        ]}
      />
    </nav>
  );
};

export default MobileNav;
