import { createContext, useContext, useState } from "react";
import { DayPicker, DayButton, type DayButtonProps } from "@daypicker/react";
import { ru } from "@daypicker/react/locale";
import "@daypicker/react/style.css";
import { iso, type Appointment, type Store } from "./training";

const Events = createContext<Record<string, Appointment[]>>({});

function TrainingDay(props: DayButtonProps) {
  const events = useContext(Events)[iso(props.day.date)] ?? [];
  return (
    <DayButton {...props}>
      <span className="calendar-number">{props.day.date.getDate()}</span>
      {events.length > 0 && (
        <span className="calendar-count" aria-hidden="true">
          {events.length}
        </span>
      )}
    </DayButton>
  );
}

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
  const selected = new Date(date + "T12:00:00");
  const [month, setMonth] = useState(selected);
  const events: Record<string, Appointment[]> = {};
  store.appointments
    .filter((a) => !a.awaitingSchedule && a.status !== "cancelled")
    .forEach((a) => {
      (events[a.date] ??= []).push(a);
    });
  return (
    <section className="calendar" aria-label="Календарь тренировок">
      <Events.Provider value={events}>
        <DayPicker
          mode="single"
          required
          selected={selected}
          today={new Date(today + "T12:00:00")}
          onSelect={(d) => {
            if (d) {
              onChange(iso(d));
              setMonth(d);
            }
          }}
          month={month}
          onMonthChange={setMonth}
          locale={ru}
          weekStartsOn={1}
          showOutsideDays
          navLayout="after"
          components={{ DayButton: TrainingDay }}
          labels={{
            labelPrevious: () => "Предыдущий месяц календаря",
            labelNext: () => "Следующий месяц календаря",
            labelDayButton: (d, modifiers) => {
              const sessions = events[iso(d)] ?? [];
              return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}${modifiers.today ? ", сегодня" : ""}${modifiers.selected ? ", выбрано" : ""}${sessions.length ? ". Занятий: " + sessions.length + ". " + sessions.map((a) => `${a.time || "Без времени"}: ${a.participants.map((p) => store.people.find((x) => x.id === p.personId)?.name).join(" + ")}`).join("; ") : ""}`;
            },
          }}
        />
      </Events.Provider>
    </section>
  );
}
