import { Search, Check, Users } from "lucide-react";
import {
  oneOffParticipant,
  scheduleTimes,
  type Appointment,
  type Store,
} from "./training";
export type ScheduleDraft = Appointment & {
  quick: boolean;
  editing: boolean;
  pair: boolean;
  manualTime: boolean;
  changeDate: boolean;
  peopleQuery: string;
};

export function ScheduleFields({
  store,
  draft,
  onChange,
}: {
  store: Store;
  draft: ScheduleDraft;
  onChange: (value: Partial<ScheduleDraft>) => void;
}) {
  const booked = store.appointments.filter(
    (a) =>
      a.date === draft.date && !a.awaitingSchedule && a.status !== "cancelled" && a.id !== draft.id,
  );
  const names = (a: Appointment) =>
    a.participants
      .map((p) => store.people.find((x) => x.id === p.personId)?.name)
      .join(" + ");
  const atTime = booked.filter((a) => a.time === draft.time);
  const people = store.people.filter((p) =>
    p.name
      .toLocaleLowerCase("ru")
      .includes(draft.peopleQuery.toLocaleLowerCase("ru")),
  );
  return (
    <div className="schedule-fields">
      {!draft.quick && (
        <div className="schedule-date">
          <strong>
            {new Date(draft.date + "T12:00:00").toLocaleDateString("ru-RU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </strong>
          <button
            className="text"
            aria-expanded={draft.changeDate}
            onClick={() => onChange({ changeDate: !draft.changeDate })}
          >
            Другая дата
          </button>
        </div>
      )}
      {!draft.quick && draft.changeDate && (
        <label className="field">
          <span>Дата</span>
          <input
            aria-label="Дата занятия"
            type="date"
            value={draft.date}
            onInput={(e) => {
              if (e.currentTarget.value)
                onChange({ date: e.currentTarget.value });
            }}
            onChange={(e) => {
              if (e.target.value) onChange({ date: e.target.value });
            }}
          />
        </label>
      )}
      <div className="row between schedule-section">
        <strong>Клиент</strong>
        <button
          className={"text pair-toggle " + (draft.pair ? "selected" : "")}
          aria-pressed={draft.pair}
          onClick={() =>
            onChange({
              pair: !draft.pair,
              participants: draft.pair
                ? draft.participants.slice(0, 1)
                : draft.participants,
            })
          }
        >
          <Users size={16} />
          Парное
        </button>
      </div>
      {store.people.length > 6 && (
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Найти клиента для записи"
            placeholder="Найти клиента"
            value={draft.peopleQuery}
            onChange={(e) => onChange({ peopleQuery: e.target.value })}
          />
        </div>
      )}
      <div className="schedule-people">
        {people.map((p) => {
          const chosen = draft.participants.some((x) => x.personId === p.id);
          return (
            <button
              key={p.id}
              aria-pressed={chosen}
              className={chosen ? "selected" : ""}
              disabled={
                draft.pair && !chosen && draft.participants.length === 2
              }
              onClick={() =>
                onChange({
                  participants: draft.pair
                    ? chosen
                      ? draft.participants.filter((x) => x.personId !== p.id)
                      : [...draft.participants, oneOffParticipant(p.id)]
                    : [
                        draft.participants.find((x) => x.personId === p.id) ??
                          oneOffParticipant(p.id),
                      ],
                })
              }
            >
              <span>{p.name}</span>
              {chosen && <Check size={16} />}
            </button>
          );
        })}
      </div>
      {!people.length && <p className="muted">Клиент не найден</p>}
      {!draft.quick && (
        <>
          <div className="row between schedule-section">
            <strong>Время</strong>
            <button
              className="text"
              aria-expanded={draft.manualTime}
              onClick={() => onChange({ manualTime: !draft.manualTime })}
            >
              Другое время
            </button>
          </div>
          <div
            className="schedule-times"
            aria-label="Время занятия с 08:00 до 20:00"
          >
            {scheduleTimes.map((time) => {
              const taken = booked.filter((a) => a.time === time);
              return (
                <button
                  key={time}
                  className={
                    (draft.time === time ? "selected " : "") +
                    (taken.length ? "booked" : "")
                  }
                  aria-pressed={draft.time === time}
                  aria-label={
                    time +
                    (taken.length
                      ? ", есть запись: " + taken.map(names).join("; ")
                      : "")
                  }
                  onClick={() => onChange({ time, manualTime: false })}
                >
                  <span>{time}</span>
                  {taken.length > 0 && <small>Есть запись</small>}
                </button>
              );
            })}
          </div>
          {draft.manualTime && (
            <label className="field">
              <span>Время</span>
              <input
                aria-label="Другое время занятия"
                type="time"
                value={draft.time}
                onInput={(e) => onChange({ time: e.currentTarget.value })}
                onChange={(e) => onChange({ time: e.target.value })}
              />
            </label>
          )}
          {atTime.length > 0 && (
            <p className="schedule-conflict" role="status">
              На {draft.time} уже записаны: {atTime.map(names).join("; ")}
            </p>
          )}
          {booked.length > 0 && (
            <details className="schedule-bookings">
              <summary>Записи на этот день · {booked.length}</summary>
              {[...booked]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((a) => (
                  <div key={a.id}>
                    <strong>{a.time || "Без времени"}</strong>
                    <span>{names(a)}</span>
                  </div>
                ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
