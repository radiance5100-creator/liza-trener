import { useState, useRef, useEffect } from "react";
import {
  CalendarDays,
  Users,
  Dumbbell,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Plus,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Clock3,
  Play,
  Search,
  GripVertical,
  Copy,
  Replace,
  Trash2,
  CircleHelp,
  CheckCircle2,
  BookOpen,
  Archive,
} from "lucide-react";
import type { Exercise } from "./seed";
import { Calendar } from "./Calendar";
import { Gallery, PhotoGrid } from "./Gallery";
import { Preparation } from "./Preparation";
import { ExerciseEditor } from "./ExerciseEditor";
import {
  loadTraining,
  saveTraining,
  importTraining,
  getRecovery,
} from "./training-db";
import {
  uid,
  iso,
  format,
  newProgram,
  entry,
  participant,
  appointment,
  finish,
  startAppointment,
  oneOffParticipant,
  addWorkoutExercises,
  confirmEntry,
  prepareExercises,
  prepareDay,
  prepareMode,
  correctResult,
  removePerson,
  resultHistory,
  migrate,
  type Day,
  type Program,
  type Person,
  type Participant,
  type Appointment,
  type Store,
} from "./training";
import { InstallHelp } from "./InstallHelp";
import "./trainer.css";

type Route = {
  page: string;
  person?: string;
  program?: string;
  day?: string;
  appointment?: string;
};
const dayOffset = (value: string, offset: number) => {
  const date = new Date(value + "T12:00:00");
  date.setDate(date.getDate() + offset);
  return iso(date);
};
const labelDate = (
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) => new Date(date + "T12:00:00").toLocaleDateString("ru-RU", options);
const sections = [
  "Ноги",
  "Спина",
  "Грудь",
  "Плечи",
  "Малые мышечные группы",
  "Пресс",
];
const quantity = (
  n: number,
  forms = ["упражнение", "упражнения", "упражнений"],
) =>
  `${n} ${forms[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 1 : 2]}`;
const section = (group: string) =>
  ["Бицепс", "Трицепс", "Икры", "Предплечья"].includes(group)
    ? sections[4]
    : group;
