import Link from "next/link";

const PLANS = [
  {
    id: "basic",
    label: "Basic",
    price: "€9",
    period: "per month, billed annually",
    periodAlt: "or €12 month-to-month",
    description:
      "For individuals who need occasional legal clarity without the complexity.",
    features: [
      "50 AI queries per month",
      "Jurisdiction-locked answers",
      "Source citations included",
      "Email support",
    ],
    cta: "Get started",
    href: "/signup?plan=basic",
    highlighted: false,
  },
  {
    id: "pro",
    label: "Pro",
    badge: "Most popular",
    price: "€29",
    period: "per month, billed annually",
    periodAlt: "or €35 month-to-month",
    description: "For professionals who rely on legal intelligence every day.",
    features: [
      "Unlimited AI queries",
      "All jurisdictions",
      "Source citations included",
      "PDF document analysis",
      "Priority support",
      "Early access to new features",
    ],
    cta: "Get started",
    href: "/signup?plan=pro",
    highlighted: true,
  },
  {
    id: "companies",
    label: "Companies",
    price: "Custom",
    period: "pricing tailored to your team",
    periodAlt: "",
    description:
      "For legal teams and organisations that need scalable, integrated access.",
    features: [
      "Everything in Pro",
      "Team accounts & roles",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact us",
    href: "/contact",
    highlighted: false,
  },
  {
    id: "credits",
    label: "Credits",
    price: "From €5",
    period: "per credit bundle",
    periodAlt: "",
    description:
      "No subscription. Buy credits when you need them and use them at your own pace.",
    features: [
      "No monthly commitment",
      "1 credit = 1 AI query",
      "Credits valid for 12 months",
      "Source citations included",
      "Top up anytime",
    ],
    cta: "Buy credits",
    href: "/credits",
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 max-w-[95rem] w-full mx-auto border border-black">
      {PLANS.map((plan, idx) => {
        const isLast = idx === PLANS.length - 1;
        const isHighlighted = plan.highlighted;

        const borderClasses = isLast
          ? ""
          : "border-b border-black xl:border-b-0 xl:border-r " +
            (isHighlighted ? "border-white/20" : "");

        return (
          <article
            key={plan.id}
            className={[
              "p-8 xl:p-10 flex flex-col justify-between gap-8",
              borderClasses,
              isHighlighted ? "bg-black text-white" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {/* Top: label + badge */}
            <div className="flex flex-col gap-6">
              <div className="flex items-start justify-between gap-4">
                <p
                  className={`uppercase font-semibold tracking-widest text-sm ${isHighlighted ? "text-white" : ""}`}
                >
                  {plan.label}
                </p>
                {plan.badge && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest border shrink-0 ${
                      isHighlighted ? "border-white text-white" : "border-black"
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}
              </div>

              {/* Price */}
              <div>
                <p className="text-blog-quote">{plan.price}</p>
                <p
                  className={`text-sm mt-1 ${isHighlighted ? "text-white/70" : ""}`}
                >
                  {plan.period}
                </p>
                {plan.periodAlt && (
                  <p
                    className={`text-sm ${isHighlighted ? "text-white/50" : "text-muted-foreground"}`}
                  >
                    {plan.periodAlt}
                  </p>
                )}
              </div>

              {/* Description */}
              <p>{plan.description}</p>

              {/* Feature list */}
              <ul
                className={`flex flex-col gap-3 pt-6 border-t ${isHighlighted ? "border-white/20" : "border-black"}`}
              >
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="font-semibold shrink-0">—</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <Link
              href={plan.href}
              className={`block text-center px-6 py-3 border font-semibold uppercase tracking-widest text-sm transition ${
                isHighlighted
                  ? "border-white text-white hover:bg-white hover:text-black"
                  : "border-black hover:bg-black hover:text-white"
              }`}
            >
              {plan.cta}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
