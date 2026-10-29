import { initialExercises, type Exercise } from "./seed";
import { validateData, type Result } from "./storage";

export type ExerciseOptions = { equipment?: "" | "barbell" | "dumbbells"; setId?: string; optional?: boolean };
export type Day = { id: string; name: string; exercises: string[]; options?: Record<string, ExerciseOptions> };
export const equipmentLabel = (value?: string) => value === "barbell" ? "Штанга" : value === "dumbbells" ? "Гантели" : "";
export function setClass(items: { setId?: string; optional?: boolean }[], index: number) {
  const id = items[index]?.setId;
  const optional = items[index]?.optional ? " optional-exercise" : "";
  if (!id) return optional;
  return optional + " grouped-exercise" + (items[index - 1]?.setId === id ? " group-middle" : " group-start") + (items[index + 1]?.setId === id ? "" : " group-end");
}
export function normalizeSets<T extends { id: string; setId?: string }>(items: T[]) {
  for (let i = 0; i < items.length;) {
    const group = items[i].setId;
    if (!group) { i++; continue; }
    let end = i + 1;
    while (end < items.length && items[end].setId === group) end++;
    if (end - i < 2) delete items[i].setId;
    i = end;
  }
}
export function setExerciseGroup<T extends { id: string; setId?: string }>(items: T[], index: number, linked: boolean): T[] {
  const next = structuredClone(items);
  if (!next[index]) return next;
  if (linked) {
    const previous = next[index - 1];
    if (!previous || (previous.setId && next.filter((e) => e.setId === previous.setId && e.id !== next[index].id).length >= 3)) return next;
    const group = previous.setId || uid(); previous.setId = group; next[index].setId = group;
  } else delete next[index].setId;
  normalizeSets(next); return next;
}
export type Program = {
  pairId?: string;
  partnerId?: string;
  id: string;
  name: string;
  days: Day[];
  next: number;
  active: boolean;
};
export type RecordValue = {
  equipment?: ExerciseOptions["equipment"];
  id: string;
  name: string;
  weight: string;
  reps: string;
  date: string;
};
export type Person = {
  id: string;
  archivedAt?: string;
  name: string;
  short: string;
  avatar?: { photo?: string; color?: string; text?: string };
  note: string;
  contact: string;
  programs: Program[];
  flags: string[];
  records: RecordValue[];
};
export type Entry = ExerciseOptions & {
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
  comment?: string;
  id: string;
  date: string;
  time: string;
  duration: number | null;
  mode: "separate" | "shared";
  participants: Participant[];
  status: "planned" | "active" | "done" | "cancelled";
  selected: number;
  sharedOpened: number;
  prepared?: boolean;
  awaitingSchedule?: boolean;
};
export type Session = {
  comment?: string;
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
export function pairedProgram(store: Store, ownerId: string, program: Program) {
  return program.pairId && program.partnerId ? store.people.find((p) => p.id === program.partnerId)?.programs.find((p) => p.pairId === program.pairId && p.partnerId === ownerId) : undefined;
}
export function syncPairedProgram(store: Store, ownerId: string, programId: string) {
  const program = store.people.find((p) => p.id === ownerId)?.programs.find((p) => p.id === programId);
  if (!program) return;
  const peer = pairedProgram(store, ownerId, program);
  if (!peer) return;
  const nextDay = peer.days[peer.next]?.id;
  peer.name = program.name;
  peer.days = structuredClone(program.days);
  const index = peer.days.findIndex((d) => d.id === nextDay);
  peer.next = index >= 0 ? index : Math.min(peer.next, Math.max(0, peer.days.length - 1));
}
export function setProgramActive(store: Store, ownerId: string, programId: string, active: boolean) {
  const owner = store.people.find((p) => p.id === ownerId)!;
  const program = owner.programs.find((p) => p.id === programId)!;
  const peer = pairedProgram(store, ownerId, program);
  if (active) {
    const owners = [owner, ...(peer ? [store.people.find((p) => p.id === program.partnerId)!] : [])];
    owners.forEach((person) => person.programs.filter((p) => p.active && p !== program && p !== peer).forEach((p) => {
      p.active = false; const other = pairedProgram(store, person.id, p); if (other) other.active = false;
    }));
  }
  program.active = active; if (peer) peer.active = active;
}
export function linkProgramPartner(store: Store, ownerId: string, programId: string, partnerId: string) {
  const owner = store.people.find((p) => p.id === ownerId), partner = store.people.find((p) => p.id === partnerId);
  const program = owner?.programs.find((p) => p.id === programId);
  if (!program || !partner || partner.archivedAt || ownerId === partnerId) throw new Error("Выберите второго участника");
  if (program.pairId) throw new Error("У этой программы уже есть второй участник");
  program.pairId = uid(); program.partnerId = partnerId;
  partner.programs.push({ ...structuredClone(program), id: uid(), partnerId: ownerId, next: program.next, active: false });
  setProgramActive(store, ownerId, programId, program.active);
}
export function syncWorkoutPrograms(store: Store, appointmentId: string, personIds?: string[]) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "active") return;
  a.participants.filter((p) => p.status === "active" && (!personIds || personIds.includes(p.personId))).forEach((p) => {
    const pg = store.people.find((x) => x.id === p.personId)?.programs.find((pg) => pg.id === p.programId);
    const day = pg?.days.find((d) => d.id === p.dayId);
    if (!day || !pg) return;
    day.exercises = p.entries.map((e) => e.id);
    day.options = Object.fromEntries(p.entries.map(({ id, equipment, setId, optional }) => [id, {
      ...(equipment !== undefined ? { equipment } : {}), ...(setId !== undefined ? { setId } : {}), ...(optional !== undefined ? { optional } : {}),
    }]));
    syncPairedProgram(store, p.personId, pg.id);
  });
}
export function replaceWorkoutExercise(store: Store, appointmentId: string, index: number, newId: string) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "active" || !store.exercises.some((e) => e.id === newId)) return;
  const targets = a.mode === "shared" ? a.participants : [a.participants[a.selected]];
  if (targets.some((p) => p.status !== "active" || !p.entries[index] || p.entries.some((e) => e.id === newId))) return;
  targets.forEach((p) => { p.entries[index] = entry(store, p.personId, newId, { setId: p.entries[index].setId, optional: p.entries[index].optional }); });
  syncWorkoutPrograms(store, a.id, targets.map((p) => p.personId));
}
export function correctLatestResult(store: Store, personId: string, exerciseId: string, equipment: ExerciseOptions["equipment"], weight: string, reps: string) {
  if (!weight.trim() || !reps.trim()) throw new Error("Укажите вес и повторы");
  const latest = resultHistory(store, personId, exerciseId).filter((r) => (r.equipment || "") === (equipment || "")).at(-1);
  if (!latest) throw new Error("Сохранённого результата пока нет");
  const matches = (r: RecordValue | Entry) => r.id === exerciseId && (r.equipment || "") === (equipment || "") && r.weight === latest.weight && r.reps === latest.reps;
  const session = store.sessions.filter((s) => s.personId === personId && s.date === latest.date && s.results.some((r) => r.done && matches(r))).at(-1);
  if (session) correctResult(store, personId, session.id, session.results.reduce((last, r, i) => r.done && matches(r) ? i : last, -1), weight, reps);
  else store.people.find((p) => p.id === personId)?.records.filter((r) => r.date === latest.date && matches(r)).forEach((r) => { r.weight = weight.trim(); r.reps = reps.trim(); });
}
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
          ...(r.equipment !== undefined ? { equipment: r.equipment } : {}),
        })),
    );
  const key = (r: RecordValue) =>
    JSON.stringify([r.id, r.date, r.weight, r.reps, r.equipment || ""]);
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
export function entry(store: Store, personId: string, id: string, options?: ExerciseOptions): Entry {
  const equipment = options?.equipment ?? store.exercises.find((e) => e.id === id)?.equipment;
  const r = resultHistory(store, personId, id).filter((r) => (r.equipment || "") === (equipment || "")).at(-1);
  return {
    id,
    name:
      store.exercises.find((e) => e.id === id)?.name ?? r?.name ?? "Упражнение",
    weight: r?.weight ?? "",
    reps: r?.reps ?? "",
    done: false,
    previous: r ? format(r.weight, r.reps) : "",
    previousDate: r?.date ?? "",
    equipment: equipment ?? "",
    ...(options?.setId ? { setId: options.setId } : {}),
    ...(options?.optional !== undefined ? { optional: options.optional } : {}),
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
    entries: (day?.exercises ?? []).map((id) => entry(store, personId, id, day?.options?.[id])),
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
  if (ids.some((id) => store.people.find((p) => p.id === id)?.archivedAt))
    throw new Error("Сначала восстановите клиента из архива");
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
  if (added.length) syncWorkoutPrograms(store, a.id, targets.map((p) => p.personId));
}
export function removePerson(store: Store, id: string) {
  if (id === "self") throw new Error("Карточку «Я» нельзя удалить");
  const person = store.people.find((p) => p.id === id);
  if (!person) return;
  if (person.archivedAt) return;
  person.archivedAt = iso();
  store.appointments = store.appointments.filter((a) => {
    if (a.status === "done") return true;
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
export function restorePerson(store: Store, id: string) {
  const person = store.people.find((p) => p.id === id);
  if (!person) throw new Error("Карточка клиента не найдена");
  delete person.archivedAt;
}
export function removeWorkoutExercise(a: Appointment, personId: string, exerciseId: string, store?: Store) {
  if (a.status !== "active") throw new Error("Занятие уже закрыто");
  const targets = a.mode === "shared" ? a.participants : a.participants.filter((p) => p.personId === personId);
  if (!targets.length || targets.some((p) => p.status !== "active"))
    throw new Error("Нельзя менять завершённую тренировку");
  const sharedId = a.participants[0].entries[a.sharedOpened]?.id;
  targets.forEach((p) => {
    const openedId = p.entries[p.opened]?.id;
    p.entries = p.entries.filter((e) => e.id !== exerciseId);
    normalizeSets(p.entries);
    const index = p.entries.findIndex((e) => e.id === openedId);
    p.opened = index >= 0 ? index : Math.min(p.opened, Math.max(0, p.entries.length - 1));
  });
  if (a.mode === "shared") {
    const index = a.participants[0].entries.findIndex((e) => e.id === sharedId);
    a.sharedOpened = index >= 0 ? index : Math.min(a.sharedOpened, Math.max(0, a.participants[0].entries.length - 1));
  }
  if (store) syncWorkoutPrograms(store, a.id, targets.map((p) => p.personId));
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
  if (a.awaitingSchedule) throw new Error("Сначала запишите занятие в расписание");
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
      p.entries = p.entries.map((e) => entry(store, p.personId, e.id, e));
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
export function confirmSharedEntry(a: Appointment, index: number) {
  const targets = a.participants.filter((p) => p.status === "active");
  if (a.mode !== "shared" || a.status !== "active" || !targets.length || targets.some((p) => !p.entries[index]?.weight.trim() || !p.entries[index]?.reps.trim())) return;
  targets.forEach((p) => confirmEntry(a, p.personId, index));
}

export function nextProgramDay(program: Program, currentDayId?: string): Day {
  const index = currentDayId ? program.days.findIndex((d) => d.id === currentDayId) : program.days.length - 1;
  if (currentDayId && index < 0) throw new Error("День программы не найден");
  const existing = program.days[index + 1];
  if (existing) return existing;
  const day = { id: uid(), name: `День ${program.days.length + 1}`, exercises: [] };
  program.days.push(day);
  return day;
}

export function completePreparation(store: Store, appointmentId: string) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned" || !a.participants.every((p) => p.entries.length))
    throw new Error("Добавьте упражнения для каждого участника");
  a.prepared = true;
}

export function prepareOneOff(store: Store, appointmentId: string) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned") return;
  const targets = a.mode === "shared" ? a.participants : [a.participants[a.selected]];
  targets.forEach((p) => { p.programId = undefined; p.dayId = undefined; p.dayName = "Разовое занятие"; });
  prepareExercises(store, appointmentId, []);
}

// Prepared snapshots deliberately contain no planned load or repetitions.
export function prepareExercises(
  store: Store,
  appointmentId: string,
  ids: string[],
) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned") return;
  a.prepared = false;
  const targets =
    a.mode === "shared" ? a.participants : [a.participants[a.selected]];
  const unique = [...new Set(ids)].filter((id) =>
    store.exercises.some((e) => e.id === id),
  );
  const sourceOptions = new Map(a.participants[a.selected].entries.map((e) => [e.id, e]));
  const sharedId = a.participants[0].entries[a.sharedOpened]?.id;
  const sourceEntries = a.participants[a.selected].entries;
  targets.forEach((p) => {
    const openedId = p.entries[p.opened]?.id;
    p.entries = unique.map((id) => ({
      ...entry(store, p.personId, id, (a.mode === "shared" ? sourceEntries : p.entries).find((e) => e.id === id) ?? sourceOptions.get(id)),
      weight: "",
      reps: "",
      previous: "",
      previousDate: "",
    }));
    normalizeSets(p.entries);
    p.opened = openedId ? p.entries.findIndex((e) => e.id === openedId) : 0;
  });
  if (a.mode === "shared")
    a.sharedOpened = sharedId ? unique.indexOf(sharedId) : 0;
}
export function replacePreparedExercise(store: Store, appointmentId: string, oldId: string, newId: string) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "planned" || !store.exercises.some((e) => e.id === newId)) return;
  const targets = a.mode === "shared" ? a.participants : [a.participants[a.selected]];
  if (targets.some((p) => p.entries.some((e) => e.id === newId))) return;
  targets.forEach((p) => {
    const index = p.entries.findIndex((e) => e.id === oldId);
    if (index >= 0) p.entries[index] = entry(store, p.personId, newId, { setId: p.entries[index].setId, optional: p.entries[index].optional });
  });
  prepareExercises(store, a.id, a.participants[a.selected].entries.map((e) => e.id));
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
      record.reps === r.reps && (record.equipment || "") === (r.equipment || "")
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
        const pg = store.people.find((x) => x.id === source.personId)?.programs.find((pg) => pg.id === chosen.programId);
        const peer = pg?.partnerId === p.personId ? pairedProgram(store, source.personId, pg) : undefined;
        p.programId = peer?.id;
        p.dayId = peer ? chosen.dayId : undefined;
        p.dayName = peer ? chosen.dayName : chosen.dayName + " · совместная";
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
  a.prepared = false;
  a.mode = mode;
  if (mode === "shared") {
    const source = a.participants[a.selected];
    a.participants.forEach((p, i) => {
      if (i !== a.selected) {
        const pg = store.people.find((x) => x.id === source.personId)?.programs.find((pg) => pg.id === source.programId);
        const peer = pg?.partnerId === p.personId ? pairedProgram(store, source.personId, pg) : undefined;
        p.programId = peer?.id;
        p.dayId = peer ? source.dayId : undefined;
        p.dayName = peer ? source.dayName : source.dayName + " · совместная";
      }
    });
    prepareExercises(
      store,
      a.id,
      source.entries.map((e) => e.id),
    );
  }
}
export function setWorkoutComment(store: Store, appointmentId: string, comment: string) {
  const a = store.appointments.find((a) => a.id === appointmentId);
  if (!a || a.status !== "active") return;
  a.comment = comment;
  store.sessions.filter((s) => a.participants.some((p) => s.id === a.id + ":" + p.personId)).forEach((s) => { s.comment = comment; });
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
        ...(a.comment !== undefined ? { comment: a.comment } : {}),
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
  const equipment = (x: any) => x === undefined || ["", "barbell", "dumbbells"].includes(x);
  const options = (x: any) => obj(x) && equipment(x.equipment) && (x.setId === undefined || (str(x.setId) && x.setId.length > 0)) && (x.optional === undefined || typeof x.optional === "boolean");
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
        (e.deleted === undefined || typeof e.deleted === "boolean") &&
        str(e.name) &&
        equipment(e.equipment) &&
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
    ((p.pairId === undefined && p.partnerId === undefined) || (str(p.pairId) && p.pairId.length > 0 && str(p.partnerId))) &&
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
    p.days.every((d: Day) => d.options === undefined || (obj(d.options) && Object.entries(d.options).every(([id, value]) => d.exercises.includes(id) && options(value)))) &&
    unique(p.days) &&
    (p.days.length ? p.next < p.days.length : p.next === 0);
  if (
    !list(
      s.people,
      (p) =>
        obj(p) &&
        str(p.id) &&
        (p.archivedAt === undefined || (p.id !== "self" && date(p.archivedAt))) &&
        str(p.name) &&
        str(p.short) &&
        (p.avatar === undefined || (obj(p.avatar) &&
          (p.avatar.photo === undefined || (str(p.avatar.photo) && /^data:image\/(jpeg|png|webp|gif);base64,/.test(p.avatar.photo))) &&
          (p.avatar.color === undefined || (str(p.avatar.color) && /^#[0-9a-f]{6}$/i.test(p.avatar.color))) &&
          (p.avatar.text === undefined || (str(p.avatar.text) && Array.from(p.avatar.text).length <= 8)))) &&
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
            equipment(r.equipment) &&
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
  if (s.people.some((owner) => owner.programs.some((p) => p.pairId && (p.partnerId === owner.id || !pairedProgram(s, owner.id, p)))) || s.templates.some((p) => p.pairId || p.partnerId)) fail();
  const validEntry = (e: any) =>
    obj(e) &&
    hasExercise(e.id) &&
    str(e.name) &&
    options(e) &&
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
        (x.comment === undefined || str(x.comment)) &&
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
        (a.comment === undefined || str(a.comment)) &&
        date(a.date) &&
        (a.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)) &&
        (a.duration === null ||
          (Number.isFinite(a.duration) && a.duration > 0)) &&
        ["planned", "active", "done", "cancelled"].includes(a.status) &&
        (a.prepared === undefined || typeof a.prepared === "boolean") &&
        (a.awaitingSchedule === undefined || typeof a.awaitingSchedule === "boolean") &&
        (!a.awaitingSchedule || (a.status === "planned" && a.time === "")) &&
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
