import { useRef, useState, type PointerEvent } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Replace, X } from 'lucide-react'

type Entry = { id: string; name: string; summary: string }
export function PlanExerciseList({ entries, onMove, onReplace, onRemove }: {
  entries: Entry[]
  onMove: (from: number, to: number) => void
  onReplace: (id: string) => void
  onRemove: (id: string) => void
}) {
  const list = useRef<HTMLDivElement>(null)
  const active = useRef<{ from: number; to: number } | null>(null)
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!active.current) return
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-plan-position]')
    if (row && list.current?.contains(row)) {
      active.current = { ...active.current, to: Number(row.dataset.planPosition) }
      setDrag(active.current)
    }
    if (event.clientY < 100) window.scrollBy(0, -16)
    if (event.clientY > window.innerHeight - 110) window.scrollBy(0, 16)
  }
  function end(commit: boolean) {
    const current = active.current
    active.current = null
    setDrag(null)
    if (commit && current && current.from !== current.to) onMove(current.from, current.to)
  }
  return <div className="plan-exercises" ref={list}>
    <p className="reorder-hint">Потяните за ⋮⋮, чтобы изменить порядок</p>
    {entries.map((entry, index) => <div key={entry.id} data-plan-position={index} className={'plan-exercise sortable-row' + (drag?.from === index ? ' dragging' : '') + (drag?.to === index && drag.from !== index ? ' drop-target' : '')}>
      <button className="drag-handle" aria-label={`Переместить ${entry.name}. Используйте стрелки вверх и вниз`} onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        active.current = { from: index, to: index }; setDrag(active.current)
      }} onPointerMove={move} onPointerUp={() => end(true)} onPointerCancel={() => end(false)} onLostPointerCapture={() => end(false)} onKeyDown={(event) => {
        if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); onMove(index, index - 1) }
        if (event.key === 'ArrowDown' && index < entries.length - 1) { event.preventDefault(); onMove(index, index + 1) }
        if (event.key === 'Escape') end(false)
      }}><GripVertical size={19} /><span>{index + 1}</span></button>
      <div className="plan-entry"><strong>{entry.name}</strong><small>{entry.summary}</small></div>
      <div className="plan-controls">
        <button disabled={index === 0} aria-label={`Поднять ${entry.name}`} onClick={() => onMove(index, index - 1)}><ArrowUp size={16} /></button>
        <button disabled={index === entries.length - 1} aria-label={`Опустить ${entry.name}`} onClick={() => onMove(index, index + 1)}><ArrowDown size={16} /></button>
        <button className="replace-exercise" aria-label={`Заменить ${entry.name}`} onClick={() => onReplace(entry.id)}><Replace size={16} /><span>Заменить</span></button>
        <button aria-label={`Убрать ${entry.name}`} onClick={() => onRemove(entry.id)}><X size={17} /></button>
      </div>
    </div>)}
    <span className="sr-only" role="status">{drag ? `Позиция ${drag.to + 1}` : ''}</span>
  </div>
}
