import { ChevronRight } from "lucide-react";
import { format, resultHistory, type Store } from "./training";

export function ProgressTable({ store, personId, onHistory }: {
  store: Store;
  personId: string;
  onHistory: (exerciseId: string) => void;
}) {
  // Undated baseline values are not completed workouts.
  const history = resultHistory(store, personId).filter((r) => r.date);
  const ids = [...new Set([...history].reverse().map((r) => r.id))];
  if (!ids.length) return <p className="muted">После тренировки здесь появятся результаты.</p>;
  return (
    <table className="progress-table" aria-label="Последние три выполнения каждого упражнения">
      <thead><tr><th scope="col">Предыдущая</th><th scope="col">Прошлая</th><th scope="col">Последняя</th></tr></thead>
      {ids.map((id) => {
        const last = history.filter((r) => r.id === id).slice(-3);
        const values = [...Array(3 - last.length).fill(null), ...last];
        const name = store.exercises.find((e) => e.id === id)?.name ?? last.at(-1)!.name;
        return <tbody key={id}>
          <tr><th colSpan={3} scope="rowgroup">
            <button onClick={() => onHistory(id)} aria-label={"История упражнения: " + name}>
              <span>{name}</span><ChevronRight size={16} aria-hidden="true" />
            </button>
          </th></tr>
          <tr>{values.map((r, index) => <td key={index}>
            {r ? format(r.weight, r.reps) : <span className="muted" aria-label="Нет результата">—</span>}
          </td>)}</tr>
        </tbody>;
      })}
    </table>
  );
}
