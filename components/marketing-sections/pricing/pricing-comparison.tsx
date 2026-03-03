import { Fragment } from "react";

const PLANS = ["Basic", "Pro", "Companies", "Credits"];

type CellValue = string | boolean;

const ROWS: { category?: string; feature: string; values: CellValue[] }[] = [
  // Queries
  { category: "Usage", feature: "AI queries", values: ["50 / month", "Unlimited", "Unlimited", "Pay-per-use"] },
  { feature: "Query rollover", values: [false, false, false, true] },
  { feature: "Credits valid for", values: ["—", "—", "—", "12 months"] },

  // Access
  { category: "Access", feature: "Jurisdictions", values: ["Limited", "All", "All", "All"] },
  { feature: "Source citations", values: [true, true, true, true] },
  { feature: "PDF document analysis", values: [false, true, true, true] },

  // Features
  { category: "Features", feature: "Compare Mode", values: [false, true, true, true] },
  { feature: "Draft Mode templates", values: [false, true, true, true] },
  { feature: "Smart Workflows", values: [false, true, true, false] },
  { feature: "AI Text Editor", values: [false, true, true, false] },
  { feature: "Local & Private AI", values: [false, true, true, false] },

  // Teams
  { category: "Teams", feature: "Team accounts & roles", values: [false, false, true, false] },
  { feature: "Custom integrations", values: [false, false, true, false] },
  { feature: "Dedicated account manager", values: [false, false, true, false] },
  { feature: "SLA guarantee", values: [false, false, true, false] },

  // Support
  { category: "Support", feature: "Support level", values: ["Email", "Priority", "Dedicated", "Standard"] },
  { feature: "Early access to new features", values: [false, true, true, false] },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8L6.5 12.5L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dash() {
  return <span className="text-muted-foreground" aria-label="Not included">—</span>;
}

function Cell({ value, highlighted }: { value: CellValue; highlighted: boolean }) {
  const text = highlighted ? "text-white" : "text-foreground";
  const muted = highlighted ? "text-white/50" : "text-muted-foreground";

  if (typeof value === "boolean") {
    return (
      <td className={`px-4 py-4 text-center border-b ${highlighted ? "border-white/10" : "border-black/10"}`}>
        {value ? (
          <span className={`flex justify-center ${text}`}>
            <Check />
          </span>
        ) : (
          <span className={`flex justify-center ${muted}`}>
            <Dash />
          </span>
        )}
      </td>
    );
  }

  return (
    <td
      className={`px-4 py-4 text-center text-sm border-b ${highlighted ? "border-white/10 text-white" : "border-black/10"} ${value === "—" ? muted : ""}`}
    >
      {value}
    </td>
  );
}

export default function PricingComparison() {
  return (
    <div className="max-w-380 w-full mx-auto px-4 overflow-x-auto">
      <h2 className="text-subheading mt-4 mb-8 md:mt-12 md:mb-16">
        Compare Plans
      </h2>
      <table className="w-full border-collapse border border-black min-w-160">
        <thead>
          <tr>
            <th className="px-4 py-5 text-left text-sm font-semibold uppercase tracking-widest border-b border-black w-[30%]">
              Feature
            </th>
            {PLANS.map((plan, i) => (
              <th
                key={plan}
                className={`px-4 py-5 text-center text-sm font-semibold uppercase tracking-widest border-b border-black ${
                  i === 1 ? "bg-black text-white" : ""
                }`}
              >
                {plan}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, idx) => (
            <Fragment key={idx}>
              {row.category && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-muted border-b border-black"
                  >
                    {row.category}
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-4 py-4 text-sm border-b border-black/10">
                  {row.feature}
                </td>
                {row.values.map((val, i) => (
                  <Cell key={i} value={val} highlighted={i === 1} />
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
