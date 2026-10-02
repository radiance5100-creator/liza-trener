import { useRef, useState } from "react";
import { GripVertical, Replace, Trash2, Plus } from "lucide-react";
import type { Exercise } from "./seed";
import type { Participant } from "./training";

export function Preparation({
  participant,
  exercises,
  onChange,
  onReplace,
  onAdd,
  onRemove,
}: {
  participant: Participant;
  exercises: Exercise[];
  onChange: (ids: string[]) => void;
  onReplace: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const drag = useRef<{ from: number; to: number } | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const ids = participant.entries.map((e) => e.id);
  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  }
  return (
    <>
      <div className="preparation-list">
        {participant.entries.map((e, i) => {
          const image = exercises
            .find((x) => x.id === e.id)
            ?.images.find(Boolean);
          return (
            <article
              className={
                "edit-row preparation-row" +
                (dropIndex === i ? " drop-target" : "")
              }
              data-preparation-index={i}
              key={e.id}
            >
              <button
                className="icon drag-handle"
                aria-label={`Переместить: ${e.name}`}
                onPointerDown={(event) => {
                  drag.current = { from: i, to: i };
                  setDropIndex(i);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (!drag.current) return;
                  const target = document
                    .elementFromPoint(event.clientX, event.clientY)
                    ?.closest<HTMLElement>("[data-preparation-index]");
                  if (target) {
                    drag.current.to = Number(target.dataset.preparationIndex);
                    setDropIndex(drag.current.to);
                  }
                  if (event.clientY < 80) window.scrollBy(0, -20);
                  else if (event.clientY > window.innerHeight - 100)
                    window.scrollBy(0, 20);
                }}
                onPointerUp={() => {
                  if (drag.current) move(drag.current.from, drag.current.to);
                  drag.current = null;
                  setDropIndex(null);
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  setDropIndex(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    event.preventDefault();
                    move(i, i + (event.key === "ArrowUp" ? -1 : 1));
                  }
                }}
              >
                <GripVertical size={18} />
              </button>
              <div className="mini-photo">
                {image && <img src={image} alt="" />}
              </div>
              <div className="preparation-name">
                <strong>{e.name}</strong>
                <button className="text" onClick={() => onReplace(e.id)}>
                  <Replace size={15} />
                  Заменить
                </button>
              </div>
              <button
                className="icon"
                aria-label={`Удалить: ${e.name}`}
                onClick={() => onRemove(e.id)}
              >
                <Trash2 size={17} />
              </button>
            </article>
          );
        })}
      </div>
      {!ids.length && (
        <p className="muted">
          Выберите день программы или добавьте упражнения из библиотеки.
        </p>
      )}
      <div className="sticky-action">
        <button className="btn primary full" onClick={onAdd}>
          <Plus size={18} />
          Добавить упражнения
        </button>
      </div>
    </>
  );
}
