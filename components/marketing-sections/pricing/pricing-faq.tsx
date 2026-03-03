"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

const FAQS = [
  {
    question: "Is there a free trial?",
    answer:
      "We don't offer a free trial at the moment, but you can start with the Credits plan — no subscription required. Buy a small bundle, try the platform, and upgrade when you're ready.",
  },
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time from your account settings. Changes take effect at the start of your next billing cycle. Unused queries do not roll over.",
  },
  {
    question: "What happens when I reach my query limit on the Basic plan?",
    answer:
      "Once you hit your 50-query limit for the month, you won't be able to run new queries until your cycle resets. You can upgrade to Pro at any time for unlimited access, or top up with a Credits bundle.",
  },
  {
    question: "How do credits work?",
    answer:
      "Credits are a pay-as-you-go option — 1 credit equals 1 AI query. Credits are valid for 12 months from purchase. They never expire within that window and can be topped up at any time.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, Amex) as well as SEPA direct debit for European customers. Enterprise invoicing is available for Companies plan customers.",
  },
  {
    question: "Can I use Verdictu across multiple jurisdictions?",
    answer:
      "Basic plan users have access to a limited set of jurisdictions. Pro and Companies plan users have access to all supported jurisdictions. Credits plan users also have full jurisdiction access.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Yes. All queries and documents are encrypted in transit and at rest. We do not use your data to train models. Companies plan customers can request a dedicated data processing agreement (DPA).",
  },
  {
    question: "What does the Companies plan include that Pro doesn't?",
    answer:
      "The Companies plan adds team accounts with role-based access, custom integrations with your existing legal tools, a dedicated account manager, and an SLA guarantee for uptime and response times.",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-black">
      <button
        className="flex w-full items-center justify-between gap-4 py-6 text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="font-semibold">{question}</span>
        <ChevronDown
          className={`size-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-6 text-muted-foreground leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

export default function PricingFaq() {
  return (
    <div className="max-w-[95rem] w-full mx-auto px-4">
      <h2 className="text-subheading mt-4 mb-8 md:mt-12 md:mb-16">
        Frequently Asked Questions
      </h2>
      <div className="border-t border-black">
        {FAQS.map((faq) => (
          <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
        ))}
      </div>
    </div>
  );
}
