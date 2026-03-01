import Link from "next/link";
import React from "react";

export type SocialMediaLink = {
  href: string;
  ariaLabel: string;
  src: string;
  alt: string;
};

type SocialSharingProps = {
  links: SocialMediaLink[];
};

const FooterSocialSharing = ({ links }: SocialSharingProps) => {
  return (
    <div className="flex gap-3">
      {links.map((link, index) => (
        <Link key={index} href={link.href} rel="noreferrer noopener">
          <img className="h-full w-fit" src={link.src} alt={link.alt} />
        </Link>
      ))}
    </div>
  );
};

export default FooterSocialSharing;
