import { useState } from "react";
import { resultHistory, equipmentLabel, type RecordValue, type Store, type ExerciseOptions } from "./training";

function ResultFields({ result, personName, exerciseName, onSave }: {
  result: RecordValue; personName: string; exerciseName: string; onSave: (weight: string, reps: string) => void;
}) {
  const [weight, setWeight] = useState(result.weight), [reps, setReps] = useState(result.reps), [error, setError] = useState("");
  const changed = weight !== result.weight || reps !== result.reps;
  function save() { try { onSave(weight, reps); setError(""); } catch (e) { setError((e as Error).message); } }
  return <div className="latest-result-editor">
    <small>{personName} · {result.date ? "Последний результат" : "Исходное значение"} · {equipmentLabel(result.equipment) || "Без уточнения оборудования"}</small>
    <div className="latest-result-fields" onKeyDown={(event) => { if (event.key === "Enter" && changed && weight.trim() && reps.trim()) { event.preventDefault(); save(); } }}>
      <label>Вес / нагрузка<input aria-label={`Последний вес: ${personName}, ${exerciseName}`} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
      <label>Повторы<input aria-label={`Последние повторы: ${personName}, ${exerciseName}`} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>
      {changed && <button className="text" disabled={!weight.trim() || !reps.trim()} onClick={save}>Сохранить</button>}
    </div>
    {error && <p role="alert" className="danger">{error}</p>}
  </div>;
}
export function LatestResults({ store, people, exerciseId, equipment, onSave }: {
  store: Store; people: string[]; exerciseId: string; equipment?: ExerciseOptions["equipment"];
  onSave: (personId: string, weight: string, reps: string, equipment?: ExerciseOptions["equipment"]) => void;
}) {
  const exerciseName = store.exercises.find((e) => e.id === exerciseId)?.name ?? "Упражнение";
  return <div className="latest-results">{people.map((id) => {
    const person = store.people.find((p) => p.id === id); if (!person) return null;
    const history = resultHistory(store, id, exerciseId);
    const result = history.filter((r) => (r.equipment || "") === (equipment || "")).at(-1) ?? history.filter((r) => !r.equipment).at(-1);
    return result ? <ResultFields key={JSON.stringify([id, exerciseId, equipment, result.date, result.weight, result.reps])} result={result} personName={person.name} exerciseName={exerciseName} onSave={(weight, reps) => onSave(id, weight, reps, result.equipment)} /> : <small className="muted" key={id}>{person.name} · сохранённых результатов пока нет</small>;
  })}</div>;
}
