import { useState } from "react";
import type { Person } from "./training";
import { imageToDataUrl } from "./storage";

export function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  const color = person.avatar?.color;
  const rgb = color ? [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) : [];
  const foreground = rgb.length && rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 155 ? "#1b2632" : "#fff";
  return <span className={"avatar " + (small ? "small " : "") + person.id}
    style={color ? { backgroundColor: color, color: foreground } : undefined}>
    {person.avatar?.photo ? <img src={person.avatar.photo} alt="" /> : person.short}
  </span>;
}

const colors = ["#2c3b4d", "#ffb162", "#a35139", "#c9c1b1", "#57786a", "#82709c"];

export function AvatarEditor({ person, onChange, onBusy }: {
  person: Person;
  onChange: (avatar: Person["avatar"]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const chooseColor = (color: string) => onChange({ color });
  return <div className="avatar-editor">
    <div className="avatar-edit-preview">
      <Avatar person={person} />
      <label className="btn soft file-button">
        {busy ? "Загрузка…" : person.avatar?.photo ? "Заменить фото" : "Загрузить фото"}
        <input type="file" accept="image/*" disabled={busy} aria-label="Фото аватара"
          onChange={async (event) => {
            const input = event.currentTarget, file = input.files?.[0];
            if (!file) return;
            setBusy(true); onBusy(true); setError("");
            try {
              const photo = await imageToDataUrl(file, 512);
              if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(photo))
                throw new Error("Не удалось открыть фото. Выберите JPEG или PNG.");
              onChange({ ...person.avatar, photo });
            }
            catch (err) { setError((err as Error).message); }
            finally { input.value = ""; setBusy(false); onBusy(false); }
          }} />
      </label>
    </div>
    <span className="avatar-color-label">Или цвет вместо фото</span>
    <div className="avatar-colors">
      {colors.map((color) => <button key={color} type="button" disabled={busy}
        className="avatar-swatch" style={{ backgroundColor: color }}
        aria-label={"Цвет аватара " + color} aria-pressed={!person.avatar?.photo && person.avatar?.color === color}
        onClick={() => chooseColor(color)} />)}
      <label className="avatar-custom-color" title="Другой цвет">
        <span>+</span>
        <input type="color" aria-label="Другой цвет аватара" disabled={busy}
          value={person.avatar?.color ?? "#2c3b4d"}
          onInput={(event) => chooseColor(event.currentTarget.value)}
          onChange={(event) => chooseColor(event.currentTarget.value)} />
      </label>
    </div>
    {person.avatar && <button className="text" disabled={busy} onClick={() => onChange(undefined)}>Сбросить аватар</button>}
    {error && <p role="alert" className="danger">{error}</p>}
  </div>;
}
