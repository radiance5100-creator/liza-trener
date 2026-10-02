import { initialExercises, type Exercise } from "./seed";
import { validateData, type Result } from "./storage";

export type Day = { id: string; name: string; exercises: string[] };
export type Program = {
  id: string;
  name: string;
  days: Day[];
  next: number;
  active: boolean;
};
export type RecordValue = {
  id: string;
  name: string;
  weight: string;
  reps: string;
  date: string;
};
export type Person = {
  id: string;
  name: string;
  short: string;
  avatar?: { photo?: string; color?: string };
  note: string;
  contact: string;
  programs: Program[];
  flags: string[];
  records: RecordValue[];
};
export type Entry = {
  id: string;
  name: string;
  weight: string;
  reps: string;
  done: boolean;
  previous: string;
  previousDate: string;
};
export type Participant = {
  personId: string;
  programId?: string;
  dayId?: string;
  dayName: string;
  entries: Entry[];
  opened: number;
  status: "pending" | "active" | "done" | "absent";
  scroll: number;
};
export type Appointment = {
  id: string;
  date: string;
  time: string;
  duration: number | null;
  mode: "separate" | "shared";
  participants: Participant[];
  status: "planned" | "active" | "done" | "cancelled";
  selected: number;
  sharedOpened: number;
};
export type Session = {
  id: string;
  personId: string;
  date: string;
  dayName: string;
  results: Entry[];
};
export type Store = {
  version: 2;
  exercises: Exercise[];
  people: Person[];
  appointments: Appointment[];
  sessions: Session[];
  templates: Program[];
};
export const scheduleTimes = Array.from(
  { length: 25 },
  (_, i) =>
    `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export const uid = () => crypto.randomUUID();
export const iso = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const format = (weight: string, reps: string) =>
  `${weight || "—"} × ${reps || "—"}`;
export const newProgram = (name = "Текущая программа"): Program => ({
  id: uid(),
  name,
  active: true,
  next: 0,
  days: [],
});
export function emptyStore(): Store {
  return {
    version: 2,
    exercises: structuredClone(initialExercises),
    people: [
      {
        id: "self",
        name: "Я",
        short: "Я",
        note: "",
        contact: "",
        programs: [],
        flags: [],
        records: [],
      },
    ],
    appointments: [],
    sessions: [],
    templates: [],
  };
}
export function resultHistory(
  store: Store,
  personId: string,
  exerciseId?: string,
): RecordValue[] {
  const sessions = store.sessions
    .filter((s) => s.personId === personId)
    .flatMap((s) =>
      s.results
        .filter((r) => r.done)
        .map((r) => ({
          id: r.id,
          name: r.name,
          weight: r.weight,
          reps: r.reps,
          date: s.date,
        })),
    );
  const key = (r: RecordValue) =>
    JSON.stringify([r.id, r.date, r.weight, r.reps]);
  const sessionValues = new Set(sessions.map(key));
  const records = (
    store.people.find((p) => p.id === personId)?.records ?? []
  ).filter((r) => !sessionValues.has(key(r)));
  const unique = new Map<string, RecordValue>();
  for (const r of records) unique.set(key(r), r);
  return [...unique.values(), ...sessions]
    .filter((r) => !exerciseId || r.id === exerciseId)
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function entry(store: Store, personId: string, id: string): Entry {
  const r = resultHistory(store, personId, id).at(-1);
  return {
    id,
    name:
      store.exercises.find((e) => e.id === id)?.name ?? r?.name ?? "Упражнение",
    weight: r?.weight ?? "",
    reps: r?.reps ?? "",
    done: false,
    previous: r ? format(r.weight, r.reps) : "",
    previousDate: r?.date ?? "",
  };
}
export function participant(
  store: Store,
  personId: string,
  dayId?: string,
): Participant {
  const program = store.people
    .find((p) => p.id === personId)
    ?.programs.find((p) => p.active);
  const day =
    program?.days.find((d) => d.id === dayId) ?? program?.days[program.next];
  return {
    personId,
    programId: program?.id,
    dayId: day?.id,
    dayName: day?.name ?? "Без программы",
    entries: (day?.exercises ?? []).map((id) => entry(store, personId, id)),
    opened: 0,
    status: "pending",
    scroll: 0,
  };
}
export function appointment(
  store: Store,
  ids: string[],
  time: string,
): Appointment {
  return {
    id: uid(),
    date: iso(),
    time,
    duration: null,
    mode: "separate",
    participants: ids.map((id) => participant(store, id)),
    status: "planned",
    selected: 0,
    sharedOpened: 0,
  };
}
export function oneOffParticipant(personId: string): Participant {
  return {
    personId,
    dayName: "Разовая тренировка",
    entries: [],
    opened: 0,
    status: "pending",
    scroll: 0,
  };
}
export function addWorkoutExercises(
  store: Store,
  appointmentId: string,
  ids: string[],
) {
  const a = store.appointments.find((a) => a.id === appointmentId)!;
  const targets =
    a.mode === "shared" ? a.participants : [a.participants[a.selected]];
  if (a.status !== "active" || targets.some((p) => p.status !== "active"))
    return;
  const added = [...new Set(ids)].filter(
    (id) =>
      store.exercises.some((e) => e.id === id) &&
      !targets.some((p) => p.entries.some((e) => e.id === id)),
  );
  const first = targets[0].entries.length;
  targets.forEach((p) => {
    p.entries.push(...added.map((id) => entry(store, p.personId, id)));
    if (added.length) p.opened = first;
  });
  if (added.length && a.mode === "shared") a.sharedOpened = first;
}
export function removePerson(store: Store, id: string) {
  if (id === "self") throw new Error("Карточку «Я» нельзя удалить");
  const person = store.people.find((p) => p.id === id);
  if (!person) return;
  store.people = store.people.filter((p) => p.id !== id);
  store.sessions = store.sessions.filter((s) => s.personId !== id);
  store.appointments = store.appointments.filter((a) => {
    if (!a.participants.some((p) => p.personId === id)) return true;
    const selectedId = a.participants[a.selected]?.personId;
    const wasShared = a.mode === "shared";
    a.participants = a.participants.filter((p) => p.personId !== id);
    a.selected = Math.max(
      0,
      a.participants.findIndex((p) => p.personId === selectedId),
    );
    if (a.participants.length === 1) {
      a.mode = "separate";
      if (wasShared) a.participants[0].opened = a.sharedOpened;
    }
    if (
      a.status === "active" &&
      a.participants.every((p) => p.status === "done" || p.status === "absent")
    )
      a.status = "done";
    return a.participants.length > 0;
  });
}
export function startAppointment(store: Store, id: string): string {
  const a = store.appointments.find((a) => a.id === id)!;
  if (a.status === "active") {
    if (a.participants[a.selected]?.status !== "active")
      a.selected = Math.max(
        0,
        a.participants.findIndex((p) => p.status === "active"),
      );
    return a.id;
  }
  if (a.status !== "planned") throw new Error("Это занятие уже закрыто");
  const conflict = store.appointments.find(
    (x) =>
      x.id !== id &&
      x.status === "active" &&
      x.participants.some(
        (p) =>
          p.status === "active" &&
          a.participants.some(
            (t) => t.personId === p.personId && t.status !== "absent",
          ),
      ),
  );
  if (conflict) return startAppointment(store, conflict.id);
  // Refresh personal results at start, not when the appointment was created.
  a.participants.forEach((p) => {
    if (p.status === "pending") {
      p.entries = p.entries.map((e) => entry(store, p.personId, e.id));
      p.status = "active";
    }
  });
  a.status = "active";
  a.selected = Math.max(
    0,
    a.participants.findIndex((p) => p.status === "active"),
  );
  return a.id;
}
export function confirmEntry(a: Appointment, personId: string, index: number) {
  const p = a.participants.find((p) => p.personId === personId);
  const e = p?.entries[index];
  if (
    a.status !== "active" ||
    p?.status !== "active" ||
    !e ||
    !e.weight.trim() ||
    !e.reps.trim()
  )
    return;
  e.done = true;
  const targets =
    a.mode === "shared"
      ? a.participants.filter((p) => p.status === "active")
      : [p];
  if (!targets.every((p) => p.entries[index]?.done)) return;
  const incomplete = (i: number) => targets.some((p) => !p.entries[i]?.done);
  let next = p.entries.findIndex((_, i) => i > index && incomplete(i));
  if (next < 0) next = p.entries.findIndex((_, i) => incomplete(i));
  if (a.mode === "shared") a.sharedOpened = next;
  else p.opened = next;
}

// Prepared snapshots deliberately contain no planned load or repetitions.
export function prepareExercises(
  store: Store,
  appointmentId: string,
  ids: string[],
) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned") return;
  const targets =
    a.mode === "shared" ? a.participants : [a.participants[a.selected]];
  const unique = [...new Set(ids)].filter((id) =>
    store.exercises.some((e) => e.id === id),
  );
  const sharedId = a.participants[0].entries[a.sharedOpened]?.id;
  targets.forEach((p) => {
    const openedId = p.entries[p.opened]?.id;
    p.entries = unique.map((id) => ({
      ...entry(store, p.personId, id),
      weight: "",
      reps: "",
      previous: "",
      previousDate: "",
    }));
    p.opened = openedId ? p.entries.findIndex((e) => e.id === openedId) : 0;
  });
  if (a.mode === "shared")
    a.sharedOpened = sharedId ? unique.indexOf(sharedId) : 0;
}

export function correctResult(
  store: Store,
  personId: string,
  sessionId: string,
  index: number,
  weight: string,
  reps: string,
) {
  const s = store.sessions.find(
    (s) => s.id === sessionId && s.personId === personId,
  );
  const r = s?.results[index];
  if (!s || !r?.done || !weight.trim() || !reps.trim())
    throw new Error("Нельзя исправить этот результат");
  const person = store.people.find((p) => p.id === personId)!;
  person.records.forEach((record) => {
    if (
      record.id === r.id &&
      record.date === s.date &&
      record.weight === r.weight &&
      record.reps === r.reps
    ) {
      record.weight = weight.trim();
      record.reps = reps.trim();
    }
  });
  const a = store.appointments.find((a) => a.id + ":" + personId === sessionId);
  const snapshot = a?.participants.find(
    (p) => p.personId === personId && p.status === "done",
  )?.entries[index];
  if (snapshot?.id === r.id) {
    snapshot.weight = weight.trim();
    snapshot.reps = reps.trim();
  }
  r.weight = weight.trim();
  r.reps = reps.trim();
}

export function prepareDay(store: Store, appointmentId: string, dayId: string) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned") return;
  const source = a.participants[a.selected];
  const chosen = participant(store, source.personId, dayId);
  if (chosen.dayId !== dayId) return;
  a.participants[a.selected] = chosen;
  if (a.mode === "shared")
    a.participants.forEach((p, i) => {
      if (i !== a.selected) {
        p.programId = undefined;
        p.dayId = undefined;
        p.dayName = chosen.dayName + " · совместная";
      }
    });
  prepareExercises(
    store,
    a.id,
    chosen.entries.map((e) => e.id),
  );
}

export function prepareMode(
  store: Store,
  appointmentId: string,
  mode: Appointment["mode"],
) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned" || a.mode === mode) return;
  a.mode = mode;
  if (mode === "shared") {
    const source = a.participants[a.selected];
    a.participants.forEach((p, i) => {
      if (i !== a.selected) {
        p.programId = undefined;
        p.dayId = undefined;
        p.dayName = source.dayName + " · совместная";
      }
    });
    prepareExercises(
      store,
      a.id,
      source.entries.map((e) => e.id),
    );
  }
}
export function finish(
  store: Store,
  appointmentId: string,
  personId: string,
  absent = false,
) {
  const a = store.appointments.find((a) => a.id === appointmentId)!;
  const p = a.participants.find((p) => p.personId === personId)!;
  if (a.status === "cancelled" || p.status === "done" || p.status === "absent")
    return;
  if (!absent && p.status !== "active") return;
  p.status = absent ? "absent" : "done";
  if (!absent) {
    const id = a.id + ":" + personId;
    if (!store.sessions.some((s) => s.id === id)) {
      store.sessions.push({
        id,
        personId,
        date: a.date,
        dayName: p.dayName,
        results: structuredClone(p.entries).map((e) =>
          e.done ? e : { ...e, weight: "", reps: "" },
        ),
      });
      const pg = store.people
        .find((p) => p.id === personId)!
        .programs.find((pg) => pg.id === p.programId);
      const index = pg?.days.findIndex((d) => d.id === p.dayId) ?? -1;
      if (pg && index >= 0) pg.next = (index + 1) % pg.days.length;
    }
  }
  if (a.participants.every((p) => p.status === "done" || p.status === "absent"))
    a.status = "done";
}
export function overlaps(a: Appointment, b: Appointment): boolean {
  const mins = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return (
    a.id !== b.id &&
    a.date === b.date &&
    a.status !== "cancelled" &&
    !!a.time &&
    !!b.time &&
    a.duration !== null &&
    b.duration !== null &&
    mins(a.time) < mins(b.time) + b.duration &&
    mins(b.time) < mins(a.time) + a.duration
  );
}

export function migrate(value: unknown): Store {
  if ((value as Store)?.version === 2) return validateStore(value);
  const old = validateData(value);
  const store = emptyStore();
  store.exercises = structuredClone(old.exercises);
  const clientIds = new Map(
    old.clients.map((c) => [c.id, c.id === "self" ? uid() : c.id]),
  );
  const owner = (id?: string) => (id ? clientIds.get(id)! : "self");
  const record = (r: Result, date = ""): RecordValue => ({
    id: r.exerciseId,
    name: r.name,
    weight: r.weight,
    reps: r.reps,
    date,
  });
  store.people.push(
    ...old.clients.map((c) => ({
      id: owner(c.id),
      name: c.name,
      short: c.name.slice(0, 2).toUpperCase(),
      note: c.note,
      contact: c.contact,
      programs: [],
      flags: Object.keys(c.techniques).filter((id) => c.techniques[id].flagged),
      records: c.results.map((r) => record(r)),
    })),
  );
  store.people[0].flags = Object.keys(old.techniques).filter(
    (id) => old.techniques[id].flagged,
  );
  store.people[0].records = old.exercises.flatMap((e) => [
    { id: e.id, name: e.name, weight: e.weight, reps: e.reps, date: "" },
    ...[...e.history].reverse().map((h) => ({
      id: e.id,
      name: e.name,
      weight: h.weight,
      reps: h.reps,
      date: h.date.slice(0, 10),
    })),
  ]);
  // Preserve references even when an old backup no longer contains a library item.
  const ensure = (id: string, name = "Упражнение из архива") => {
    if (!store.exercises.some((e) => e.id === id))
      store.exercises.push({
        id,
        name,
        group: "Малые мышечные группы",
        kind: "",
        weight: "",
        reps: "",
        note: "",
        filmed: false,
        images: [null, null],
        history: [],
      });
  };
  old.sessions.forEach((s) =>
    s.results.forEach((r) => ensure(r.exerciseId, r.name)),
  );
  old.draft?.results.forEach((r) => ensure(r.exerciseId, r.name));
  store.people.forEach((p) => {
    p.records.forEach((r) => ensure(r.id, r.name));
    p.flags.forEach((id) => ensure(id));
    const plans = old.plans.filter((x) => owner(x.clientId) === p.id);
    if (plans.length)
      p.programs = [
        {
          ...newProgram(),
          days: plans.map((x) => {
            x.exerciseIds.forEach((id) => ensure(id));
            return {
              id: x.id,
              name: x.name,
              exercises: [...new Set(x.exerciseIds)],
            };
          }),
        },
      ];
  });
  store.sessions = [...old.sessions]
    .reverse()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      id: s.id,
      personId: owner(s.clientId),
      date: s.date.slice(0, 10),
      dayName: s.planName,
      results: s.results.map((r) => ({
        ...record(r),
        done: true,
        previous: "",
        previousDate: "",
      })),
    }));
  if (old.draft) {
    const d = old.draft,
      personId = owner(d.clientId);
    const p = participant(store, personId);
    // The old draft has no reliable program day identity or start time.
    p.programId = undefined;
    p.dayId = undefined;
    p.dayName = d.planName;
    p.status = "active";
    p.entries = d.results.map((r) => ({
      ...entry(store, personId, r.exerciseId),
      name: r.name,
      weight: r.weight,
      reps: r.reps,
      done: false,
    }));
    store.appointments.push({
      id: uid(),
      date: iso(),
      time: "",
      duration: null,
      mode: "separate",
      participants: [p],
      status: "active",
      selected: 0,
      sharedOpened: 0,
    });
  }
  return validateStore(store);
}

export function validateStore(value: unknown): Store {
  const fail = () => {
    throw new Error("Повреждена резервная копия. Текущие данные не изменены.");
  };
  const obj = (x: any) => x && typeof x === "object" && !Array.isArray(x);
  const str = (x: any) => typeof x === "string";
  const list = (x: any, fn: (x: any) => boolean) =>
    Array.isArray(x) && x.every(fn);
  const unique = (xs: any[]) => new Set(xs.map((x) => x.id)).size === xs.length;
  const date = (x: any) =>
    str(x) &&
    /^\d{4}-\d{2}-\d{2}$/.test(x) &&
    !Number.isNaN(Date.parse(x)) &&
    new Date(x).toISOString().slice(0, 10) === x;
  const s = value as Store;
  if (
    !obj(s) ||
    s.version !== 2 ||
    !Array.isArray(s.exercises) ||
    !Array.isArray(s.people) ||
    !Array.isArray(s.sessions) ||
    !Array.isArray(s.appointments) ||
    !Array.isArray(s.templates)
  )
    fail();
  if (
    !list(
      s.exercises,
      (e) =>
        obj(e) &&
        str(e.id) &&
        str(e.name) &&
        str(e.group) &&
        str(e.note) &&
        list(
          e.images,
          (i) => i === null || (str(i) && i.startsWith("data:image/")),
        ) &&
        e.images.length === 2 &&
        Array.isArray(e.history),
    ) ||
    !unique(s.exercises)
  )
    fail();
  const hasExercise = (id: any) =>
    str(id) && s.exercises.some((e) => e.id === id);
  const program = (p: any) =>
    obj(p) &&
    str(p.id) &&
    str(p.name) &&
    typeof p.active === "boolean" &&
    Number.isInteger(p.next) &&
    p.next >= 0 &&
    list(
      p.days,
      (d) =>
        obj(d) &&
        str(d.id) &&
        str(d.name) &&
        list(d.exercises, hasExercise) &&
        new Set(d.exercises).size === d.exercises.length,
    ) &&
    unique(p.days) &&
    (p.days.length ? p.next < p.days.length : p.next === 0);
  if (
    !list(
      s.people,
      (p) =>
        obj(p) &&
        str(p.id) &&
        str(p.name) &&
        str(p.short) &&
        (p.avatar === undefined || (obj(p.avatar) &&
          (p.avatar.photo === undefined || (str(p.avatar.photo) && /^data:image\/(jpeg|png|webp|gif);base64,/.test(p.avatar.photo))) &&
          (p.avatar.color === undefined || (str(p.avatar.color) && /^#[0-9a-f]{6}$/i.test(p.avatar.color))))) &&
        str(p.contact) &&
        str(p.note) &&
        list(p.programs, program) &&
        unique(p.programs) &&
        p.programs.filter((p: Program) => p.active).length <= 1 &&
        list(p.flags, hasExercise) &&
        list(
          p.records,
          (r) =>
            obj(r) &&
            hasExercise(r.id) &&
            str(r.name) &&
            str(r.weight) &&
            str(r.reps) &&
            (r.date === "" || date(r.date)),
        ),
    ) ||
    !unique(s.people) ||
    s.people.filter((p) => p.id === "self").length !== 1 ||
    !list(s.templates, program) ||
    !unique(s.templates)
  )
    fail();
  const person = (id: any) => s.people.some((p) => p.id === id);
  const validEntry = (e: any) =>
    obj(e) &&
    hasExercise(e.id) &&
    str(e.name) &&
    str(e.weight) &&
    str(e.reps) &&
    typeof e.done === "boolean" &&
    str(e.previous) &&
    (e.previousDate === "" || date(e.previousDate));
  if (
    !list(
      s.sessions,
      (x) =>
        obj(x) &&
        str(x.id) &&
        person(x.personId) &&
        date(x.date) &&
        str(x.dayName) &&
        list(x.results, validEntry),
    ) ||
    !unique(s.sessions)
  )
    fail();
  const activePeople = new Set<string>();
  if (
    !list(
      s.appointments,
      (a) =>
        obj(a) &&
        str(a.id) &&
        date(a.date) &&
        (a.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) &&
        (a.duration === null ||
          (Number.isFinite(a.duration) && a.duration > 0)) &&
        ["planned", "active", "done", "cancelled"].includes(a.status) &&
        ["separate", "shared"].includes(a.mode) &&
        list(a.participants, (p) => {
          if (
            !obj(p) ||
            !person(p.personId) ||
            !str(p.dayName) ||
            !list(p.entries, validEntry) ||
            !["pending", "active", "done", "absent"].includes(p.status) ||
            !Number.isInteger(p.opened) ||
            p.opened < -1 ||
            (p.entries.length && p.opened >= p.entries.length) ||
            !Number.isFinite(p.scroll) ||
            p.scroll < 0
          )
            return false;
          if (a.status === "active" && p.status === "active") {
            if (activePeople.has(p.personId)) return false;
            activePeople.add(p.personId);
          }
          return true;
        }) &&
        a.participants.length >= 1 &&
        a.participants.length <= 2 &&
        new Set(a.participants.map((p: Participant) => p.personId)).size ===
          a.participants.length &&
        Number.isInteger(a.selected) &&
        a.selected >= 0 &&
        a.selected < a.participants.length &&
        Number.isInteger(a.sharedOpened) &&
        a.sharedOpened >= -1,
    ) ||
    !unique(s.appointments)
  )
    fail();
  return structuredClone(s);
}
