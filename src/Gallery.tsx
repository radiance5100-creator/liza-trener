import { useEffect, useRef } from "react";

export function PhotoGrid({
  images,
  name,
  onOpen,
}: {
  images: string[];
  name: string;
  onOpen: (index: number) => void;
}) {
  if (!images.length) return null;
  return (
    <div className="photo-grid">
      {images.slice(0, 2).map((image, i) => (
        <button
          key={i}
          aria-label={`Увеличить скриншот ${i + 1}: ${name}`}
          onClick={() => onOpen(i)}
        >
          <img src={image} alt={`${name}, скриншот ${i + 1}`} />
        </button>
      ))}
    </div>
  );
}

export function Gallery({
  images,
  name,
  initial = 0,
  onOpen,
}: {
  images: string[];
  name: string;
  initial?: number;
  onOpen?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = track.current;
    if (element) element.scrollLeft = initial * element.clientWidth;
  }, [initial]);
  if (!images.length) return null;
  return (
    <div className="gallery" aria-label={`Скриншоты: ${name}`}>
      <div
        className="gallery-track"
        ref={track}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.currentTarget.scrollBy({
              left:
                event.currentTarget.clientWidth *
                (event.key === "ArrowRight" ? 1 : -1),
              behavior: "smooth",
            });
          }
        }}
      >
        {images.map((image, i) => (
          <div className="gallery-slide" key={i}>
            {onOpen ? (
              <button
                aria-label={`Увеличить скриншот ${i + 1}: ${name}`}
                onClick={() => onOpen(i)}
              >
                <img src={image} alt={`${name}, скриншот ${i + 1}`} />
              </button>
            ) : (
              <img src={image} alt={`${name}, скриншот ${i + 1}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
