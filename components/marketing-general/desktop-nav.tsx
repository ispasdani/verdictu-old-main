import menu from "@/data/menu";
import { products } from "@/data/products";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import SocialSharing from "./social-sharing";

const DesktopNav = () => {
  return (
    <nav
      className="flex-1 items-center justify-end gap-6 hidden md:flex"
      aria-labelledby="desktop-nav"
    >
      {/* Products hover dropdown */}
      <div className="relative group/products">
        <button className="flex items-center gap-1 cursor-pointer">
          Products
          <ChevronDown className="size-3.5 transition-transform duration-200 group-hover/products:rotate-180" />
        </button>

        {/* pt-3 bridges the visual gap so hover stays active while moving mouse down */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 pointer-events-none group-hover/products:opacity-100 group-hover/products:pointer-events-auto transition-opacity duration-150 z-50">
          <div className="w-140 rounded-xl border border-border bg-background p-3 shadow-xl">
            <div className="grid grid-cols-2 gap-1">
              {products.map((product) => (
                <Link
                  key={product.href}
                  href={product.href}
                  className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted transition-colors group/card"
                >
                  <div className="mt-0.5 shrink-0 text-muted-foreground group-hover/card:text-foreground transition-colors">
                    {product.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium leading-none">
                      {product.title}
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {product.description}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
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

export default DesktopNav;
