"use client";

import { useEffect, useRef, useState } from "react";
import type { SuccessStoryType } from "@/utils/getSuccessStories";

const SLIDE_DURATION = 6000;

export default function SuccessStoriesCarousel({
  stories,
}: {
  stories: SuccessStoryType[];
}) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % stories.length);
    }, SLIDE_DURATION);
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (index: number) => {
    setCurrent(index);
    startTimer();
  };

  const story = stories[current];
  const total = stories.length;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="border border-black max-w-[95rem] w-full mx-auto">
      {/* Header: counter + prev/next */}
      <div className="flex items-center justify-between px-8 md:px-12 py-4 border-b border-black bg-[#f8a100]">
        <p className="font-semibold uppercase tracking-widest text-sm">
          {pad(current + 1)}&nbsp;/&nbsp;{pad(total)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => goTo((current - 1 + total) % total)}
            className="group w-10 h-10 border border-black flex items-center justify-center hover:bg-black transition"
            aria-label="Previous story"
          >
            <img
              className="w-4 h-4 rotate-180 group-hover:invert transition"
              src="/icons/ri_arrow-right-line.svg"
              alt=""
            />
          </button>
          <button
            onClick={() => goTo((current + 1) % total)}
            className="group w-10 h-10 border border-black flex items-center justify-center hover:bg-black transition"
            aria-label="Next story"
          >
            <img
              className="w-4 h-4 group-hover:invert transition"
              src="/icons/ri_arrow-right-line.svg"
              alt=""
            />
          </button>
        </div>
      </div>

      {/* Story content — key forces remount so fade-in restarts each slide */}
      <div
        key={current}
        className="grid grid-cols-1 md:grid-cols-[2fr_1fr] ss-fade-in"
      >
        {/* Quote */}
        <div className="p-8 md:p-12 border-b border-black md:border-b-0 md:border-r">
          <span className="px-3 py-1.5 bg-[#f8a100] border border-black rounded-full inline-block mb-8">
            <p className="uppercase text-sm font-semibold ">{story.category}</p>
          </span>
          <blockquote className="text-blog-quote">
            &ldquo;{story.quote}&rdquo;
          </blockquote>
        </div>

        {/* Person + outcome */}
        <div className="p-8 md:p-12 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-lg">{story.name}</p>
            <p>{story.role}</p>
          </div>
          <div className="flex flex-col gap-2 pt-6 border-t border-black">
            <p className="uppercase font-semibold tracking-widest text-sm">
              Outcome
            </p>
            <p className="heading3-title">{story.outcome}</p>
          </div>
        </div>
      </div>

      {/* Progress indicator bars */}
      <div className="flex border-t border-black">
        {stories.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className="relative flex-1 h-1.5 bg-white overflow-hidden cursor-pointer"
            aria-label={`Go to story ${idx + 1}`}
          >
            {idx < current && <span className="absolute inset-0 bg-black" />}
            {idx === current && (
              <span
                key={current}
                className="absolute inset-y-0 left-0 bg-black ss-progress-bar"
              />
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes ss-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .ss-progress-bar {
          animation: ss-progress ${SLIDE_DURATION}ms linear forwards;
        }
        @keyframes ss-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ss-fade-in {
          animation: ss-fade-in 0.35s ease forwards;
        }
      `}</style>
    </div>
  );
}
