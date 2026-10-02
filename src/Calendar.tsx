import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { iso, type Store } from "./training";

export function Calendar({
  store,
  date,
  today,
  onChange,
}: {
  store: Store;
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const [month, setMonth] = useState(date.slice(0, 7));
  const first = new Date(month + "-01T12:00:00");
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  const move = (n: number) => {
    const d = new Date(first);
    d.setMonth(d.getMonth() + n);
    setMonth(iso(d).slice(0, 7));
  };
  return (
    <section className="calendar" aria-label="Календарь тренировок">
      <div className="row between calendar-title">
        <button
          className="icon"
          aria-label="Предыдущий месяц календаря"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <strong>
          {first.toLocaleDateString("ru-RU", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <button
          className="icon"
          aria-label="Следующий месяц календаря"
          onClick={() => move(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <span className="calendar-weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from(
          { length: Math.ceil((offset + length) / 7) * 7 },
          (_, i) => {
            const d = new Date(first);
            d.setDate(i - offset + 1);
            const key = iso(d),
              outside = d.getMonth() !== first.getMonth();
            const events = store.appointments
              .filter((a) => a.date === key && a.status !== "cancelled")
              .sort((a, b) => a.time.localeCompare(b.time));
            const descriptions = events.map(
              (a) =>
                `${a.time || "Без времени"}: ${a.participants.map((p) => store.people.find((x) => x.id === p.personId)?.name).join(" + ")}`,
            );
            return (
              <button
                key={key}
                className={`calendar-day ${key === date ? "selected" : ""} ${outside ? "outside" : ""} ${key === today ? "is-today" : ""}`}
                aria-pressed={key === date}
                aria-current={key === today ? "date" : undefined}
                aria-label={`${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}${descriptions.length ? ". " + descriptions.join("; ") : ""}`}
                onClick={() => {
                  onChange(key);
                  if (outside) setMonth(key.slice(0, 7));
                }}
              >
                <b>{d.getDate()}</b>
                {events.slice(0, 2).map((a) => (
                  <span
                    key={a.id}
                    className={`calendar-event ${a.status}`}
                    title={descriptions[events.indexOf(a)]}
                  >
                    {a.time || "•"}
                  </span>
                ))}
                {events.length > 2 && <small>+{events.length - 2}</small>}
              </button>
            );
          },
        )}
      </div>
      <button
        className="text calendar-today"
        onClick={() => {
          setMonth(today.slice(0, 7));
          onChange(today);
        }}
      >
        Сегодня
      </button>
    </section>
  );
}
