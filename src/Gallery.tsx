import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export function Gallery({ images, name, initial = 0, onOpen }: { images: string[]; name: string; initial?: number; onOpen?: (index: number) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(initial)
  useEffect(() => {
    const element = track.current
    if (element) element.scrollLeft = initial * element.clientWidth
  }, [initial])
  function go(next: number) { track.current?.scrollTo({ left: next * track.current.clientWidth, behavior: 'smooth' }) }
  if (!images.length) return <div className="gallery-empty">Скриншоты пока не добавлены</div>
  return <div className="gallery" aria-label={`Скриншоты: ${name}`}>
    <div className="gallery-track" ref={track} onScroll={(event) => { const element = event.currentTarget; setIndex(Math.round(element.scrollLeft / element.clientWidth)) }}>
      {images.map((image, i) => <div className="gallery-slide" key={i}>{onOpen ? <button aria-label={`Увеличить скриншот ${i + 1}: ${name}`} onClick={() => onOpen(i)}><img src={image} alt={`${name}, скриншот ${i + 1}`} /></button> : <img src={image} alt={`${name}, скриншот ${i + 1}`} />}</div>)}
    </div>
    <div className="gallery-controls"><button aria-label="Предыдущий скриншот" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={18} /></button><span aria-live="polite">{index + 1} / {images.length}</span><button aria-label="Следующий скриншот" disabled={index >= images.length - 1} onClick={() => go(index + 1)}><ArrowRight size={18} /></button></div>
  </div>
}
