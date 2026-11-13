import { useState } from "react";

interface BookCoverProps {
  coverImage?: string;
  title: string;
  className?: string;
}

export default function BookCover({ coverImage, title, className = "" }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const source = coverImage && !failed ? coverImage : "/default-cover.svg";

  return (
    <img
      alt={`${title} cover`}
      className={className}
      onError={() => setFailed(true)}
      src={source}
    />
  );
}