export function Avatar({
  person,
  small = false,
}: {
  person: Person;
  small?: boolean;
}) {
  return (
    <span className={"avatar " + (small ? "small " : "") + person.id}>
      {person.short}
    </span>
  );
}
function Picture({ exercise }: { exercise: Exercise }) {
  const photo = exercise.images.find(Boolean);
  return (
    <div className="mini-photo">
      {photo ? <img src={photo} alt="" /> : <Dumbbell size={19} />}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<Store | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    loadTraining()
      .then(setData)
      .catch((e) => setError(String(e.message)));
  }, []);
  if (!data)
    return (
      <div className="device">
        <main>
          <h1>Мой темп</h1>
          <p role="status">{error || "Загружаем ваши тренировки…"}</p>
          {error && (
            <>
              <p>
                Исходные данные сохранены. Скачайте их перед восстановлением.
              </p>
              <button
                className="btn primary"
                onClick={async () =>
                  download(await getRecovery(), "vosstanovlenie.json")
                }
              >
                Скачать исходные данные
              </button>
              <button className="btn soft" onClick={() => location.reload()}>
                Повторить
              </button>
            </>
          )}
        </main>
      </div>
    );
  return <Trainer initial={data} />;
}
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Trainer({ initial }: { initial: Store }) {
  const [today, setToday] = useState(iso());
  useEffect(() => {
    const id = setInterval(() => setToday(iso()), 30000);
    return () => clearInterval(id);
  }, []);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveSequence = useRef(0);
  const [lightbox, setLightbox] = useState<{
    id: string;
    index: number;
  } | null>(null);
  const ex = (id: string) => store.exercises.find((e) => e.id === id)!;
  const photos = (id: string) => (
    <PhotoGrid
      key={id}
      images={ex(id).images.filter((x): x is string => !!x)}
      name={ex(id).name}
      onOpen={(index) => setLightbox({ id, index })}
    />
  );
  const [importValue, setImportValue] = useState<Store | null>(null);
  const scrollAfterConfirm = useRef(false);
  const [store, setStore] = useState<Store>(initial);
  const [route, setRoute] = useState<Route>({ page: "today" });
  const [date, setDate] = useState(today);
  const [personTab, setPersonTab] = useState("Обзор");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("Все");
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState("");
  const [undo, setUndo] = useState<((next: Store) => void) | null>(null);
  const drag = useRef<{ from: number; to: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Saving state tracks completion of an external IndexedDB transaction.
  useEffect(() => {
    const seq = ++saveSequence.current;
    // oxlint-disable-next-line react/set-state-in-effect
    setSaving(true);
    saveTraining(store)
      .then(() => {
        if (seq === saveSequence.current) {
          setSaveError("");
          setSaving(false);
        }
      })
      .catch(() => {
        setSaving(false);
        setSaveError(
          "Не удалось сохранить на телефоне. Скачайте резервную копию, прежде чем закрывать приложение.",
        );
      });
  }, [store]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saving || saveError) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving, saveError]);
  const modalType = modal?.type,
    lightboxOpen = !!lightbox;
  useEffect(() => {
    if (!modalType && !lightboxOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      lightboxOpen ? ".lightbox" : ".sheet",
    );
    const main = document.querySelector<HTMLElement>("main");
    const nav = document.querySelector<HTMLElement>(".bottom-nav");
    if (main) main.inert = true;
    if (nav) nav.inert = true;
    const nodes = () => [
      ...dialog!.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
      ),
    ];
    (dialog?.querySelector<HTMLElement>("[autofocus]") ?? nodes()[0])?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        setModal(null);
      }
      if (e.key === "Tab") {
        const ns = nodes();
        if (e.shiftKey && document.activeElement === ns[0]) {
          e.preventDefault();
          ns.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === ns.at(-1)) {
          e.preventDefault();
          ns[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      if (main) main.inert = false;
      if (nav) nav.inert = false;
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [modalType, lightboxOpen]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  useEffect(() => {
    document.body.style.overflow = modal || lightbox ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modal, lightbox]);
  const mutate = (fn: (next: Store) => void) =>
    setStore((old) => {
      const next = structuredClone(old);
      fn(next);
      return next;
    });
  const person = store.people.find((p) => p.id === route.person);
  const program = person?.programs.find((p) => p.id === route.program);
  const day = program?.days.find((d) => d.id === route.day);
  const current = store.appointments.find((a) => a.id === route.appointment);
  const activeParticipant = current?.participants[current.selected];
  const participantPosition = useRef(0);
  const scrollPosition = activeParticipant?.scroll ?? 0;
  useEffect(() => {
    participantPosition.current = scrollPosition;
  }, [scrollPosition]);
  useEffect(() => {
    if (route.page !== "workout") return;
    const position = participantPosition.current;
    requestAnimationFrame(() => window.scrollTo(0, position));
    let pending: ReturnType<typeof setTimeout> | undefined;
    const scroll = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const y = Math.max(0, window.scrollY);
        mutate((next) => {
          const a = next.appointments.find((a) => a.id === route.appointment);
          if (a) a.participants[a.selected].scroll = y;
        });
      }, 200);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      clearTimeout(pending);
      window.removeEventListener("scroll", scroll);
    };
  }, [route.page, route.appointment, current?.selected]);
  const personById = (id: string) => store.people.find((p) => p.id === id)!;
  function flash(message: string) {
    if (!["Занятие удалено", "Упражнение убрано"].includes(message))
      setUndo(null);
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setToast("");
      setUndo(null);
    }, 6000);
  }
  function go(next: Route) {
    setRoute(next);
    setModal(null);
    setSearch("");
    setGroup("Все");
    window.scrollTo(0, 0);
  }
  function editProgram(fn: (program: Program) => void) {
    mutate((next) =>
      fn(
        next.people
          .find((p) => p.id === route.person)!
          .programs.find((p) => p.id === route.program)!,
      ),
    );
  }
  function newSchedule(quick = false, existing?: Appointment) {
    const sample =
      existing ??
      appointment(
        store,
        person ? [person.id] : ["self"],
        new Date().toTimeString().slice(0, 5),
      );
    setModal({
      type: "schedule",
      ...structuredClone(sample),
      participants: existing
        ? structuredClone(existing.participants)
        : sample.participants.map((p) => oneOffParticipant(p.personId)),
      date: existing?.date ?? date,
      quick,
      editing: !!existing,
    });
  }
  function start(id: string) {
    try {
      const next = structuredClone(store);
      const actual = startAppointment(next, id);
      setStore(next);
      go({ page: "workout", appointment: actual });
      if (actual !== id)
        flash("У участника уже есть тренировка. Продолжаем её.");
    } catch (e) {
      flash((e as Error).message);
    }
  }
  function changeAppointment(fn: (appointment: Appointment) => void) {
    mutate((next) =>
      fn(next.appointments.find((a) => a.id === route.appointment)!),
    );
  }
  function toggleFlag(personId: string, id: string) {
    mutate((next) => {
      const p = next.people.find((p) => p.id === personId)!;
      p.flags = p.flags.includes(id)
        ? p.flags.filter((x) => x !== id)
        : [...p.flags, id];
    });
  }
  function finishParticipant(personId: string) {
    const next = structuredClone(store);
    finish(next, current!.id, personId);
    const a = next.appointments.find((a) => a.id === current!.id)!;
    if (a.status === "active") {
      a.selected = Math.max(
        0,
        a.participants.findIndex((p) => p.status === "active"),
      );
      setStore(next);
      setModal(null);
      flash("Тренировка участника завершена");
    } else {
      setStore(next);
      go({ page: "summary", appointment: a.id });
    }
  }
  function oneOff(personId: string) {
    const next = structuredClone(store);
    const a = appointment(
      next,
      [personId],
      new Date().toTimeString().slice(0, 5),
    );
    a.participants = [oneOffParticipant(personId)];
    next.appointments.push(a);
    const actual = startAppointment(next, a.id);
    if (actual !== a.id)
      next.appointments = next.appointments.filter((x) => x.id !== a.id);
    setStore(next);
    go({ page: "workout", appointment: actual });
    if (actual === a.id) openPicker(undefined, undefined, true);
  }
  function deleteAppointment(id: string) {
    const saved = structuredClone(store.appointments.find((a) => a.id === id)!);
    mutate((next) => {
      next.appointments = next.appointments.filter((a) => a.id !== id);
    });
    go({ page: "today" });
    flash("Занятие удалено");
    setUndo(() => (next: Store) => {
      const restored = structuredClone(saved);
      restored.participants = restored.participants.filter((p) =>
        next.people.some((x) => x.id === p.personId),
      );
      if (
        !restored.participants.length ||
        next.appointments.some((a) => a.id === restored.id)
      )
        return;
      restored.selected = Math.min(
        restored.selected,
        restored.participants.length - 1,
      );
      if (
        restored.status === "active" &&
        next.appointments.some(
          (a) =>
            a.status === "active" &&
            a.participants.some(
              (p) =>
                p.status === "active" &&
                restored.participants.some(
                  (x) => x.personId === p.personId && x.status === "active",
                ),
            ),
        )
      )
        return;
      next.appointments.push(restored);
    });
  }
  useEffect(() => {
    if (!scrollAfterConfirm.current || route.page !== "workout" || !current)
      return;
    scrollAfterConfirm.current = false;
    const frame = requestAnimationFrame(() => {
      const index =
        current.mode === "shared"
          ? current.sharedOpened
          : current.participants[current.selected].opened;
      const target =
        index < 0
          ? document.querySelector(".workout-finish")
          : document.querySelector('[data-workout-index="' + index + '"]');
      target?.scrollIntoView({
        block: index < 0 ? "end" : "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [store, route.page, current]);
  function rowResult(p: Participant, index: number) {
    const e = p.entries[index];
    if (!e) return null;
    const who = personById(p.personId);
    const last = resultHistory(store, p.personId, e.id).at(-1);
    return (
      <div
        className={"result-form " + (e.done ? "confirmed" : "")}
        key={p.personId}
      >
        <div className="row between">
          <strong>
            {current!.participants.length > 1 ? who.name : "Рабочий подход"}
          </strong>
          <button
            className={
              "icon flag " + (who.flags.includes(e.id) ? "flagged" : "")
            }
            aria-label={"Техника под вопросом: " + who.name}
            aria-pressed={who.flags.includes(e.id)}
            onClick={() => toggleFlag(who.id, e.id)}
          >
            <CircleHelp size={17} />
          </button>
        </div>
        <button
          className="previous previous-history"
          onClick={() =>
            setModal({ type: "history", person: p.personId, exercise: e.id })
          }
          aria-label={"История упражнения: " + e.name + ", " + who.name}
        >
          {last ? (
            <>
              В прошлый раз <b>{format(last.weight, last.reps)}</b>
              <span>
                {" "}
                ·{" "}
                {last.date
                  ? labelDate(last.date, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "исходное значение"}
              </span>
            </>
          ) : (
            "Первый результат — заполните поля"
          )}
        </button>
        {p.status === "done" || p.status === "absent" ? (
          <div className="status-line">
            <CheckCircle2 size={17} />
            {p.status === "absent"
              ? "Закрыто"
              : e.done
                ? format(e.weight, e.reps) + " · Подтверждено"
                : "Пропущено"}
          </div>
        ) : (
          <>
            <div className="inputs">
              <label>
                Вес / нагрузка
                <input
                  aria-label={"Вес: " + who.name}
                  value={e.weight}
                  onChange={(event) =>
                    changeAppointment((a) => {
                      const r = a.participants.find(
                        (x) => x.personId === p.personId,
                      )!.entries[index];
                      r.weight = event.target.value;
                      r.done = false;
                    })
                  }
                  placeholder="0"
                />
              </label>
              <span>×</span>
              <label>
                Повторы
                <input
                  aria-label={"Повторы: " + who.name}
                  inputMode="numeric"
                  value={e.reps}
                  onChange={(event) =>
                    changeAppointment((a) => {
                      const r = a.participants.find(
                        (x) => x.personId === p.personId,
                      )!.entries[index];
                      r.reps = event.target.value;
                      r.done = false;
                    })
                  }
                  placeholder="0"
                />
              </label>
            </div>
            <button
              className={"btn full " + (e.done ? "soft" : "primary")}
              disabled={!e.weight.trim() || !e.reps.trim()}
              onClick={() => {
                if (document.activeElement instanceof HTMLElement)
                  document.activeElement.blur();
                scrollAfterConfirm.current = true;
                changeAppointment((a) => confirmEntry(a, p.personId, index));
              }}
            >
              <Check size={18} />
              {e.done ? "Результат подтверждён" : "Готово"}
            </button>
          </>
        )}
      </div>
    );
  }
  function openPicker(replace?: string, workout?: number, addWorkout = false) {
    setModal({
      type: "picker",
      selected: [],
      query: "",
      group: "Все",
      replace,
      workout,
      addWorkout,
    });
  }
  function savePicker() {
    if (route.page === "prepare") {
      const ids = activeParticipant!.entries.map((e) => e.id);
      mutate((next) =>
        prepareExercises(
          next,
          current!.id,
          modal.replace
            ? ids.map((id) => (id === modal.replace ? modal.selected[0] : id))
            : [...ids, ...modal.selected],
        ),
      );
    } else if (modal.addWorkout)
      mutate((next) => addWorkoutExercises(next, current!.id, modal.selected));
    else if (modal.workout !== undefined) {
      changeAppointment((a) => {
        const ps =
          a.mode === "shared" ? a.participants : [a.participants[a.selected]];
        ps.forEach((p) => {
          p.entries[modal.workout] = entry(
            store,
            p.personId,
            modal.selected[0],
          );
        });
      });
    } else
      editProgram((p) => {
        const d = p.days.find((d) => d.id === route.day)!;
        d.exercises = modal.replace
          ? d.exercises.map((id) =>
              id === modal.replace ? modal.selected[0] : id,
            )
          : [...d.exercises, ...modal.selected];
      });
    setModal(null);
    flash(modal.replace ? "Упражнение заменено" : "Упражнения добавлены");
  }
  const head = (
    title: string,
    subtitle?: string,
    back?: Route,
    action?: any,
  ) => (
    <>
      <header className="topbar">
        {back ? (
          <button className="icon" aria-label="Назад" onClick={() => go(back)}>
            <ArrowLeft size={21} />
          </button>
        ) : (
          <span className="brand">
            МОЙ ТЕМП
            <span className="brand-dot" />
          </span>
        )}
        <span className="save-state" role="status">
          {saveError ? "Не сохранено" : saving ? "Сохраняем…" : "На телефоне"}
        </span>
        {action ?? <span className="spacer" />}
      </header>
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </>
  );
  function appointmentCard(a: Appointment) {
    const active = a.status === "active";
    return (
      <article
        className={"appointment " + (active ? "active-appointment" : "")}
        key={a.id}
      >
        <div className="row between">
          <span className="time">
            <Clock3 size={15} />
            {a.time || "Без времени"}
          </span>
          <span className={"badge " + (active ? "warm" : "")}>
            {active
              ? "В процессе"
              : a.status === "cancelled"
                ? "Отменено"
                : a.status === "done"
                  ? "Завершено"
                  : a.participants.length === 2
                    ? "Парная"
                    : "Личная"}
          </span>
          <button
            className="icon"
            aria-label="Действия с занятием"
            onClick={() => setModal({ type: "appointment-menu", id: a.id })}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
        <div className="row person-line">
          <div className="avatar-stack">
            {a.participants.map((p) => (
              <Avatar key={p.personId} person={personById(p.personId)} small />
            ))}
          </div>
          <div>
            <h3>
              {a.participants
                .map((p) => personById(p.personId).name.split(" ")[0])
                .join(" + ")}
            </h3>
            <p>
              {a.participants.length > 1
                ? a.mode === "shared"
                  ? "Общие упражнения · свои результаты"
                  : a.participants
                      .map(
                        (p) =>
                          personById(p.personId).name.split(" ")[0] +
                          ": " +
                          p.dayName,
                      )
                      .join(" · ")
                : a.participants[0].dayName}
            </p>
          </div>
        </div>
        {a.status !== "cancelled" && (
          <button
            className={"btn full " + (a.status === "done" ? "soft" : "primary")}
            onClick={() =>
              a.status === "done"
                ? go({ page: "summary", appointment: a.id })
                : start(a.id)
            }
          >
            {a.status === "done" ? <Check size={17} /> : <Play size={16} />}
            {active
              ? "Продолжить"
              : a.status === "done"
                ? "Итоги занятия"
                : "Начать тренировку"}
            <ArrowRight size={17} />
          </button>
        )}
        {a.status === "planned" && (
          <button
            className="btn outline full prepare-action"
            onClick={() => go({ page: "prepare", appointment: a.id })}
          >
            {a.participants.some((p) => p.entries.length)
              ? "Изменить упражнения"
              : "Подготовить"}
          </button>
        )}
      </article>
    );
  }
  const filteredExercises = store.exercises.filter(
    (e) =>
      (group === "Все" || section(e.group) === group) &&
      e.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="device">
      {saveError && (
        <div className="save-error" role="alert">
          {saveError}
          <button
            className="btn soft"
            onClick={() => download(store, "moy-temp-rescue.json")}
          >
            Скачать копию
          </button>
          <button
            className="btn soft"
            onClick={() => setStore(structuredClone(store))}
          >
            Повторить сохранение
          </button>
        </div>
      )}
      <main>
        {route.page === "today" && (
          <>
            {head(
              date === today ? "Сегодня" : labelDate(date),
              labelDate(date, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }),
              undefined,
              <button
                className="icon"
                aria-label="Запланировать занятие"
                onClick={() => newSchedule()}
              >
                <Plus size={23} />
              </button>,
            )}
            <Calendar
              key={date.slice(0, 7)}
              store={store}
              date={date}
              today={today}
              onChange={setDate}
            />
            {!store.appointments.some((a) => a.status === "active") && (
              <button className="quick-start" onClick={() => newSchedule(true)}>
                <span className="quick-icon">
                  <Play size={18} />
                </span>
                <span>
                  <strong>Тренировка сейчас</strong>
                  <small>Без записи в расписании</small>
                </span>
                <ChevronRight size={18} />
              </button>
            )}
            {store.appointments.some(
              (a) => a.status === "active" && a.date !== date,
            ) && (
              <>
                <div className="section-title">
                  <h2>Продолжить</h2>
                  <span className="live-dot" />
                </div>
                {store.appointments
                  .filter((a) => a.status === "active" && a.date !== date)
                  .map(appointmentCard)}
              </>
            )}
            {store.appointments.some(
              (a) => a.date === date && a.status !== "cancelled",
            ) && (
              <>
                <div className="section-title">
                  <h2>
                    {date === today
                      ? "Тренировки сегодня"
                      : "Тренировки · " + labelDate(date)}
                  </h2>
                </div>
                {store.appointments
                  .filter((a) => a.date === date && a.status !== "cancelled")
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map(appointmentCard)}
              </>
            )}
          </>
        )}
        {route.page === "people" && (
          <>
            {head(
              "Люди",
              "Клиенты и мои тренировки",
              undefined,
              <button
                className="icon"
                aria-label="Добавить человека"
                onClick={() =>
                  setModal({ type: "person-edit", name: "", note: "" })
                }
              >
                <Plus size={23} />
              </button>,
            )}
            <div className="search">
              <Search size={18} />
              <input
                placeholder="Найти человека"
                aria-label="Поиск людей"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="people-list">
              {store.people
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <button
                    className="person-card"
                    key={p.id}
                    onClick={() => {
                      setPersonTab("Обзор");
                      go({ page: "person", person: p.id });
                    }}
                  >
                    <Avatar person={p} />
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.programs.find((p) => p.active)?.name ??
                          "Разовые тренировки"}
                      </small>
                    </span>
                    <ChevronRight size={19} />
                  </button>
                ))}
            </div>
          </>
        )}
        {route.page === "person" && person && (
          <>
            {head(
              person.name,
              person.id === "self" ? "Мои тренировки" : "Карточка клиента",
              { page: "people" },
              <button
                className="icon"
                aria-label="Настройки человека"
                onClick={() =>
                  setModal({
                    type: "person-edit",
                    id: person.id,
                    name: person.name,
                    note: person.note,
                    contact: person.contact,
                  })
                }
              >
                <MoreHorizontal size={22} />
              </button>,
            )}
            <div className="tabs">
              {["Обзор", "Программы", "История"].map((tab) => (
                <button
                  key={tab}
                  className={personTab === tab ? "selected" : ""}
                  onClick={() => setPersonTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            {personTab === "Обзор" && (
              <>
                {person.programs.find((pg) => pg.active) ? (
                  <button
                    className="library-row"
                    onClick={() =>
                      go({
                        page: "program",
                        person: person.id,
                        program: person.programs.find((pg) => pg.active)!.id,
                      })
                    }
                  >
                    <BookOpen size={20} />
                    <span>
                      <small>Активная программа</small>
                      <strong>
                        {person.programs.find((pg) => pg.active)!.name}
                      </strong>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    className="btn outline full"
                    onClick={() => setModal({ type: "new-program", name: "" })}
                  >
                    Создать программу
                  </button>
                )}
                <button
                  className="btn primary full"
                  onClick={() => oneOff(person.id)}
                >
                  <Play size={17} />
                  Разовая тренировка
                </button>
                {store.appointments
                  .filter(
                    (a) =>
                      a.date >= today &&
                      a.status === "planned" &&
                      a.participants.some((p) => p.personId === person.id),
                  )
                  .sort((a, b) =>
                    (a.date + a.time).localeCompare(b.date + b.time),
                  )
                  .slice(0, 1)
                  .map((a) => (
                    <div className="next-session" key={a.id}>
                      <CalendarDays size={19} />
                      <span>
                        <small>Ближайшее занятие</small>
                        <strong>
                          {labelDate(a.date)} · {a.time}
                        </strong>
                      </span>
                      <button
                        className="icon"
                        aria-label="Изменить ближайшее занятие"
                        onClick={() => newSchedule(false, a)}
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  ))}
                <div className="month-switch">
                  <button
                    className="icon"
                    aria-label="Предыдущий месяц"
                    onClick={() =>
                      setMonth(dayOffset(month + "-01", -1).slice(0, 7))
                    }
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <strong>
                    {labelDate(month + "-01", {
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                  <button
                    className="icon"
                    aria-label="Следующий месяц"
                    onClick={() => {
                      const d = new Date(month + "-01T12:00:00");
                      d.setMonth(d.getMonth() + 1);
                      setMonth(iso(d).slice(0, 7));
                    }}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <section className="surface">
                  <div className="section-title">
                    <h2>Посещаемость</h2>
                    <CalendarDays size={18} />
                  </div>
                  <div className="stats">
                    <div>
                      <b>
                        {
                          store.sessions.filter(
                            (s) =>
                              s.personId === person.id &&
                              s.date.startsWith(month),
                          ).length
                        }
                      </b>
                      <small>Проведено занятий</small>
                    </div>
                  </div>
                </section>
                <section className="surface">
                  <div className="section-title">
                    <h2>Результаты</h2>
                    <Dumbbell size={18} />
                  </div>
                  <p className="muted small-text">
                    Последний и предыдущий подход
                  </p>
                  {!resultHistory(store, person.id).some((r) =>
                    r.date.startsWith(month),
                  ) && (
                    <p className="muted">В этом месяце результатов пока нет.</p>
                  )}
                  {[
                    ...new Set(
                      resultHistory(store, person.id)
                        .filter((r) => r.date.startsWith(month))
                        .reverse()
                        .map((r) => r.id),
                    ),
                  ].map((id) => {
                    const hs = resultHistory(store, person.id, id).filter(
                      (r) => !r.date || r.date <= month + "-31",
                    );
                    const last = hs.at(-1),
                      prev = hs.at(-2);
                    return (
                      <button
                        className="progress-row"
                        key={id}
                        onClick={() =>
                          setModal({
                            type: "history",
                            person: person.id,
                            exercise: id,
                          })
                        }
                      >
                        <span>{ex(id).name}</span>
                        <span>
                          <strong>
                            {last
                              ? format(last.weight, last.reps)
                              : "Нет записей"}
                          </strong>
                          <small>
                            {prev
                              ? "ранее " + format(prev.weight, prev.reps)
                              : "—"}
                          </small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    );
                  })}
                </section>
              </>
            )}
            {personTab === "Программы" && (
              <>
                <div className="section-title">
                  <h2>Программы</h2>
                  <button
                    className="icon"
                    aria-label="Создать программу"
                    onClick={() => setModal({ type: "new-program", name: "" })}
                  >
                    <Plus size={22} />
                  </button>
                </div>
                {person.programs.map((pg) => (
                  <button
                    className="program-card"
                    key={pg.id}
                    onClick={() =>
                      go({ page: "program", person: person.id, program: pg.id })
                    }
                  >
                    <span className={"badge " + (pg.active ? "warm" : "")}>
                      {pg.active ? "Активная" : "В архиве"}
                    </span>
                    <h2>{pg.name}</h2>
                    <p>
                      {quantity(pg.days.length, ["день", "дня", "дней"])} ·
                      Далее{" "}
                      {pg.days[pg.next % pg.days.length]?.name ??
                        "добавьте день"}
                    </p>
                    <span className="row between">
                      <small>Открыть программу</small>
                      <ArrowRight size={18} />
                    </span>
                  </button>
                ))}
              </>
            )}
            {personTab === "История" && (
              <>
                <div className="section-title">
                  <h2>Занятия</h2>
                </div>
                {store.sessions
                  .filter((s) => s.personId === person.id)
                  .slice()
                  .reverse()
                  .map((s) => (
                    <details className="history-card" key={s.id}>
                      <summary>
                        <span>
                          <small>{labelDate(s.date)}</small>
                          <strong>{s.dayName}</strong>
                        </span>
                        <span className="badge">
                          {s.results.filter((r) => r.done).length} упр.
                        </span>
                      </summary>
                      {s.results.map((r, i) => (
                        <div className="history-result" key={i}>
                          <span>{r.name}</span>
                          <b>
                            {r.done ? format(r.weight, r.reps) : "Пропущено"}
                          </b>
                          {r.done && (
                            <button
                              className="text correct-action"
                              onClick={() =>
                                setModal({
                                  type: "correct-result",
                                  person: person.id,
                                  session: s.id,
                                  index: i,
                                  name: r.name,
                                  date: s.date,
                                  weight: r.weight,
                                  reps: r.reps,
                                })
                              }
                            >
                              Исправить
                            </button>
                          )}
                        </div>
                      ))}
                    </details>
                  ))}
              </>
            )}
          </>
        )}
        {route.page === "program" && program && person && (
          <>
            {head(
              program.name,
              program.active ? "Активная программа" : "Архивная программа",
              { page: "person", person: person.id },
              <button
                className="icon"
                aria-label="Действия с программой"
                onClick={() => setModal({ type: "program-menu" })}
              >
                <MoreHorizontal size={22} />
              </button>,
            )}
            <div className="context-person">
              <Avatar person={person} small />
              <strong>{person.name}</strong>
            </div>
            <div className="section-title">
              <h2>Дни программы</h2>
              <span>{program.days.length}</span>
            </div>
            {program.days.map((d, i) => (
              <button
                className="day-card"
                key={d.id}
                onClick={() => go({ ...route, page: "day", day: d.id })}
              >
                <span className="day-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {quantity(d.exercises.length)}
                    {program.next === i ? " · Следующая тренировка" : ""}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
            <button
              className="btn outline full"
              onClick={() => setModal({ type: "new-day", name: "" })}
            >
              <Plus size={18} />
              Добавить день
            </button>
            <div className="hint">
              <BookOpen size={19} />
              <p>Дни идут по порядку. На занятии можно выбрать другой день.</p>
            </div>
          </>
        )}
        {route.page === "day" && day && person && (
          <>
            {head(
              day.name,
              `${person.name} · ${program!.name}`,
              { page: "program", person: person.id, program: program!.id },
              <button
                className="icon"
                aria-label="Действия с днём"
                onClick={() => setModal({ type: "day-menu" })}
              >
                <MoreHorizontal size={22} />
              </button>,
            )}
            <p className="muted small-text">
              {quantity(day.exercises.length)} · Потяните за ручку, чтобы
              изменить порядок
            </p>
            <div className="edit-list">
              {day.exercises.map((id, index) => (
                <article className="edit-row" data-index={index} key={id}>
                  <button
                    className="drag-handle icon"
                    aria-label={"Переместить " + ex(id).name}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = { from: index, to: index };
                    }}
                    onPointerMove={(e) => {
                      if (!drag.current) return;
                      const target = document
                        .elementFromPoint(e.clientX, e.clientY)
                        ?.closest<HTMLElement>("[data-index]");
                      if (target) {
                        drag.current.to = Number(target.dataset.index);
                        document
                          .querySelectorAll(".edit-row")
                          .forEach((el) =>
                            el.classList.toggle("drop-target", el === target),
                          );
                      }
                    }}
                    onPointerUp={() => {
                      if (drag.current) {
                        const { from, to } = drag.current;
                        editProgram((p) => {
                          const d = p.days.find((d) => d.id === route.day)!;
                          const [id] = d.exercises.splice(from, 1);
                          d.exercises.splice(to, 0, id);
                        });
                        drag.current = null;
                        document
                          .querySelectorAll(".drop-target")
                          .forEach((el) => el.classList.remove("drop-target"));
                      }
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      document
                        .querySelectorAll(".drop-target")
                        .forEach((el) => el.classList.remove("drop-target"));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.preventDefault();
                        const to = Math.min(
                          day.exercises.length - 1,
                          Math.max(0, index + (e.key === "ArrowDown" ? 1 : -1)),
                        );
                        editProgram((p) => {
                          const d = p.days.find((d) => d.id === route.day)!;
                          const [id] = d.exercises.splice(index, 1);
                          d.exercises.splice(to, 0, id);
                        });
                      }
                    }}
                  >
                    <GripVertical size={18} />
                  </button>
                  <Picture exercise={ex(id)} />
                  <div>
                    <strong>{ex(id).name}</strong>
                    <small>{ex(id).group}</small>
                    <button className="text" onClick={() => openPicker(id)}>
                      <Replace size={13} />
                      Заменить
                    </button>
                  </div>
                  <button
                    className="icon"
                    aria-label={"Действия: " + ex(id).name}
                    onClick={() => setModal({ type: "exercise-menu", id })}
                  >
                    <MoreHorizontal size={19} />
                  </button>
                </article>
              ))}
            </div>
            <div className="sticky-action">
              <button className="btn primary full" onClick={() => openPicker()}>
                <Plus size={19} />
                Добавить упражнения
              </button>
            </div>
          </>
        )}
        {route.page === "workout" && current && activeParticipant && (
          <>
            {head(
              current.participants.length === 2
                ? "Парная тренировка"
                : personById(activeParticipant.personId).name,
              current.mode === "shared"
                ? "Общие упражнения"
                : activeParticipant.dayName,
              { page: "today" },
              <button
                className="icon"
                aria-label="Действия во время занятия"
                onClick={() => setModal({ type: "workout-menu" })}
              >
                <MoreHorizontal size={22} />
              </button>,
            )}
            {current.participants.length > 1 && (
              <div className="participant-tabs">
                {current.participants.map((p, i) => (
                  <button
                    key={p.personId}
                    className={current.selected === i ? "selected" : ""}
                    onClick={() => {
                      const y = window.scrollY;
                      changeAppointment((a) => {
                        a.participants[a.selected].scroll = y;
                        a.selected = i;
                      });
                      if (current.mode === "separate")
                        window.scrollTo(0, current.participants[i].scroll);
                    }}
                  >
                    <Avatar person={personById(p.personId)} small />
                    <span>
                      <strong>
                        {personById(p.personId).name.split(" ")[0]}
                      </strong>
                      <small>
                        {p.status === "done"
                          ? "Завершено"
                          : p.status === "absent"
                            ? "Закрыто"
                            : `${p.entries.filter((e) => e.done).length} из ${p.entries.length}`}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {activeParticipant.status === "active" && (
              <div className="workout-tools">
                {!activeParticipant.entries.length &&
                  personById(activeParticipant.personId).programs.some(
                    (pg) => pg.active && pg.days.length,
                  ) && (
                    <button
                      className="btn soft full"
                      disabled={
                        current.mode === "shared" &&
                        current.participants.some((p) => p.status !== "active")
                      }
                      onClick={() => setModal({ type: "choose-workout-day" })}
                    >
                      <BookOpen size={17} />
                      Выбрать день программы
                    </button>
                  )}
                {current.participants.length === 2 &&
                  current.participants.every(
                    (p) => p.status === "active" && !p.entries.length,
                  ) && (
                    <div className="tabs">
                      <button
                        className={
                          current.mode === "separate" ? "selected" : ""
                        }
                        onClick={() =>
                          changeAppointment((a) => {
                            a.mode = "separate";
                          })
                        }
                      >
                        Свои упражнения
                      </button>
                      <button
                        className={current.mode === "shared" ? "selected" : ""}
                        onClick={() =>
                          changeAppointment((a) => {
                            a.mode = "shared";
                          })
                        }
                      >
                        Общие упражнения
                      </button>
                    </div>
                  )}
                <button
                  className="btn outline full"
                  disabled={
                    current.mode === "shared" &&
                    current.participants.some((p) => p.status !== "active")
                  }
                  onClick={() => openPicker(undefined, undefined, true)}
                >
                  <Plus size={17} />
                  Добавить упражнения
                </button>
              </div>
            )}
            <div className="workout-progress">
              <span>
                {activeParticipant.entries.filter((e) => e.done).length} из{" "}
                {activeParticipant.entries.length} выполнено
              </span>
              <div>
                <i
                  style={{
                    width: `${activeParticipant.entries.length ? (activeParticipant.entries.filter((e) => e.done).length / activeParticipant.entries.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            {(current.mode === "shared"
              ? current.participants[0]
              : activeParticipant
            ).entries.map((e, index) => {
              const opened =
                (current.mode === "shared"
                  ? current.sharedOpened
                  : activeParticipant.opened) === index;
              const done =
                current.mode === "shared"
                  ? current.participants
                      .filter((p) => p.status !== "absent")
                      .every((p) => p.entries[index]?.done)
                  : e.done;
              return (
                <article
                  className={"workout-item " + (opened ? "opened" : "")}
                  key={e.id}
                  data-workout-index={index}
                >
                  <button
                    className="exercise-heading"
                    onClick={() =>
                      changeAppointment((a) => {
                        if (a.mode === "shared")
                          a.sharedOpened = opened ? -1 : index;
                        else
                          a.participants[a.selected].opened = opened
                            ? -1
                            : index;
                      })
                    }
                  >
                    <span className={"exercise-status " + (done ? "done" : "")}>
                      {done ? (
                        <Check size={17} />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>
                      <strong>{e.name}</strong>
                      {done && (
                        <small>
                          {current.mode === "shared"
                            ? "Результаты подтверждены"
                            : format(e.weight, e.reps)}
                        </small>
                      )}
                    </span>
                    <ChevronRight
                      className={opened ? "rotated" : ""}
                      size={18}
                    />
                  </button>
                  {opened && (
                    <div className="exercise-detail">
                      {photos(e.id)}
                      {(current.mode === "shared"
                        ? current.participants
                        : [activeParticipant]
                      ).map((p) => rowResult(p, index))}
                      <button
                        className="text replace-today"
                        disabled={
                          current.mode === "shared"
                            ? current.participants.some(
                                (p) => p.status === "done",
                              ) ||
                              current.participants.every(
                                (p) => p.status !== "active",
                              )
                            : activeParticipant.status !== "active"
                        }
                        onClick={() => openPicker(e.id, index)}
                      >
                        <Replace size={15} />
                        Заменить только сегодня
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
            <div className="sticky-action workout-finish">
              <button
                className="btn primary full"
                disabled={activeParticipant.status !== "active"}
                onClick={() =>
                  activeParticipant.entries.length > 0 &&
                  activeParticipant.entries.every((e) => e.done)
                    ? finishParticipant(activeParticipant.personId)
                    : setModal({
                        type: "finish",
                        person: activeParticipant.personId,
                      })
                }
              >
                <CheckCircle2 size={18} />
                {current.participants.length > 1
                  ? "Завершить · " +
                    personById(activeParticipant.personId).name.split(" ")[0]
                  : "Завершить тренировку"}
              </button>
            </div>
          </>
        )}
        {route.page === "prepare" &&
          current?.status === "planned" &&
          activeParticipant && (
            <>
              {head(
                "Подготовка занятия",
                labelDate(current.date) +
                  " · " +
                  (current.time || "Без времени"),
                { page: "today" },
              )}
              {current.participants.length === 2 && (
                <>
                  <div className="tabs">
                    {["separate", "shared"].map((mode) => (
                      <button
                        key={mode}
                        className={current.mode === mode ? "selected" : ""}
                        onClick={() => {
                          if (mode === current.mode) return;
                          if (
                            mode === "shared" &&
                            current.participants.some(
                              (p, i) =>
                                i !== current.selected && p.entries.length,
                            )
                          )
                            setModal({
                              type: "prepare-change",
                              action: "mode",
                              value: mode,
                            });
                          else
                            mutate((next) =>
                              prepareMode(
                                next,
                                current.id,
                                mode as Appointment["mode"],
                              ),
                            );
                        }}
                      >
                        {mode === "shared"
                          ? "Общие упражнения"
                          : "Свои упражнения"}
                      </button>
                    ))}
                  </div>
                  <div className="participant-tabs">
                    {current.participants.map((p, i) => (
                      <button
                        key={p.personId}
                        className={current.selected === i ? "selected" : ""}
                        onClick={() =>
                          changeAppointment((a) => {
                            a.selected = i;
                          })
                        }
                      >
                        {personById(p.personId).name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <h2>{personById(activeParticipant.personId).name}</h2>
              <p className="muted">{activeParticipant.dayName}</p>
              {personById(activeParticipant.personId)
                .programs.filter((p) => p.active)
                .flatMap((pg) =>
                  pg.days.map((d) => (
                    <button
                      className="btn outline full prepare-action"
                      key={d.id}
                      onClick={() => {
                        if (activeParticipant.entries.length)
                          setModal({
                            type: "prepare-change",
                            action: "day",
                            value: d.id,
                          });
                        else
                          mutate((next) => prepareDay(next, current.id, d.id));
                      }}
                    >
                      День программы · {d.name}
                    </button>
                  )),
                )}
              <Preparation
                participant={activeParticipant}
                exercises={store.exercises}
                onChange={(ids) =>
                  mutate((next) => prepareExercises(next, current.id, ids))
                }
                onReplace={(id) => openPicker(id)}
                onAdd={() => openPicker()}
                onRemove={(id) => {
                  const before = structuredClone(current);
                  mutate((next) =>
                    prepareExercises(
                      next,
                      current.id,
                      activeParticipant.entries
                        .filter((e) => e.id !== id)
                        .map((e) => e.id),
                    ),
                  );
                  setUndo(() => (next: Store) => {
                    const a = next.appointments.find((a) => a.id === before.id);
                    if (!a || a.status !== "planned" || a.mode !== before.mode)
                      return;
                    const sharedId =
                      a.participants[0].entries[a.sharedOpened]?.id;
                    const originals =
                      before.mode === "shared"
                        ? before.participants
                        : [before.participants[before.selected]];
                    originals.forEach((original) => {
                      const p = a.participants.find(
                        (p) => p.personId === original.personId,
                      );
                      const index = original.entries.findIndex(
                        (e) => e.id === id,
                      );
                      if (!p || index < 0 || p.entries.some((e) => e.id === id))
                        return;
                      const openedId = p.entries[p.opened]?.id;
                      p.entries.splice(
                        Math.min(index, p.entries.length),
                        0,
                        original.entries[index],
                      );
                      if (openedId)
                        p.opened = p.entries.findIndex(
                          (e) => e.id === openedId,
                        );
                    });
                    if (sharedId)
                      a.sharedOpened = a.participants[0].entries.findIndex(
                        (e) => e.id === sharedId,
                      );
                  });
                  flash("Упражнение убрано");
                }}
              />
              <button
                className="btn soft full"
                onClick={() => go({ page: "today" })}
              >
                К расписанию
              </button>
            </>
          )}
        {route.page === "summary" && current && (
          <div className="completion-screen">
            <div className="success-symbol">
              <Check size={36} />
            </div>
            <h1>Завершено</h1>
            <button
              className="btn primary full"
              onClick={() => {
                setDate(today);
                go({ page: "today" });
              }}
            >
              К расписанию
            </button>
          </div>
        )}
        {route.page === "exercises" && (
          <>
            {head("Упражнения", "Общая библиотека")}
            <div className="search">
              <Search size={18} />
              <input
                aria-label="Поиск упражнений"
                placeholder="Название упражнения"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="chips">
              {["Все", ...sections].map((s) => (
                <button
                  key={s}
                  className={group === s ? "selected" : ""}
                  onClick={() => setGroup(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            {sections.map((s) => {
              const items = filteredExercises.filter(
                (e) => section(e.group) === s,
              );
              return items.length ? (
                <section key={s}>
                  <div className="section-title">
                    <h2>{s}</h2>
                    <span>{items.length}</span>
                  </div>
                  {items.map((e) => (
                    <button
                      className="library-row"
                      key={e.id}
                      onClick={() =>
                        setModal({ type: "exercise-preview", id: e.id })
                      }
                    >
                      <Picture exercise={e} />
                      <span>
                        <strong>{e.name}</strong>
                        <small>{e.kind || e.group}</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                </section>
              ) : null;
            })}
          </>
        )}
        {route.page === "more" && (
          <>
            {head("Ещё", "Всё для работы")}
            <div className="section-title">
              <h2>Шаблоны программ</h2>
            </div>
            {store.templates.map((t) => (
              <button
                key={t.id}
                className="library-row"
                onClick={() =>
                  setModal({
                    type: "copy-program",
                    source: t,
                    target: "self",
                    template: true,
                  })
                }
              >
                <BookOpen size={22} />
                <span>
                  <strong>{t.name}</strong>
                  <small>
                    {quantity(t.days.length, ["день", "дня", "дней"])} ·
                    Назначить человеку
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
            {!store.templates.length && (
              <p className="muted">
                В меню программы выберите «Сохранить как шаблон».
              </p>
            )}
            <section className="surface backup-section">
              <h2>Резервная копия</h2>
              <p>
                Данные хранятся на этом телефоне. Сохраните копию перед сменой
                устройства или очисткой браузера.
              </p>
              <button
                className="btn primary full"
                onClick={() => download(store, "moy-temp-" + iso() + ".json")}
              >
                Скачать резервную копию
              </button>
              <label className="btn soft full file-button">
                Восстановить из файла
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const next = migrate(JSON.parse(await f.text()));
                      setImportValue(next);
                      setModal({ type: "import" });
                    } catch (err) {
                      flash((err as Error).message);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                className="text"
                onClick={async () => {
                  const original = await getRecovery();
                  if (original) download(original, "moy-temp-recovery.json");
                  else flash("Исходной копии пока нет");
                }}
              >
                Скачать данные до переноса или импорта
              </button>
            </section>
            <InstallHelp />
            <p className="footnote">
              Мой темп · Формат данных 2 · Один телефон, без аккаунта
            </p>
          </>
        )}
      </main>
      {!["workout", "summary", "day", "prepare"].includes(route.page) && (
        <nav className="bottom-nav" aria-label="Основная навигация">
          {[
            ["today", "Сегодня", CalendarDays],
            ["people", "Люди", Users],
            ["exercises", "Упражнения", Dumbbell],
            ["more", "Ещё", MoreHorizontal],
          ].map(([key, label, Icon]: any) => (
            <button
              key={key}
              className={
                route.page === key ||
                (key === "people" && ["person", "program"].includes(route.page))
                  ? "selected"
                  : ""
              }
              onClick={() => go({ page: key })}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
          {undo && (
            <button
              onClick={() => {
                mutate(undo);
                setUndo(null);
                setToast("Действие отменено");
              }}
            >
              Отменить
            </button>
          )}
        </div>
      )}
      {modal && (
        <div className="overlay" onClick={() => setModal(null)}>
          <section
            className={
              "sheet " +
              (["picker", "schedule", "exercise-preview"].includes(modal.type)
                ? "tall"
                : "")
            }
            role="dialog"
            aria-modal="true"
            aria-label={
              modal.type === "picker"
                ? "Выбор упражнений"
                : modal.type === "schedule"
                  ? "Новое занятие"
                  : "Действия"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-top">
              <span className="sheet-grip" />
              <button
                className="icon"
                aria-label="Закрыть"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="sheet-scroll">
              {modal.type === "schedule" && (
                <>
                  <h2>
                    {modal.editing
                      ? "Изменить занятие"
                      : modal.quick
                        ? "Тренировка сейчас"
                        : "Новое занятие"}
                  </h2>
                  <p className="muted">
                    Выберите участников. Упражнения можно составить позже.
                  </p>
                  <label className="field-label">Участники</label>
                  <div className="selection-people">
                    {store.people.map((p) => {
                      const chosen = modal.participants.some(
                        (x: Participant) => x.personId === p.id,
                      );
                      return (
                        <button
                          key={p.id}
                          aria-pressed={chosen}
                          className={chosen ? "chosen" : ""}
                          disabled={!chosen && modal.participants.length === 2}
                          onClick={() =>
                            setModal({
                              ...modal,
                              participants: chosen
                                ? modal.participants.filter(
                                    (x: Participant) => x.personId !== p.id,
                                  )
                                : [
                                    ...modal.participants,
                                    oneOffParticipant(p.id),
                                  ],
                            })
                          }
                        >
                          <Avatar person={p} small />
                          <span>{p.name}</span>
                          <span className="checkbox">
                            {chosen && <Check size={15} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!modal.quick && (
                    <div className="two-col">
                      <label className="field">
                        <span>Дата</span>
                        <input
                          aria-label="Дата занятия"
                          type="date"
                          value={modal.date}
                          onInput={(e) =>
                            setModal({ ...modal, date: e.currentTarget.value })
                          }
                          onChange={(e) =>
                            setModal({ ...modal, date: e.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Время</span>
                        <input
                          aria-label="Время занятия"
                          type="time"
                          value={modal.time}
                          onInput={(e) =>
                            setModal({ ...modal, time: e.currentTarget.value })
                          }
                          onChange={(e) =>
                            setModal({ ...modal, time: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  )}
                  <button
                    className="btn primary full"
                    disabled={
                      !modal.participants.length || !modal.date || !modal.time
                    }
                    onClick={() => {
                      const a: Appointment = {
                        id: modal.id,
                        date: modal.quick ? today : modal.date,
                        time: modal.time,
                        duration: null,
                        mode:
                          modal.participants.length === 1
                            ? "separate"
                            : modal.mode,
                        participants: structuredClone(modal.participants),
                        status: "planned",
                        selected: 0,
                        sharedOpened: 0,
                      };
                      if (a.mode === "shared" && a.participants.length === 2) {
                        const source =
                          a.participants.find((p) => p.entries.length) ??
                          a.participants[0];
                        a.participants.forEach((p) => {
                          if (
                            p !== source &&
                            p.entries.map((e) => e.id).join("|") !==
                              source.entries.map((e) => e.id).join("|")
                          ) {
                            p.programId = undefined;
                            p.dayId = undefined;
                            p.dayName = source.dayName;
                            p.entries = source.entries.map((e) =>
                              entry(store, p.personId, e.id),
                            );
                          }
                        });
                      }
                      const next = structuredClone(store);
                      next.appointments = modal.editing
                        ? next.appointments.map((x) => (x.id === a.id ? a : x))
                        : [...next.appointments, a];
                      let actual = a.id;
                      if (modal.quick) {
                        actual = startAppointment(next, a.id);
                        if (actual !== a.id)
                          next.appointments = next.appointments.filter(
                            (x) => x.id !== a.id,
                          );
                      }
                      setStore(next);
                      setDate(a.date);
                      go(
                        modal.quick
                          ? { page: "workout", appointment: actual }
                          : { page: "today" },
                      );
                      flash(
                        modal.quick
                          ? "Тренировка началась"
                          : "Занятие сохранено",
                      );
                    }}
                  >
                    {modal.quick
                      ? "Начать тренировку"
                      : modal.editing
                        ? "Сохранить изменения"
                        : "Добавить в расписание"}
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
              {modal.type === "prepare-change" && (
                <>
                  <h2>Заменить список упражнений?</h2>
                  <p className="muted">
                    {modal.action === "mode"
                      ? "Для второго участника будет использован список выбранного человека. Его программа не изменится."
                      : "Текущий список заменится упражнениями выбранного дня. Программа не изменится."}
                  </p>
                  <button
                    className="btn primary full"
                    onClick={() => {
                      mutate((next) => {
                        if (modal.action === "mode")
                          prepareMode(next, current!.id, "shared");
                        else prepareDay(next, current!.id, modal.value);
                      });
                      setModal(null);
                    }}
                  >
                    Заменить список
                  </button>
                  <button
                    className="btn soft full"
                    onClick={() => setModal(null)}
                  >
                    Оставить текущий
                  </button>
                </>
              )}
              {modal.type === "choose-workout-day" && (
                <>
                  <h2>День программы</h2>
                  <p className="muted">
                    {personById(activeParticipant!.personId).name}
                  </p>
                  {personById(activeParticipant!.personId)
                    .programs.filter((pg) => pg.active)
                    .flatMap((pg) =>
                      pg.days.map((d) => (
                        <button
                          key={d.id}
                          className="menu-item"
                          onClick={() => {
                            changeAppointment((a) => {
                              const source = a.participants[a.selected];
                              const chosen = participant(
                                store,
                                source.personId,
                                d.id,
                              );
                              a.participants[a.selected] = {
                                ...chosen,
                                status: "active",
                              };
                              if (a.mode === "shared") {
                                a.participants.forEach((p, i) => {
                                  if (i !== a.selected) {
                                    p.programId = undefined;
                                    p.dayId = undefined;
                                    p.dayName = d.name + " · совместная";
                                    p.entries = d.exercises.map((id) =>
                                      entry(store, p.personId, id),
                                    );
                                    p.opened = 0;
                                  }
                                });
                                a.sharedOpened = 0;
                              }
                            });
                            setModal(null);
                          }}
                        >
                          <BookOpen size={18} />
                          <span>
                            {d.name}
                            <small className="muted">
                              {" "}
                              · {quantity(d.exercises.length)}
                            </small>
                          </span>
                        </button>
                      )),
                    )}
                </>
              )}
              {modal.type === "picker" && (
                <>
                  <h2>
                    {modal.replace
                      ? "Заменить упражнение"
                      : "Добавить упражнения"}
                  </h2>
                  <p className="muted">
                    {modal.workout !== undefined || modal.addWorkout
                      ? "Упражнения только для этого занятия"
                      : modal.replace
                        ? "Позиция в списке сохранится"
                        : "Выберите сразу несколько упражнений"}
                  </p>
                  <div className="search">
                    <Search size={18} />
                    <input
                      autoFocus
                      placeholder="Найти упражнение"
                      aria-label="Найти упражнение"
                      value={modal.query}
                      onChange={(e) =>
                        setModal({ ...modal, query: e.target.value })
                      }
                    />
                  </div>
                  <div className="chips">
                    {["Все", ...sections].map((s) => (
                      <button
                        key={s}
                        className={modal.group === s ? "selected" : ""}
                        onClick={() => setModal({ ...modal, group: s })}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {sections.map((s) => {
                    const items = store.exercises.filter(
                      (e) =>
                        section(e.group) === s &&
                        (modal.group === "Все" || s === modal.group) &&
                        e.name
                          .toLowerCase()
                          .includes(modal.query.toLowerCase()),
                    );
                    return items.length ? (
                      <section key={s}>
                        <h3 className="group-title">{s}</h3>
                        {items.map((e) => {
                          const existing =
                            route.page === "prepare" ||
                            modal.workout !== undefined ||
                            modal.addWorkout
                              ? activeParticipant!.entries.some(
                                  (x) => x.id === e.id,
                                )
                              : day?.exercises.includes(e.id);
                          const checked = modal.selected.includes(e.id);
                          return (
                            <button
                              aria-pressed={checked}
                              disabled={existing}
                              className={
                                "picker-row " + (checked ? "chosen" : "")
                              }
                              key={e.id}
                              onClick={() =>
                                setModal({
                                  ...modal,
                                  selected: modal.replace
                                    ? [e.id]
                                    : checked
                                      ? modal.selected.filter(
                                          (id: string) => id !== e.id,
                                        )
                                      : [...modal.selected, e.id],
                                })
                              }
                            >
                              <Picture exercise={e} />
                              <span>
                                <strong>{e.name}</strong>
                                <small>
                                  {existing
                                    ? "Уже добавлено"
                                    : e.kind || e.group}
                                </small>
                              </span>
                              <span className="checkbox">
                                {(checked || existing) && <Check size={15} />}
                              </span>
                            </button>
                          );
                        })}
                      </section>
                    ) : null;
                  })}
                </>
              )}
              {modal.type === "finish" &&
                (() => {
                  const p = current!.participants.find(
                    (p) => p.personId === modal.person,
                  )!;
                  return (
                    <>
                      <h2>Завершить тренировку?</h2>
                      <p className="muted">
                        {personById(p.personId).name} ·{" "}
                        {p.entries.filter((e) => e.done).length} из{" "}
                        {p.entries.length} выполнено
                      </p>
                      {p.entries.some((e) => !e.done) && (
                        <>
                          <p>
                            Эти упражнения сохранятся как пропущенные, без
                            результатов:
                          </p>
                          <ul className="skip-list">
                            {p.entries
                              .filter((e) => !e.done)
                              .map((e) => (
                                <li key={e.id}>{ex(e.id).name}</li>
                              ))}
                          </ul>
                        </>
                      )}
                      <button
                        className="btn primary full"
                        onClick={() => finishParticipant(p.personId)}
                      >
                        Сохранить и завершить
                      </button>
                      <button
                        className="btn soft full"
                        onClick={() => setModal(null)}
                      >
                        Вернуться к тренировке
                      </button>
                    </>
                  );
                })()}
              {modal.type === "workout-menu" && (
                <>
                  <h2>Занятие</h2>
                  <button
                    className="menu-item"
                    onClick={() => go({ page: "today" })}
                  >
                    <CalendarDays size={20} />
                    Вернуться к расписанию
                  </button>
                  <button
                    className="menu-item danger"
                    onClick={() =>
                      setModal({ type: "delete-appointment", id: current!.id })
                    }
                  >
                    <Trash2 size={20} />
                    Удалить тренировку
                  </button>
                  <p className="muted">
                    Введённые результаты сохраняются автоматически.
                  </p>
                </>
              )}
              {modal.type === "appointment-menu" &&
                (() => {
                  const a = store.appointments.find((a) => a.id === modal.id)!;
                  return (
                    <>
                      <h2>
                        {a.time} ·{" "}
                        {a.participants
                          .map((p) => personById(p.personId).name)
                          .join(" + ")}
                      </h2>
                      {a.status === "planned" && (
                        <button
                          className="menu-item"
                          onClick={() => newSchedule(false, a)}
                        >
                          <CalendarDays size={20} />
                          Перенести или изменить
                        </button>
                      )}
                      <button
                        className="menu-item"
                        onClick={() =>
                          a.status === "done"
                            ? go({ page: "summary", appointment: a.id })
                            : start(a.id)
                        }
                      >
                        <Play size={20} />
                        Открыть занятие
                      </button>
                      <button
                        className="menu-item danger"
                        onClick={() =>
                          setModal({ type: "delete-appointment", id: a.id })
                        }
                      >
                        <Trash2 size={20} />
                        Удалить занятие
                      </button>
                    </>
                  );
                })()}
              {modal.type === "delete-appointment" && (
                <>
                  <h2>Удалить занятие?</h2>
                  <p className="muted">
                    Запись и незавершённые подходы будут удалены. Уже
                    сохранённые результаты останутся в истории. Очередь
                    программы не изменится.
                  </p>
                  <button
                    className="btn primary full"
                    onClick={() => deleteAppointment(modal.id)}
                  >
                    Удалить занятие
                  </button>
                  <button
                    className="btn soft full"
                    onClick={() => setModal(null)}
                  >
                    Оставить занятие
                  </button>
                </>
              )}
              {modal.type === "delete-person" && (
                <>
                  <h2>Удалить клиента?</h2>
                  <p className="muted">
                    {personById(modal.id).name}: карточка, программы, история и
                    записи будут удалены. В парных занятиях второй участник
                    останется.
                  </p>
                  <button
                    className="btn primary full"
                    onClick={() => {
                      mutate((next) => removePerson(next, modal.id));
                      go({ page: "people" });
                      flash("Клиент удалён");
                    }}
                  >
                    Удалить клиента
                  </button>
                  <button
                    className="btn soft full"
                    onClick={() => setModal(null)}
                  >
                    Оставить карточку
                  </button>
                </>
              )}
              {modal.type === "person-edit" && (
                <>
                  <h2>{modal.id ? "О человеке" : "Новый человек"}</h2>
                  <label className="field">
                    <span>Имя</span>
                    <input
                      disabled={modal.id === "self"}
                      aria-label="Имя человека"
                      value={modal.name}
                      onChange={(e) =>
                        setModal({ ...modal, name: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Контакт</span>
                    <input
                      value={modal.contact ?? ""}
                      onChange={(e) =>
                        setModal({ ...modal, contact: e.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Заметка тренера</span>
                    <textarea
                      value={modal.note}
                      onChange={(e) =>
                        setModal({ ...modal, note: e.target.value })
                      }
                    />
                  </label>
                  <button
                    className="btn primary full"
                    disabled={!modal.name.trim()}
                    onClick={() => {
                      const id = modal.id ?? uid();
                      mutate((next) => {
                        const p = next.people.find((p) => p.id === id);
                        if (p) {
                          p.name = p.id === "self" ? "Я" : modal.name.trim();
                          p.note = modal.note;
                          p.contact = modal.contact ?? "";
                          p.short =
                            p.id === "self"
                              ? "Я"
                              : p.name.slice(0, 2).toUpperCase();
                        } else
                          next.people.push({
                            id,
                            name: modal.name.trim(),
                            short: modal.name.trim().slice(0, 2).toUpperCase(),
                            note: modal.note,
                            contact: modal.contact ?? "",
                            programs: [],
                            flags: [],
                            records: [],
                          });
                      });
                      go({ page: "person", person: id });
                    }}
                  >
                    Сохранить
                  </button>
                  {modal.id && modal.id !== "self" && (
                    <button
                      className="btn outline full danger"
                      onClick={() =>
                        setModal({ type: "delete-person", id: modal.id })
                      }
                    >
                      <Trash2 size={18} />
                      Удалить клиента
                    </button>
                  )}
                </>
              )}
              {(modal.type === "new-program" || modal.type === "new-day") && (
                <>
                  <h2>
                    {modal.type === "new-day"
                      ? "Новый день"
                      : "Новая программа"}
                  </h2>
                  <label className="field">
                    <span>Название</span>
                    <input
                      autoFocus
                      value={modal.name}
                      onChange={(e) =>
                        setModal({ ...modal, name: e.target.value })
                      }
                    />
                  </label>
                  <button
                    className="btn primary full"
                    disabled={!modal.name.trim()}
                    onClick={() => {
                      if (modal.type === "new-day") {
                        const d = {
                          id: uid(),
                          name: modal.name.trim(),
                          exercises: [],
                        };
                        editProgram((pg) => pg.days.push(d));
                        go({ ...route, page: "day", day: d.id });
                      } else {
                        const pg = {
                          ...newProgram(modal.name.trim()),
                          days: [],
                        };
                        mutate((next) => {
                          const p = next.people.find(
                            (p) => p.id === person!.id,
                          )!;
                          p.programs.forEach((pg) => (pg.active = false));
                          p.programs.push(pg);
                        });
                        go({
                          page: "program",
                          person: person!.id,
                          program: pg.id,
                        });
                      }
                    }}
                  >
                    Создать
                  </button>
                </>
              )}
              {modal.type === "program-menu" && (
                <>
                  <h2>Программа</h2>
                  <button
                    className="menu-item"
                    onClick={() =>
                      setModal({ type: "rename", name: program!.name })
                    }
                  >
                    Изменить название
                  </button>
                  <button
                    className="menu-item"
                    onClick={() =>
                      setModal({
                        type: "copy-program",
                        source: program,
                        target: person!.id,
                      })
                    }
                  >
                    <Copy size={19} />
                    Копировать человеку
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      mutate((next) =>
                        next.templates.push({
                          ...structuredClone(program!),
                          id: uid(),
                          next: 0,
                        }),
                      );
                      setModal(null);
                      flash("Структура сохранена в общие шаблоны");
                    }}
                  >
                    <BookOpen size={19} />
                    Сохранить как шаблон
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      mutate((next) => {
                        const p = next.people.find((p) => p.id === person!.id)!;
                        p.programs.forEach((pg) => {
                          pg.active =
                            pg.id === program!.id ? !pg.active : false;
                        });
                      });
                      setModal(null);
                    }}
                  >
                    <Archive size={19} />
                    {program!.active
                      ? "Переместить в архив"
                      : "Сделать активной"}
                  </button>
                </>
              )}
              {modal.type === "copy-program" && (
                <>
                  <h2>Копировать программу</h2>
                  <p className="muted">
                    Только упражнения и дни. Без результатов и пометок.
                  </p>
                  <label className="field">
                    <span>Кому</span>
                    <select
                      value={modal.target}
                      onChange={(e) =>
                        setModal({ ...modal, target: e.target.value })
                      }
                    >
                      {store.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn primary full"
                    onClick={() => {
                      mutate((next) => {
                        const p = next.people.find(
                          (p) => p.id === modal.target,
                        )!;
                        p.programs.push({
                          ...structuredClone(modal.source),
                          id: uid(),
                          name: modal.source.name + " · копия",
                          active: !p.programs.some((pg) => pg.active),
                          next: 0,
                          days: modal.source.days.map((d: Day) => ({
                            ...d,
                            id: uid(),
                            exercises: [...d.exercises],
                          })),
                        });
                      });
                      go({ page: "person", person: modal.target });
                      setPersonTab("Программы");
                      flash("Независимая копия создана");
                    }}
                  >
                    Создать копию
                  </button>
                </>
              )}
              {modal.type === "day-menu" && (
                <>
                  <h2>День программы</h2>
                  <button
                    className="menu-item"
                    onClick={() =>
                      setModal({
                        type: "rename",
                        name: day!.name,
                        day: day!.id,
                      })
                    }
                  >
                    Изменить название
                  </button>
                  {[-1, 1].map((delta) => (
                    <button
                      className="menu-item"
                      key={delta}
                      disabled={
                        program!.days.findIndex((d) => d.id === day!.id) +
                          delta <
                          0 ||
                        program!.days.findIndex((d) => d.id === day!.id) +
                          delta >=
                          program!.days.length
                      }
                      onClick={() => {
                        editProgram((pg) => {
                          const nextId = pg.days[pg.next]?.id;
                          const index = pg.days.findIndex(
                            (d) => d.id === day!.id,
                          );
                          const [d] = pg.days.splice(index, 1);
                          pg.days.splice(index + delta, 0, d);
                          pg.next = Math.max(
                            0,
                            pg.days.findIndex((d) => d.id === nextId),
                          );
                        });
                        setModal(null);
                      }}
                    >
                      {delta < 0 ? "Раньше в программе" : "Позже в программе"}
                    </button>
                  ))}
                  <button
                    className="menu-item"
                    onClick={() => {
                      const copy = {
                        ...structuredClone(day!),
                        id: uid(),
                        name: day!.name + " · копия",
                      };
                      editProgram((pg) => pg.days.push(copy));
                      go({ ...route, day: copy.id });
                      flash("День скопирован");
                    }}
                  >
                    <Copy size={19} />
                    Дублировать день
                  </button>
                  <button
                    className="menu-item"
                    onClick={() =>
                      setModal({ type: "copy-day", target: person!.id })
                    }
                  >
                    <Users size={19} />
                    Копировать другому человеку
                  </button>
                </>
              )}
              {modal.type === "copy-day" && (
                <>
                  <h2>Копировать день</h2>
                  <label className="field">
                    <span>Кому</span>
                    <select
                      value={modal.target}
                      onChange={(e) =>
                        setModal({ ...modal, target: e.target.value })
                      }
                    >
                      {store.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn primary full"
                    onClick={() => {
                      mutate((next) => {
                        const p = next.people.find(
                          (p) => p.id === modal.target,
                        )!;
                        let pg = p.programs.find((pg) => pg.active);
                        if (!pg) {
                          pg = { ...newProgram(), days: [] };
                          p.programs.push(pg);
                        }
                        pg.days.push({
                          ...structuredClone(day!),
                          id: uid(),
                          name: day!.name + " · копия",
                        });
                      });
                      setModal(null);
                      flash("День скопирован");
                    }}
                  >
                    Скопировать в активную программу
                  </button>
                </>
              )}
              {modal.type === "exercise-menu" && (
                <>
                  <h2>{ex(modal.id).name}</h2>
                  <button
                    className="menu-item"
                    onClick={() => openPicker(modal.id)}
                  >
                    <Replace size={19} />
                    Заменить упражнение
                  </button>
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      const removedId = modal.id,
                        dayId = day!.id,
                        programId = program!.id,
                        personId = person!.id,
                        index = day!.exercises.indexOf(removedId);
                      setUndo(() => (next: Store) => {
                        const target = next.people
                          .find((p) => p.id === personId)
                          ?.programs.find((p) => p.id === programId)
                          ?.days.find((d) => d.id === dayId);
                        if (target && !target.exercises.includes(removedId))
                          target.exercises.splice(
                            Math.min(index, target.exercises.length),
                            0,
                            removedId,
                          );
                      });
                      editProgram((pg) => {
                        const d = pg.days.find((d) => d.id === route.day)!;
                        d.exercises = d.exercises.filter(
                          (id) => id !== modal.id,
                        );
                      });
                      setModal(null);
                      flash("Упражнение убрано");
                    }}
                  >
                    <Trash2 size={19} />
                    Убрать из этого дня
                  </button>
                </>
              )}
              {modal.type === "correct-result" && (
                <>
                  <h2>{modal.name}</h2>
                  <p className="muted">
                    {labelDate(modal.date, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <div className="inputs">
                    <label>
                      Вес / нагрузка
                      <input
                        aria-label="Исправленный вес"
                        value={modal.weight}
                        onChange={(e) =>
                          setModal({ ...modal, weight: e.target.value })
                        }
                      />
                    </label>
                    <span>×</span>
                    <label>
                      Повторы
                      <input
                        aria-label="Исправленные повторы"
                        inputMode="numeric"
                        value={modal.reps}
                        onChange={(e) =>
                          setModal({ ...modal, reps: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <button
                    className="btn primary full"
                    disabled={!modal.weight.trim() || !modal.reps.trim()}
                    onClick={() => {
                      mutate((next) =>
                        correctResult(
                          next,
                          modal.person,
                          modal.session,
                          modal.index,
                          modal.weight,
                          modal.reps,
                        ),
                      );
                      setModal(null);
                      flash("Результат исправлен");
                    }}
                  >
                    Сохранить
                  </button>
                </>
              )}
              {modal.type === "history" && (
                <>
                  <h2>{ex(modal.exercise).name}</h2>
                  <p className="muted">{personById(modal.person).name}</p>
                  {resultHistory(store, modal.person, modal.exercise)
                    .reverse()
                    .map((r, i) => (
                      <div className="history-result" key={i}>
                        <span>
                          {r.date ? labelDate(r.date) : "Исходное значение"}
                        </span>
                        <b>{format(r.weight, r.reps)}</b>
                      </div>
                    ))}
                </>
              )}
              {modal.type === "exercise-preview" && (
                <ExerciseEditor
                  exercise={ex(modal.id)}
                  onSave={(exercise) => {
                    mutate((next) => {
                      next.exercises = next.exercises.map((e) =>
                        e.id === exercise.id ? exercise : e,
                      );
                    });
                    setModal(null);
                    flash("Упражнение сохранено");
                  }}
                  onOpen={(index) => setLightbox({ id: modal.id, index })}
                />
              )}
              {modal.type === "import" && importValue && (
                <>
                  <h2>Восстановить данные?</h2>
                  <p>
                    В файле: {importValue.people.length} человек,{" "}
                    {importValue.sessions.length} завершённых тренировок. Копия
                    заменит данные на этом телефоне. Текущее состояние
                    сохранится для восстановления.
                  </p>
                  <button
                    className="btn primary full"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        const next = await importTraining(importValue);
                        setStore(next);
                        setImportValue(null);
                        go({ page: "today" });
                        flash("Данные восстановлены");
                      } catch (e) {
                        flash((e as Error).message);
                      }
                    }}
                  >
                    Восстановить
                  </button>
                </>
              )}
              {modal.type === "rename" && (
                <>
                  <h2>Название</h2>
                  <label className="field">
                    <span>Название</span>
                    <input
                      value={modal.name}
                      onChange={(e) =>
                        setModal({ ...modal, name: e.target.value })
                      }
                    />
                  </label>
                  <button
                    className="btn primary full"
                    disabled={!modal.name.trim()}
                    onClick={() => {
                      editProgram((pg) => {
                        if (modal.day)
                          pg.days.find((d) => d.id === modal.day)!.name =
                            modal.name.trim();
                        else pg.name = modal.name.trim();
                      });
                      setModal(null);
                    }}
                  >
                    Сохранить
                  </button>
                </>
              )}
            </div>
            {modal.type === "picker" && (
              <div className="sheet-footer">
                <button
                  className="btn primary full"
                  disabled={!modal.selected.length}
                  onClick={savePicker}
                >
                  {modal.replace
                    ? "Заменить упражнение"
                    : `Добавить ${quantity(modal.selected.length)}`}
                  <Check size={18} />
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Фотографии упражнения"
        >
          <button
            className="icon"
            aria-label="Закрыть галерею"
            onClick={() => setLightbox(null)}
          >
            <X />
          </button>
          <Gallery
            images={ex(lightbox.id).images.filter((x): x is string => !!x)}
            name={ex(lightbox.id).name}
            initial={lightbox.index}
          />
        </div>
      )}
    </div>
  );
}
