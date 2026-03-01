"use client";

import news from "@/json/news.json";

export default function FooterNewsTicker() {
  const animationDuration = 20;

  // We duplicate the news array to create the seamless loop effect
  // [Item 1, Item 2, Item 3, Item 1, Item 2, Item 3]
  const tickerContent = [...news, ...news];

  return (
    <div className="flex bg-black text-white py-5 w-full mx-auto relative overflow-hidden">
      {/* Static Label */}
      <div className="bg-black z-10 px-6">
        <span className="flex gap-2 bg-black font-semibold text-2xl uppercase whitespace-nowrap">
          <p>News</p>
          <p className="block sm:hidden">+++</p>
          <p className="hidden sm:block">Ticker +++</p>
        </span>
      </div>

      {/* Animated Container */}
      <div
        className="flex gap-4 sliding-ticker relative"
        style={{
          // We create a custom property for the duration to use in the keyframes
          // We define the animation inline here
          animation: `ticker ${animationDuration}s linear infinite`,
        }}
      >
        <style>
          {`
            @keyframes ticker {
              0% { transform: translateX(0); }
              /* We move -50% because the list is double the length now. 
                 Moving 50% of the total width equals exactly one full loop of the original content. */
              100% { transform: translateX(-50%); }
            }
          `}
        </style>

        {tickerContent.map((newsItem, index) => {
          // We need to check if this specific item is the last one of a "set"
          // (either the end of the first set or the end of the second set)
          const isLastInSet = (index + 1) % news.length === 0;

          return (
            <div
              key={index}
              className={`whitespace-nowrap text-xl font-semibold ${
                isLastInSet ? "overflow-visible" : "overflow-hidden"
              }`}
              style={{ right: isLastInSet ? "0" : "" }}
            >
              <p>{newsItem}+++</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
