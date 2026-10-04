import type { Program } from "./training";
import type { Exercise } from "./seed";

export function ProgramOverview({ program, exercises, onDay }: {
  program: Program;
  exercises: Exercise[];
  onDay: (id: string) => void;
}) {
  const rows = Math.max(0, ...program.days.map((d) => d.exercises.length));
  return <>
    <p className="muted small-text">Листайте дни по горизонтали. Нажмите на день, чтобы изменить его.</p>
    <div className="program-overview" tabIndex={0} aria-label="Обзор всех дней программы">
      <table>
        <thead><tr>{program.days.map((d) => <th key={d.id} scope="col">
          <button onClick={() => onDay(d.id)}>{d.name}<small>{d.exercises.length} {d.exercises.length % 10 === 1 && d.exercises.length % 100 !== 11 ? "упражнение" : [2, 3, 4].includes(d.exercises.length % 10) && ![12, 13, 14].includes(d.exercises.length % 100) ? "упражнения" : "упражнений"}</small></button>
        </th>)}</tr></thead>
        <tbody>{Array.from({ length: Math.max(1, rows) }, (_, index) => <tr key={index}>
          {program.days.map((d) => <td key={d.id}>
            {d.exercises[index] ? <><small>{index + 1}</small><span>{exercises.find((e) => e.id === d.exercises[index])?.name ?? "Упражнение"}</span></> : <span className="muted">—</span>}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
