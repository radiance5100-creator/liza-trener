import { useEffect, useRef, useState } from 'react'
import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BookOpen, Check, ChevronDown, Download, Dumbbell, History, ImagePlus, ListFilter, Pencil, Play, Plus, Search, Settings2, Trash2, Upload, Users, CircleHelp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { imageToDataUrl, loadData, saveData, validateData, type AppData, type Plan, type Result, type Client, type Technique } from './storage'
import { type Exercise } from './seed'
import { Gallery } from './Gallery'
import { InstallApp } from './InstallApp'
import './App.css'

type Tab = 'catalog' | 'plans' | 'journal' | 'clients'
const groups = ['Все', 'Ноги', 'Спина', 'Грудь', 'Плечи', 'Трицепс', 'Бицепс', 'Пресс', 'Икры', 'Предплечья']
const sections = ['Ноги', 'Спина', 'Грудь', 'Плечи', 'Малые мышечные группы', 'Пресс']
const sectionOf = (group: string) => ['Трицепс', 'Бицепс', 'Икры', 'Предплечья'].includes(group) ? 'Малые мышечные группы' : group
const photos = (exercise?: Exercise | null) => exercise?.images.filter((image): image is string => !!image) ?? []
const dateLabel = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const approach = (weight: string, reps: string) => weight || reps ? `${weight || '—'} × ${reps || '—'}` : 'Нет данных'
const weightNumber = (value: string) => Number.parseFloat(value.replace(',', '.')) || 0
const numericWeight = (value: string) => /^\d+(?:[,.]\d+)?$/.test(value.trim())
const newId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const exerciseCount = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'упражнение' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'упражнения' : 'упражнений'}`
function recordHistory(exercise: Exercise, weight: string, reps: string, date: string) {
  const initial = exercise.history.length === 0 && (exercise.weight || exercise.reps)
    ? [{ weight: exercise.weight, reps: exercise.reps, date: '' }]
    : []
  return [{ weight, reps, date }, ...exercise.history, ...initial].slice(0, 3)
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [tab, setTab] = useState<Tab>('catalog')
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('Все')
  const [kind, setKind] = useState('Все')
  const [sort, setSort] = useState('default')
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Exercise | null>(null)
  const [planDialog, setPlanDialog] = useState(false)
  const [planName, setPlanName] = useState('')
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [picker, setPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [settings, setSettings] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [imagePreview, setImagePreview] = useState<{ images: string[]; name: string; index: number } | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientForm, setClientForm] = useState<Client | null>(null)
  const [techniqueId, setTechniqueId] = useState<string | null>(null)
  const [techniqueForm, setTechniqueForm] = useState<Technique>({ flagged: false, comment: '' })
  const [showDraft, setShowDraft] = useState(true)
  const [notice, setNotice] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadData().then(setData).catch(() => setNotice('Не удалось открыть данные браузера')) }, [])
  useEffect(() => { if (data) saveData(data).catch(() => setNotice('Не удалось сохранить изменения. Проверьте свободное место.')) }, [data])
  const exercises = data?.exercises ?? []
  const client = data?.clients.find((item) => item.id === clientId)
  const plans = (data?.plans ?? []).filter((plan) => plan.clientId === (clientId ?? undefined))
  const sessions = (data?.sessions ?? []).filter((session) => session.clientId === (clientId ?? undefined))
  const draft = data?.draft
  const selectedPlan = plans.find((plan) => plan.id === currentPlan)
  const editingExercise = exercises.find((exercise) => exercise.id === editing)
  const filtered = (() => {
    const normalized = query.trim().toLocaleLowerCase('ru')
    const result = exercises.filter((exercise) => (group === 'Все' || exercise.group === group) && (kind === 'Все' || exercise.kind === kind) && (!normalized || `${exercise.name} ${exercise.note}`.toLocaleLowerCase('ru').includes(normalized)))
    if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    if (sort === 'weight-desc') result.sort((a, b) => weightNumber(b.weight) - weightNumber(a.weight))
    if (sort === 'weight-asc') result.sort((a, b) => weightNumber(a.weight) - weightNumber(b.weight))
    return result
  })()
  const updateData = (change: (current: AppData) => AppData) => setData((current) => current ? change(current) : current)
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3500) }
  function openExercise(exercise: Exercise) { setEditing(exercise.id); setEditForm({ ...exercise, images: [...exercise.images] as Exercise['images'] }) }
  function saveExercise() {
    if (!editForm || !editForm.name.trim()) return
    const changed = editingExercise && (editForm.weight !== editingExercise.weight || editForm.reps !== editingExercise.reps)
    const next: Exercise = { ...editForm, name: editForm.name.trim(), history: changed && editingExercise ? recordHistory(editingExercise, editForm.weight, editForm.reps, new Date().toISOString()) : editForm.history }
    updateData((current) => ({ ...current, exercises: current.exercises.map((item) => item.id === next.id ? next : item) }))
    setEditing(null); setEditForm(null); flash('Упражнение сохранено')
  }
  async function uploadImage(file: File, position: 0 | 1) {
    try { const image = await imageToDataUrl(file); setEditForm((form) => form ? { ...form, images: form.images.map((old, index) => index === position ? image : old) as Exercise['images'] } : form) }
    catch (error) { flash(error instanceof Error ? error.message : 'Не удалось загрузить изображение') }
  }
  function createPlan() {
    const name = planName.trim(); if (!name) return
    const plan: Plan = { id: newId(), name, exerciseIds: [], clientId: clientId ?? undefined }
    updateData((current) => ({ ...current, plans: [...current.plans, plan] }))
    setCurrentPlan(plan.id); setPlanName(''); setPlanDialog(false); setTab('plans')
  }
  function updatePlan(id: string, change: (plan: Plan) => Plan) { updateData((current) => ({ ...current, plans: current.plans.map((plan) => plan.id === id ? change(plan) : plan) })) }
  function moveInPlan(id: string, index: number, delta: number) { updatePlan(id, (plan) => { const exerciseIds = [...plan.exerciseIds]; const [item] = exerciseIds.splice(index, 1); exerciseIds.splice(index + delta, 0, item); return { ...plan, exerciseIds } }) }
  function startPlan(plan: Plan) {
    if (draft && !window.confirm('Начать новую тренировку? Отложенная тренировка будет заменена.')) return
    const results: Result[] = plan.exerciseIds.flatMap((id) => { const exercise = exercises.find((item) => item.id === id); return exercise ? [{ exerciseId: id, name: exercise.name, weight: plan.clientId ? (data?.clients.find((item) => item.id === plan.clientId)?.results.find((item) => item.exerciseId === id)?.weight ?? '') : exercise.weight, reps: plan.clientId ? (data?.clients.find((item) => item.id === plan.clientId)?.results.find((item) => item.exerciseId === id)?.reps ?? '') : exercise.reps }] : [] })
    updateData((current) => ({ ...current, draft: { planName: plan.name, results, clientId: plan.clientId } }))
    setShowDraft(true)
  }
  function updateDraft(index: number, field: 'weight' | 'reps', value: string) { updateData((current) => !current.draft ? current : ({ ...current, draft: { ...current.draft, results: current.draft.results.map((result, i) => i === index ? { ...result, [field]: value } : result) } })) }
  function finishWorkout() {
    if (!draft) return
    const date = new Date().toISOString()
    updateData((current) => {
      if (!current.draft) return current
      const results = current.draft.results.map((result) => ({ ...result }))
      return { ...current, draft: null,
        sessions: [{ id: newId(), planName: current.draft.planName, date, results, clientId: current.draft.clientId }, ...current.sessions],
        clients: current.clients.map((item) => item.id === current.draft?.clientId ? { ...item, results: [...results, ...item.results.filter((old) => !results.some((result) => result.exerciseId === old.exerciseId))] } : item),
        exercises: current.draft.clientId ? current.exercises : current.exercises.map((exercise) => { const result = results.find((item) => item.exerciseId === exercise.id); return result ? { ...exercise, weight: result.weight, reps: result.reps, history: recordHistory(exercise, result.weight, result.reps, date) } : exercise }),
      }
    })
    setClientId(draft.clientId ?? null); setCurrentPlan(null); setShowDraft(false); setTab('journal'); flash('Тренировка сохранена')
  }
  function techniqueFor(id: string): Technique {
    const owner = draft?.clientId
    return (owner ? data?.clients.find((item) => item.id === owner)?.techniques[id] : data?.techniques[id]) ?? { flagged: false, comment: '' }
  }
  function saveTechnique(remove = false) {
    if (!techniqueId) return
    const id = techniqueId
    const change = (items: Record<string, Technique>) => { const next = { ...items }; if (remove) delete next[id]; else next[id] = { ...techniqueForm, comment: techniqueForm.comment.trim() }; return next }
    updateData((current) => draft?.clientId ? { ...current, clients: current.clients.map((item) => item.id === draft.clientId ? { ...item, techniques: change(item.techniques) } : item) } : { ...current, techniques: change(current.techniques) })
    setTechniqueId(null)
  }
  function saveClient() {
    if (!clientForm?.name.trim()) return
    const next = { ...clientForm, name: clientForm.name.trim() }
    updateData((current) => ({ ...current, clients: current.clients.some((item) => item.id === next.id) ? current.clients.map((item) => item.id === next.id ? next : item) : [...current.clients, next] }))
    setClientId(next.id); setCurrentPlan(null); setClientForm(null); setTab('clients')
  }
  function exportBackup() {
    if (!data) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `trener-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importBackup(file: File) {
    try { const next = validateData(JSON.parse(await file.text())); if (!window.confirm('Заменить все текущие данные данными из резервной копии?')) return; await saveData(next); setData(next); setSettings(false); setCurrentPlan(null); setClientId(null); flash('Резервная копия восстановлена') }
    catch (error) { flash(error instanceof Error ? error.message : 'Не удалось открыть файл') }
    if (importRef.current) importRef.current.value = ''
  }
  if (!data) return <div className="loading">Загружаем упражнения…</div>
  return <div className="app-shell">
    <aside className="desktop-sidebar"><div className="brand"><span className="brand-mark"><Dumbbell size={21} /></span><span>Мой темп<small>ТРЕНИРОВКИ И ПРОГРЕСС</small></span></div><nav className="side-nav" aria-label="Основная навигация"><button className={tab === 'catalog' ? 'active' : ''} onClick={() => { setClientId(null); setCurrentPlan(null); setTab('catalog') }}><BookOpen size={19} /> Упражнения</button><button className={tab === 'plans' ? 'active' : ''} onClick={() => { setClientId(null); setCurrentPlan(null); setTab('plans') }}><Dumbbell size={19} /> Шаблоны</button><button className={tab === 'journal' ? 'active' : ''} onClick={() => { setClientId(null); setCurrentPlan(null); setTab('journal') }}><History size={19} /> Журнал</button><button className={tab === 'clients' ? 'active' : ''} onClick={() => { setCurrentPlan(null); setTab('clients') }}><Users size={19} /> Клиенты</button></nav><button className="sidebar-settings" onClick={() => setSettings(true)}><Settings2 size={19} /> Данные и настройки</button></aside>
    <main className="main-content">
      {client && (!draft || !showDraft) && <div className="client-context"><button className="text-back" onClick={() => { setCurrentPlan(null); setTab('clients') }}><Users size={17} /> {client.name}</button><span>Карточка клиента</span></div>}
      {draft && !showDraft && <button className="resume-banner" onClick={() => setShowDraft(true)}><Play size={16} /> Продолжить тренировку «{draft.planName}» <ArrowRight size={16} /></button>}
      {draft && showDraft ? <section className="workout-page">
        <div className="page-top"><button className="icon-button" aria-label="Отложить тренировку" onClick={() => { setClientId(draft.clientId ?? null); setCurrentPlan(null); setShowDraft(false); setTab('plans') }}><ArrowLeft size={21} /></button><span className="eyebrow">АКТИВНАЯ ТРЕНИРОВКА</span><button className="icon-button" aria-label="Отменить тренировку" onClick={() => { if (window.confirm('Отменить текущую тренировку?')) { updateData((current) => ({ ...current, draft: null })); setShowDraft(false) } }}><X size={21} /></button></div>
        <div className="page-heading"><h1>{draft.planName}</h1><p>{draft.clientId && <><strong>{data.clients.find((item) => item.id === draft.clientId)?.name}</strong><br /></>}Один рабочий подход на каждое упражнение</p></div>
        <div className="workout-list">{draft.results.map((result, index) => <article className="workout-card" key={`${result.exerciseId}-${index}`}><div className="workout-number">{String(index + 1).padStart(2, '0')}</div><div className="workout-body"><div className="workout-title"><h3>{result.name}</h3><button className={techniqueFor(result.exerciseId).flagged ? 'technique-button flagged' : 'technique-button'} aria-label={'Техника и комментарий: ' + result.name} onClick={() => { setTechniqueId(result.exerciseId); setTechniqueForm(techniqueFor(result.exerciseId)) }}><CircleHelp size={23} /></button></div>
          {techniqueFor(result.exerciseId).flagged && <p className="technique-warning">Техника под вопросом — не повышайте вес и повторения</p>}
          {techniqueFor(result.exerciseId).comment && <p className="technique-comment">{techniqueFor(result.exerciseId).comment}</p>}
          {exercises.find((item) => item.id === result.exerciseId)?.note && <p className="technique-comment">{exercises.find((item) => item.id === result.exerciseId)?.note}</p>}
          <Gallery images={photos(exercises.find((item) => item.id === result.exerciseId))} name={result.name} onOpen={(index) => setImagePreview({ images: photos(exercises.find((item) => item.id === result.exerciseId)), name: result.name, index })} />
          <div className="workout-inputs"><label>{numericWeight(result.weight) || !result.weight ? 'Вес, кг' : 'Нагрузка'}<Input inputMode={numericWeight(result.weight) || !result.weight ? 'decimal' : 'text'} value={result.weight} onChange={(event) => updateDraft(index, 'weight', event.target.value)} aria-label={`Нагрузка: ${result.name}`} /></label><span className="times">×</span><label>Повторы<Input inputMode="numeric" value={result.reps} onChange={(event) => updateDraft(index, 'reps', event.target.value)} aria-label={`Повторы: ${result.name}`} /></label></div></div></article>)}</div>
        <div className="finish-bar"><Button className="primary-button" onClick={finishWorkout}><Check size={18} /> Завершить тренировку</Button></div>
      </section> : tab === 'catalog' ? <section>
        <div className="page-top"><span className="eyebrow">ВАША БИБЛИОТЕКА</span><button className="icon-button" aria-label="Данные и настройки" onClick={() => setSettings(true)}><Settings2 size={21} /></button></div>
        <div className="page-heading"><h1>Упражнения<span className="heading-dot">.</span></h1></div>
        <div className="hero-card"><div><h2>ДИСЦИПЛИНА</h2><p>это решение делать то, чего очень не хочется делать, чтобы достичь того, чего очень хочется достичь.</p></div><div className="hero-icon"><Activity size={36} /></div></div>
        <button className="install-link" onClick={() => setInstallOpen(true)}><Download size={17} /> На главный экран — как приложение <ArrowRight size={17} /></button><div className="section-title"><h2>Каталог</h2><span>{filtered.length} найдено</span></div>
        <div className="search-field"><Search size={19} /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти упражнение" aria-label="Поиск упражнений" />{query && <button aria-label="Очистить поиск" onClick={() => setQuery('')}><X size={18} /></button>}</div>
        <div className="chips" aria-label="Группы мышц">{groups.map((item) => <button key={item} className={group === item ? 'selected' : ''} onClick={() => setGroup(item)}>{item}</button>)}</div>
        <div className="filter-row"><div className="kind-switch"><button className={kind === 'Все' ? 'selected' : ''} onClick={() => setKind('Все')}>Все</button><button className={kind === 'База' ? 'selected' : ''} onClick={() => setKind('База')}>База</button><button className={kind === 'Доп' ? 'selected' : ''} onClick={() => setKind('Доп')}>Доп</button></div><label className="sort-select"><ListFilter size={17} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Сортировка"><option value="default">По списку</option><option value="name">По названию</option><option value="weight-desc">Вес ↓</option><option value="weight-asc">Вес ↑</option></select><ChevronDown size={15} /></label></div>
        <div className="exercise-list">{filtered.length ? sections.map((section) => { const items = filtered.filter((exercise) => sectionOf(exercise.group) === section); return items.length ? <section className="muscle-section" key={section}><h3 className="muscle-heading">{section}<span>{items.length}</span></h3>{items.map((exercise) => <button className="exercise-card" key={exercise.id} onClick={() => openExercise(exercise)}><span className="exercise-symbol"><Dumbbell size={21} /></span><span className="exercise-info"><span className="exercise-meta">{exercise.group}{exercise.kind ? ` · ${exercise.kind}` : ''}{exercise.filmed ? ' · снято' : ''}</span><strong>{exercise.name}</strong>{(exercise.note || !exercise.weight || !exercise.reps || exercise.reps.includes('?')) && <span className="needs-review">{exercise.note || 'Уточнить рабочий подход'}</span>}</span><span className="exercise-result"><b>{approach(exercise.weight, exercise.reps)}</b><small>{exercise.weight || exercise.reps ? numericWeight(exercise.weight) ? 'кг × повт.' : 'нагрузка × повт.' : 'добавить'}</small></span><ArrowRight className="card-arrow" size={18} /></button>)}</section> : null }) : <div className="empty-state"><Search size={25} /><h3>Ничего не найдено</h3><p>Попробуйте другой запрос или фильтр.</p><Button variant="outline" onClick={() => { setQuery(''); setGroup('Все'); setKind('Все') }}>Сбросить фильтры</Button></div>}</div>
      </section> : tab === 'plans' ? <section>
        <div className="page-top"><span className="eyebrow">ПЛАНИРОВАНИЕ</span><button className="icon-button" aria-label="Данные и настройки" onClick={() => setSettings(true)}><Settings2 size={21} /></button></div>
        {selectedPlan ? <>
          <button className="text-back" onClick={() => setCurrentPlan(null)}><ArrowLeft size={17} /> {client ? 'Программы клиента' : 'Все шаблоны'}</button>
          <div className="page-heading plan-heading"><h1>{selectedPlan.name}</h1><p>{exerciseCount(selectedPlan.exerciseIds.length)} в тренировке</p></div>
          <div className="plan-actions"><Button className="primary-button" disabled={!selectedPlan.exerciseIds.length} onClick={() => startPlan(selectedPlan)}><Play size={17} fill="currentColor" /> Начать тренировку</Button><Button variant="outline" onClick={() => { setPickerQuery(''); setPicker(true) }}><Plus size={17} /> Упражнение</Button></div>
          <div className="section-title"><h2>Порядок упражнений</h2></div>
          {selectedPlan.exerciseIds.length ? <div className="plan-exercises">{selectedPlan.exerciseIds.map((id, index) => { const exercise = exercises.find((item) => item.id === id); return exercise ? <div className="plan-exercise" key={id}><span className="plan-index">{index + 1}</span><div><strong>{exercise.name}</strong><small>{client ? approach(client.results.find((result) => result.exerciseId === id)?.weight ?? '', client.results.find((result) => result.exerciseId === id)?.reps ?? '') : approach(exercise.weight, exercise.reps)}</small></div><div className="plan-controls"><button disabled={index === 0} aria-label={`Поднять ${exercise.name}`} onClick={() => moveInPlan(selectedPlan.id, index, -1)}><ArrowUp size={17} /></button><button disabled={index === selectedPlan.exerciseIds.length - 1} aria-label={`Опустить ${exercise.name}`} onClick={() => moveInPlan(selectedPlan.id, index, 1)}><ArrowDown size={17} /></button><button aria-label={`Убрать ${exercise.name}`} onClick={() => updatePlan(selectedPlan.id, (plan) => ({ ...plan, exerciseIds: plan.exerciseIds.filter((item) => item !== id) }))}><X size={17} /></button></div></div> : null })}</div> : <div className="empty-state"><Dumbbell size={29} /><h3>Пока нет упражнений</h3><p>Добавьте упражнения, чтобы собрать тренировку.</p><Button onClick={() => setPicker(true)}>Выбрать упражнения</Button></div>}
          <button className="delete-plan" onClick={() => { if (window.confirm(`Удалить шаблон «${selectedPlan.name}»?`)) { updateData((current) => ({ ...current, plans: current.plans.filter((plan) => plan.id !== selectedPlan.id) })); setCurrentPlan(null) } }}><Trash2 size={16} /> Удалить шаблон</button>
        </> : <>
          <div className="page-heading"><h1>{client ? 'Программы' : 'Шаблоны'}<span className="heading-dot">.</span></h1><p>Планируйте тренировки в своём темпе</p></div>
          <div className="section-title"><h2>Ваши тренировки</h2><Button className="small-add" onClick={() => setPlanDialog(true)}><Plus size={17} /> Создать</Button></div>
          {plans.length ? <div className="plans-grid">{plans.map((plan, index) => <article className="template-card" key={plan.id}><div className="template-top"><span className="template-number">ПЛАН {String(index + 1).padStart(2, '0')}</span><Dumbbell size={20} /></div><div className="template-icon"><Dumbbell size={24} /></div><h3>{plan.name}</h3><p>{exerciseCount(plan.exerciseIds.length)}</p><div className="template-actions"><button onClick={() => setCurrentPlan(plan.id)}>Открыть <ArrowRight size={17} /></button><button disabled={!plan.exerciseIds.length} aria-label={`Начать тренировку ${plan.name}`} onClick={() => startPlan(plan)}><Play size={17} /></button></div></article>)}</div> : <div className="empty-state large"><Dumbbell size={31} /><h3>Создайте первый шаблон</h3><p>Соберите упражнения в удобном порядке, чтобы быстро начать тренировку.</p><Button onClick={() => setPlanDialog(true)}><Plus size={17} /> Создать шаблон</Button></div>}
        </>}
      </section> : tab === 'clients' ? <section>
        <div className="page-top"><span className="eyebrow">РАБОТА С КЛИЕНТАМИ</span><button className="icon-button" aria-label="Данные и настройки" onClick={() => setSettings(true)}><Settings2 size={21} /></button></div>
        {client ? <>
          <button className="text-back" onClick={() => setClientId(null)}><ArrowLeft size={17} /> Все клиенты</button>
          <div className="page-heading"><h1>{client.name}</h1>{client.contact && <p>{client.contact}</p>}</div>
          {client.note && <p className="client-note">{client.note}</p>}
          <div className="plan-actions"><Button variant="outline" onClick={() => setClientForm({ ...client })}><Pencil size={17} /> Редактировать</Button><Button variant="outline" onClick={() => setTab('journal')}><History size={17} /> Журнал клиента</Button></div>
          <div className="section-title"><h2>Программы тренировок</h2><Button onClick={() => setPlanDialog(true)}><Plus size={17} /> Создать</Button></div>
          {plans.length ? <div className="plans-grid">{plans.map((plan) => <article className="template-card" key={plan.id}><span className="template-number">ПРОГРАММА</span><h3>{plan.name}</h3><p>{exerciseCount(plan.exerciseIds.length)}</p><div className="template-actions"><button onClick={() => { setCurrentPlan(plan.id); setTab('plans') }}>Открыть <ArrowRight size={17} /></button><button aria-label={'Начать тренировку ' + plan.name} disabled={!plan.exerciseIds.length} onClick={() => startPlan(plan)}><Play size={17} /></button></div></article>)}</div> : <div className="empty-state"><Dumbbell size={29} /><h3>Создайте программу для клиента</h3><p>Добавьте упражнения из общего каталога. Результаты и пометки сохраняются отдельно для каждого клиента.</p></div>}
          <button className="delete-plan" onClick={() => { if (window.confirm('Удалить клиента «' + client.name + '», его программы и журнал?')) { updateData((current) => ({ ...current, clients: current.clients.filter((item) => item.id !== client.id), plans: current.plans.filter((item) => item.clientId !== client.id), sessions: current.sessions.filter((item) => item.clientId !== client.id), draft: current.draft?.clientId === client.id ? null : current.draft })); setClientId(null); setCurrentPlan(null) } }}><Trash2 size={16} /> Удалить клиента</button>
        </> : <>
          <div className="page-heading"><h1>Клиенты<span className="heading-dot">.</span></h1><p>Программы и прогресс каждого клиента</p></div>
          <div className="section-title"><h2>Карточки клиентов</h2><Button onClick={() => setClientForm({ id: newId(), name: '', contact: '', note: '', results: [], techniques: {} })}><Plus size={17} /> Добавить</Button></div>
          {data.clients.length ? <div className="plans-grid">{data.clients.map((item) => <button className="client-card" key={item.id} onClick={() => setClientId(item.id)}><Users size={24} /><strong>{item.name}</strong><span>{item.contact || 'Открыть карточку'}</span><ArrowRight size={18} /></button>)}</div> : <div className="empty-state large"><Users size={31} /><h3>Добавьте первого клиента</h3><p>Создайте карточку и соберите персональную программу тренировок.</p></div>}
        </>}
      </section> : <section>
        <div className="page-top"><span className="eyebrow">ИСТОРИЯ ЗАНЯТИЙ</span><button className="icon-button" aria-label="Данные и настройки" onClick={() => setSettings(true)}><Settings2 size={21} /></button></div>
        <div className="page-heading"><h1>Журнал<span className="heading-dot">.</span></h1><p>Ваш путь, тренировка за тренировкой</p></div>
        <div className="journal-summary"><div className="summary-icon"><Activity size={25} /></div><div><strong>{sessions.length}</strong><span>Всего завершено</span></div></div>
        <div className="section-title"><h2>Последние занятия</h2></div>
        {sessions.length ? <div className="journal-list">{sessions.map((session) => <details className="session-card" key={session.id}><summary><span className="session-date">{dateLabel(session.date)}</span><strong>{session.planName}</strong><small>{exerciseCount(session.results.length)}</small><ChevronDown size={20} /></summary><div className="session-results">{session.results.map((result, index) => <div key={`${result.exerciseId}-${index}`}><span>{result.name}</span><b>{approach(result.weight, result.reps)}</b></div>)}</div></details>)}</div> : <div className="empty-state large"><History size={31} /><h3>Журнал пока пуст</h3><p>Завершите тренировку по шаблону, и она появится здесь.</p><Button onClick={() => { setCurrentPlan(null); setTab('plans') }}>{client ? 'К программам' : 'К шаблонам'} <ArrowRight size={17} /></Button></div>}
      </section>}
    </main>
    {(!draft || !showDraft) && <nav className="bottom-nav" aria-label="Основная навигация"><button className={tab === 'catalog' ? 'active' : ''} onClick={() => { setClientId(null); setCurrentPlan(null); setTab('catalog') }}><BookOpen size={21} /><span>Упражнения</span></button><button className={tab === 'plans' ? 'active' : ''} onClick={() => { setClientId(null); setCurrentPlan(null); setTab('plans') }}><Dumbbell size={21} /><span>Шаблоны</span></button><button className={tab === 'journal' ? 'active' : ''} onClick={() => { setClientId(null); setCurrentPlan(null); setTab('journal') }}><History size={21} /><span>Журнал</span></button><button className={tab === 'clients' ? 'active' : ''} onClick={() => { setCurrentPlan(null); setTab('clients') }}><Users size={21} /><span>Клиенты</span></button></nav>}
    <Sheet open={!!editing} onOpenChange={(open) => { if (!open) { setEditing(null); setEditForm(null) } }}><SheetContent side="bottom" className="edit-sheet"><SheetHeader><SheetTitle>Упражнение</SheetTitle><SheetDescription>Измените рабочий подход и фотографии</SheetDescription></SheetHeader>{editForm && <div className="edit-scroll"><div className="field"><label htmlFor="exercise-name">Название</label><Input id="exercise-name" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></div><div className="two-fields"><div className="field"><label htmlFor="exercise-group">Группа</label><select id="exercise-group" value={editForm.group} onChange={(event) => setEditForm({ ...editForm, group: event.target.value })}>{groups.slice(1).map((item) => <option key={item}>{item}</option>)}</select></div><div className="field"><label htmlFor="exercise-kind">Тип</label><select id="exercise-kind" value={editForm.kind} onChange={(event) => setEditForm({ ...editForm, kind: event.target.value as Exercise['kind'] })}><option value="">Без типа</option><option>База</option><option>Доп</option></select></div></div><div className="two-fields"><div className="field"><label htmlFor="exercise-weight">Рабочий вес / нагрузка</label><Input id="exercise-weight" inputMode="decimal" value={editForm.weight} onChange={(event) => setEditForm({ ...editForm, weight: event.target.value })} placeholder="Например, 50" /></div><div className="field"><label htmlFor="exercise-reps">Повторы</label><Input id="exercise-reps" inputMode="text" value={editForm.reps} onChange={(event) => setEditForm({ ...editForm, reps: event.target.value })} placeholder="Например, 4" /></div></div><div className="field"><label htmlFor="exercise-note">Заметка</label><Textarea id="exercise-note" value={editForm.note} onChange={(event) => setEditForm({ ...editForm, note: event.target.value })} placeholder="Техника, ощущения, уточнения…" /></div><div className="field"><span className="field-title">Скриншоты</span><div className="image-grid">{([0, 1] as const).map((position) => <div className="image-slot" key={position}>{editForm.images[position] ? <><button className="image-view" aria-label={`Увеличить скриншот ${position + 1}`} onClick={() => setImagePreview({ images: photos(editForm), name: editForm.name, index: photos(editForm).indexOf(editForm.images[position]!) })}><img src={editForm.images[position]!} alt={`Скриншот ${position + 1}: ${editForm.name}`} /></button><label className="image-replace" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}><Pencil size={15} /> Заменить<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(file, position); event.target.value = '' }} /></label><button className="image-remove" aria-label={`Удалить скриншот ${position + 1}`} onClick={() => setEditForm({ ...editForm, images: editForm.images.map((image, index) => index === position ? null : image) as Exercise['images'] })}><X size={16} /></button></> : <label className="image-add" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.querySelector('input')?.click() } }}><ImagePlus size={25} /><span>Скриншот {position + 1}</span><small>Добавить фото</small><input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadImage(file, position); event.target.value = '' }} /></label>}</div>)}</div></div>{editForm.history.length > 0 && <div className="field"><span className="field-title">Последние результаты</span><div className="history-list">{editForm.history.slice(0, 3).map((entry, index) => <div key={index}><span>{entry.date ? dateLabel(entry.date) : 'Исходное значение'}</span><strong>{approach(entry.weight, entry.reps)}</strong></div>)}</div></div>}</div>}<div className="sheet-footer"><Button className="primary-button" onClick={saveExercise} disabled={!editForm?.name.trim()}><Check size={17} /> Сохранить изменения</Button></div></SheetContent></Sheet>
    <Dialog open={planDialog} onOpenChange={setPlanDialog}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>{client ? 'Новая программа клиента' : 'Новый шаблон'}</DialogTitle><DialogDescription>Дайте тренировке короткое название</DialogDescription></DialogHeader><Input autoFocus value={planName} onChange={(event) => setPlanName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createPlan() }} placeholder="Например, День ног" aria-label="Название шаблона" /><Button className="primary-button" onClick={createPlan} disabled={!planName.trim()}>{client ? 'Создать программу' : 'Создать шаблон'}</Button></DialogContent></Dialog>
    <Dialog open={picker} onOpenChange={setPicker}><DialogContent className="picker-dialog"><DialogHeader><DialogTitle>Добавить упражнение</DialogTitle><DialogDescription>Выберите из каталога</DialogDescription></DialogHeader><div className="search-field"><Search size={18} /><Input value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="Поиск по названию" aria-label="Поиск для шаблона" /></div><div className="picker-list">{sections.map((section) => { const items = exercises.filter((exercise) => sectionOf(exercise.group) === section && !selectedPlan?.exerciseIds.includes(exercise.id) && `${exercise.name} ${exercise.group} ${section}`.toLocaleLowerCase('ru').includes(pickerQuery.toLocaleLowerCase('ru'))); return items.length ? <section key={section}><h3 className="muscle-heading">{section}</h3>{items.map((exercise) => <button key={exercise.id} onClick={() => { if (selectedPlan) updatePlan(selectedPlan.id, (plan) => ({ ...plan, exerciseIds: [...plan.exerciseIds, exercise.id] })); setPicker(false) }}><span><small>{exercise.group}{exercise.kind ? ` · ${exercise.kind}` : ''}</small><strong>{exercise.name}</strong></span><Plus size={18} /></button>)}</section> : null })}</div></DialogContent></Dialog>
    <Dialog open={!!imagePreview} onOpenChange={(open) => { if (!open) setImagePreview(null) }}><DialogContent className="preview-dialog"><DialogHeader><DialogTitle>{imagePreview?.name}</DialogTitle><DialogDescription>Листайте скриншоты свайпом или стрелками</DialogDescription></DialogHeader>{imagePreview && <Gallery key={imagePreview.name + imagePreview.index} images={imagePreview.images} name={imagePreview.name} initial={imagePreview.index} />}</DialogContent></Dialog>
    <Dialog open={!!clientForm} onOpenChange={(open) => { if (!open) setClientForm(null) }}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Карточка клиента</DialogTitle><DialogDescription>Имя, контакт и заметки для тренера</DialogDescription></DialogHeader>{clientForm && <>
      <div className="field"><label htmlFor="client-name">Имя клиента</label><Input id="client-name" autoFocus value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} /></div>
      <div className="field"><label htmlFor="client-contact">Телефон или другой контакт</label><Input id="client-contact" value={clientForm.contact} onChange={(event) => setClientForm({ ...clientForm, contact: event.target.value })} /></div>
      <div className="field"><label htmlFor="client-note">Заметки о клиенте</label><Textarea id="client-note" value={clientForm.note} onChange={(event) => setClientForm({ ...clientForm, note: event.target.value })} /></div>
      <Button className="primary-button" disabled={!clientForm.name.trim()} onClick={saveClient}>Сохранить карточку</Button></>}</DialogContent></Dialog>
    <Dialog open={!!techniqueId} onOpenChange={(open) => { if (!open) setTechniqueId(null) }}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Техника упражнения</DialogTitle><DialogDescription>{exercises.find((item) => item.id === techniqueId)?.name}. Пометка остаётся во всех следующих тренировках до удаления.</DialogDescription></DialogHeader>
      <label className="technique-toggle"><input type="checkbox" checked={techniqueForm.flagged} onChange={(event) => setTechniqueForm({ ...techniqueForm, flagged: event.target.checked })} /> Техника под вопросом</label>
      <div className="field"><label htmlFor="technique-comment">Комментарий</label><Textarea id="technique-comment" placeholder="Что нужно исправить в технике…" value={techniqueForm.comment} onChange={(event) => setTechniqueForm({ ...techniqueForm, comment: event.target.value })} /></div>
      <Button className="primary-button" onClick={() => saveTechnique()}>Сохранить пометку</Button><Button variant="outline" onClick={() => saveTechnique(true)}><Trash2 size={16} /> Удалить пометку и комментарий</Button>
    </DialogContent></Dialog>
    <Dialog open={settings} onOpenChange={setSettings}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Данные и настройки</DialogTitle><DialogDescription>Резервная копия хранит упражнения, фото, клиентов, программы, пометки и журнал.</DialogDescription></DialogHeader><div className="settings-actions"><Button variant="outline" onClick={() => { setSettings(false); setInstallOpen(true) }}><Download size={18} /> Установить как приложение</Button><Button variant="outline" onClick={exportBackup}><Download size={18} /> Скачать резервную копию</Button><Button variant="outline" onClick={() => importRef.current?.click()}><Upload size={18} /> Восстановить из файла</Button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup(file) }} /></div><p className="settings-note">Данные доступны только в этом браузере. Скачайте копию перед очисткой данных браузера или переносом на другое устройство.</p></DialogContent></Dialog>
    <InstallApp open={installOpen} onOpenChange={setInstallOpen} />
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}

export default App
