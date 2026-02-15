import menu from "@/data/menu";
import Link from "next/link";
import SocialSharing from "./social-sharing";

const MobileNav = () => {
  return (
    <nav
      className="flex flex-col flex-1 justify-end gap-6"
      aria-labelledby="mobile-nav"
    >
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
