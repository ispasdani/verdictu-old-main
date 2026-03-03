import {
  FileEdit,
  GitCompare,
  HardDrive,
  Scale,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";

export type Product = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
};

export const products: Product[] = [
  {
    title: "Workflows",
    description:
      "Automate document creation, approvals, and repetitive legal processes end-to-end.",
    href: "/products/workflows",
    icon: <Workflow className="size-4" />,
  },
  {
    title: "AI Text Editor",
    description:
      "Draft, review, and refine legal documents with jurisdiction-aware AI suggestions.",
    href: "/products/editor",
    icon: <FileEdit className="size-4" />,
  },
  {
    title: "Local Private AI",
    description:
      "Run LLMs entirely on your machine. No data leaves your environment—ever.",
    href: "/products/local-ai",
    icon: <HardDrive className="size-4" />,
  },
  {
    title: "100% Security",
    description:
      "End-to-end encryption, zero-knowledge architecture, and full audit trails.",
    href: "/products/security",
    icon: <ShieldCheck className="size-4" />,
  },
  {
    title: "AI Legal Research",
    description:
      "Precision answers anchored to the right jurisdiction with source-backed citations.",
    href: "/products/research",
    icon: <Scale className="size-4" />,
  },
  {
    title: "Document Compare",
    description:
      "Drop two documents and instantly see what changed, what's risky, and what's missing.",
    href: "/products/compare",
    icon: <GitCompare className="size-4" />,
  },
];
