import { setExerciseGroup, equipmentLabel, type ExerciseOptions as Options } from "./training";

export type OptionItem = Options & { id: string; name: string };
export function SetBadge({ items, index }: { items: OptionItem[]; index: number }) {
  const id = items[index].setId;
  if (!id || items[index - 1]?.setId === id) return null;
  const count = items.filter((e) => e.setId === id).length;
  return <small className="set-badge">{count === 3 ? "Трисет" : "Сет"} · {count} упражнения</small>;
}
export function ExerciseOptions({ items, index, onChange, compact = false, showAdditional = true }: {
  items: OptionItem[]; index: number; onChange: (items: OptionItem[]) => void;
  compact?: boolean; showAdditional?: boolean;
}) {
  const item = items[index], previous = items[index - 1];
  const sameGroup = !!item.setId && item.setId === previous?.setId;
  const full = !!previous?.setId && items.filter((e) => e.setId === previous.setId && e.id !== item.id).length >= 3;
  return <div className="exercise-options">
    {showAdditional && <label className="optional-toggle"><input type="checkbox" aria-label={"Дополнительное: " + item.name} checked={!!item.optional} onChange={(event) => {
      const next = structuredClone(items); next[index].optional = event.target.checked; onChange(next);
    }} />Дополнительное · если останется время</label>}
    <SetBadge items={items} index={index} />
    {compact && equipmentLabel(item.equipment) && <small className="equipment-history">{equipmentLabel(item.equipment)}</small>}
    {!compact && <>
    <label>Оборудование<select aria-label={"Оборудование: " + item.name} value={item.equipment ?? ""} onChange={(event) => {
      const next = structuredClone(items); next[index].equipment = event.target.value as Options["equipment"]; onChange(next);
    }}><option value="">Без уточнения</option><option value="barbell">Со штангой</option><option value="dumbbells">С гантелями</option></select></label>
    <label>Сет / трисет<select aria-label={"Сет: " + item.name} value={sameGroup ? "previous" : item.setId ? "start" : ""} onChange={(event) => {
      onChange(setExerciseGroup(items, index, event.target.value === "previous"));
    }}><option value="">Отдельно</option>{item.setId && !sameGroup && <option value="start" disabled>Начало сета</option>}{previous && <option value="previous" disabled={full}>С предыдущим</option>}</select></label>
    </>}
  </div>;
}
