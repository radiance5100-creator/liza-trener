import { useState } from "react";
import type { Exercise } from "./seed";
import { imageToDataUrl } from "./storage";
import { Gallery } from "./Gallery";

export function ExerciseEditor({
  exercise,
  onSave,
  onOpen,
}: {
  exercise: Exercise;
  onSave: (e: Exercise) => void;
  onOpen?: (index: number) => void;
}) {
  const [value, setValue] = useState(() => structuredClone(exercise));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <h2>Упражнение</h2>
      <label className="field">
        <span>Название</span>
        <input
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />
      </label>
      <div className="two-col">
        <label className="field">
          <span>Группа</span>
          <select
            value={value.group}
            onChange={(e) => setValue({ ...value, group: e.target.value })}
          >
            {[
              "Ноги",
              "Спина",
              "Грудь",
              "Плечи",
              "Малые мышечные группы",
              "Бицепс",
              "Трицепс",
              "Икры",
              "Предплечья",
              "Пресс",
            ].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Тип</span>
          <select
            value={value.kind}
            onChange={(e) =>
              setValue({ ...value, kind: e.target.value as Exercise["kind"] })
            }
          >
            <option value="">Без типа</option>
            <option>База</option>
            <option>Доп</option>
          </select>
        </label>
      </div>
      <Gallery
        onOpen={value.images.every((image,index)=>image===exercise.images[index]) ? onOpen : undefined}
        images={value.images.filter((x): x is string => !!x)}
        name={value.name}
      />
      <div className="photo-actions">
        {value.images.map((photo, i) => (
          <div key={i}>
            <label className="btn soft file-button">
              {photo ? "Заменить фото" : "Добавить фото"} {i + 1}
              <input
                disabled={busy}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  setError("");
                  try {
                    const image = await imageToDataUrl(f);
                    setValue((old) => {
                      const next = structuredClone(old);
                      next.images[i] = image;
                      return next;
                    });
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {photo && (
              <button
                className="text"
                onClick={() =>
                  setValue((old) => {
                    const next = structuredClone(old);
                    next.images[i] = null;
                    return next;
                  })
                }
              >
                Убрать фото {i + 1}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <button
        className="btn primary full"
        disabled={busy || !value.name.trim()}
        onClick={() => onSave({ ...value, name: value.name.trim() })}
      >
        {busy ? "Обрабатываем фото…" : "Сохранить изменения"}
      </button>
    </>
  );
}
