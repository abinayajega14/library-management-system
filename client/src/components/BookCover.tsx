import { useState } from "react";

interface BookCoverProps {
  coverImage?: string;
  title: string;
  author: string;
  genre: string;
  className?: string;
}

interface CoverTheme {
  backdrop: string;
  cover: string;
  coverShade: string;
  accent: string;
  text: string;
}

const coverThemes: CoverTheme[] = [
  { backdrop: "#e8eee8", cover: "#1d5b50", coverShade: "#123d39", accent: "#e7c982", text: "#f8f4e9" },
  { backdrop: "#eee8e0", cover: "#684758", coverShade: "#3d293f", accent: "#e2b77f", text: "#fbf3e8" },
  { backdrop: "#e5ebef", cover: "#31566a", coverShade: "#1e3448", accent: "#d8bc82", text: "#f2f4ed" },
  { backdrop: "#f0e7dc", cover: "#80503d", coverShade: "#4b302b", accent: "#e8c67a", text: "#fbf2df" },
];

function getCoverTheme(title: string, genre: string): CoverTheme {
  let hash = 0;
  for (const character of `${genre}:${title}`) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return coverThemes[hash % coverThemes.length];
}

export default function BookCover({
  coverImage,
  title,
  author,
  genre,
  className = "",
}: BookCoverProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = coverImage?.trim();

  if (imageUrl && imageUrl !== failedImageUrl) {
    return (
      <img
        alt={`${title} cover`}
        className={className}
        onError={() => setFailedImageUrl(imageUrl)}
        src={imageUrl}
      />
    );
  }

  const theme = getCoverTheme(title, genre);

  return (
    <div
      aria-label={`${title} by ${author}, ${genre} book cover`}
      className={`${className} relative flex h-full w-full items-center justify-center overflow-hidden`}
      role="img"
      style={{
        background: `radial-gradient(circle at 18% 20%, ${theme.accent}55, transparent 38%), ${theme.backdrop}`,
      }}
    >
      <div
        className="relative flex h-[90%] w-[58%] flex-col justify-between overflow-hidden rounded-r-md border border-white/30 p-3 shadow-2xl sm:p-4"
        style={{
          background: `linear-gradient(145deg, ${theme.cover}, ${theme.coverShade})`,
          color: theme.text,
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-3 top-1/4 h-20 w-20 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-2 border-r border-white/10 bg-black/10"
        />
        <span className="relative truncate pl-2 text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
          {genre}
        </span>
        <div className="relative pl-2">
          <div
            aria-hidden="true"
            className="mb-3 h-1 w-8 rounded-full"
            style={{ backgroundColor: theme.accent }}
          />
          <p className="line-clamp-4 break-words font-serif text-sm font-bold leading-tight sm:text-base">
            {title}
          </p>
        </div>
        <div className="relative border-t border-white/25 pl-2 pt-2">
          <p className="line-clamp-2 text-[9px] leading-snug opacity-85">{author}</p>
          <p className="mt-2 text-[7px] font-semibold uppercase tracking-[0.18em] opacity-70">
            Shelfwise library
          </p>
        </div>
      </div>
    </div>
  );
}
