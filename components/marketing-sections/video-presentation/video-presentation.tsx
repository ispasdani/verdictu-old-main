"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause } from "lucide-react";

import { useArticleContext } from "@/context/article-context";
import {
  getAllArticlesWithAuthors,
  getHeroImage,
  parseHumanDate,
} from "@/utils/article-utils";

export default function VideoPresentation() {
  const { data } = useArticleContext();

  const latest = useMemo(() => {
    const all = getAllArticlesWithAuthors(data);
    return all[0];
  }, [data]);

  const latestArticle = latest.article;
  console.log(latestArticle);
  const poster = getHeroImage(latestArticle);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      try {
        await v.play();
        setIsPlaying(true);
      } catch {
        // autoplay/play can fail on some browsers until user interacts;
        // click is an interaction, but we still keep this guard.
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex flex-col-reverse sm:flex-col gap-6 md:gap-12 py-6 md:py-10 max-w-[95rem] w-full mx-auto px-4 lg:pt-0">
      <article className="flex flex-col-reverse sm:flex-col gap-6 md:gap-12">
        <article className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
          <h2 className="text-subtitle">
            <Link href={`/magazine/${latestArticle.slug}`}>
              {latestArticle.title}
            </Link>
          </h2>

          <article className="flex flex-col justify-between gap-2">
            <p>{latestArticle.description}</p>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                <span className="flex flex-wrap">
                  <p className="font-semibold pr-2">Text</p>
                  <p>{latest.authorName}</p>
                </span>

                <span className="flex flex-wrap">
                  <p className="font-semibold pr-2">Date</p>
                  <time dateTime={latestArticle.date}>
                    {latestArticle.date}
                  </time>
                </span>

                <span className="flex flex-wrap">
                  <p className="font-semibold pr-2">Read</p>
                  <p>{latestArticle.read}</p>
                </span>
              </div>

              <span className="px-3 py-2 border border-black rounded-full w-fit">
                <p className="uppercase">{latestArticle.label}</p>
              </span>
            </div>
          </article>
        </article>

        {/* VIDEO */}
        <div className="relative w-full aspect-[9/6] overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-cover cursor-pointer"
            src={latestArticle.video}
            poster={poster}
            playsInline
            muted
            loop
            autoPlay
            preload="metadata"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Overlay play/pause button */}
          <button
            type="button"
            onClick={togglePlay}
            className="absolute bottom-4 left-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/90 hover:bg-white transition shadow"
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
        </div>
      </article>
    </div>
  );
}
