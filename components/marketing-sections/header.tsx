import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import DesktopNav from "../marketing-general/desktop-nav";
import MobileNav from "../marketing-general/mobile-nav";

export default function Header() {
  return (
    <header className="flex flex-col justify-between max-w-[95rem] w-full mx-auto px-4 md:pt-8 pt-4 lg:pb-4 md:pb-4 sm:pb-2 xs:pb-2">
      <div className="flex">
        <div className="flex flex-1">
          <Link href="/" aria-label="Return to homepage">
            <img
              className="h-full w-fit"
              src="/icons/verdictu-black.svg"
              alt="logo"
            />
          </Link>
        </div>
        <Sheet>
          <SheetTrigger aria-labelledby="button-label">
            <span id="button-label" hidden>
              Menu
            </span>
            <svg
              aria-hidden="true"
              className="md:hidden"
              width="25"
              height="16"
              viewBox="0 0 25 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="25" height="4" fill="black" />
              <rect y="6" width="25" height="4" fill="black" />
              <rect y="12" width="25" height="4" fill="black" />
            </svg>
          </SheetTrigger>
          <SheetContent
            side="top"
            className="w-full pt-14"
            aria-label="Menu Toggle"
          >
            <MobileNav />
          </SheetContent>
        </Sheet>
        <DesktopNav />
      </div>
      <hr className="border-black border-t-0 border mt-4" />
    </header>
  );
}
