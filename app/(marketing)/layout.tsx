import Footer from "@/components/marketing-sections/footer";
import Header from "@/components/marketing-sections/header";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
