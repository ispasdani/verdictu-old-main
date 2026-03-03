import Pricing from "@/components/marketing-sections/pricing/pricing";
import PricingLoading from "@/components/marketing-sections/pricing/pricing-loading";
import PricingComparison from "@/components/marketing-sections/pricing/pricing-comparison";
import PricingFaq from "@/components/marketing-sections/pricing/pricing-faq";
import { Suspense } from "react";

export const metadata = {
  title: "Pricing | Verdictu",
  description: "Simple, transparent pricing for individuals, professionals, and teams.",
};

export default function PricingPage() {
  return (
    <main>
      <div className="max-w-[95rem] w-full mx-auto px-4">
        <h1 className="text-subheading mt-4 mb-4 md:mt-12">Pricing</h1>
        <p className="text-muted-foreground mb-8 md:mb-16 max-w-xl">
          Simple, transparent pricing. No hidden fees. Cancel or change plans at any time.
        </p>
      </div>

      <Suspense fallback={<PricingLoading />}>
        <Pricing />
      </Suspense>

      <PricingComparison />

      <PricingFaq />
    </main>
  );
}
