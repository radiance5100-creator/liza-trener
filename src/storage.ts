import { openDB } from 'idb'
import { initialExercises, type Exercise } from './seed'

export type Plan = { id: string; name: string; exerciseIds: string[]; clientId?: string }
export type Technique = { flagged: boolean; comment: string }
export type Client = { id: string; name: string; contact: string; note: string; results: Result[]; techniques: Record<string, Technique> }
export type Result = { exerciseId: string; name: string; weight: string; reps: string }
export type Session = { id: string; planName: string; date: string; results: Result[]; clientId?: string }
export type Draft = { planName: string; results: Result[]; clientId?: string }
export type AppData = { version: 1; clients: Client[]; techniques: Record<string, Technique>; exercises: Exercise[]; plans: Plan[]; sessions: Session[]; draft?: Draft | null }

export const defaultData = (): AppData => ({ version: 1, clients: [], techniques: {}, exercises: initialExercises, plans: [], sessions: [] })

const database = openDB('liza-trener', 1, {
  upgrade(db) { db.createObjectStore('app') },
})

export async function loadData(): Promise<AppData> {
  const saved = await (await database).get('app', 'data')
  return saved ? validateData(saved) : defaultData()
}

export async function saveData(data: AppData) {
  await (await database).put('app', data, 'data')
}

export function validateData(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new Error('Неверный формат файла')
  const data = value as Partial<AppData>
  if (data.version !== 1 || !Array.isArray(data.exercises) || !Array.isArray(data.plans) || !Array.isArray(data.sessions)) {
    throw new Error('Файл не является резервной копией этого приложения')
  }
  if (!data.exercises.every((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.group === 'string' && typeof item.weight === 'string' && typeof item.reps === 'string' && typeof item.note === 'string' && Array.isArray(item.images) && item.images.length === 2 && item.images.every((image) => image === null || (typeof image === 'string' && image.startsWith('data:image/'))) && Array.isArray(item.history))) {
    throw new Error('Повреждены данные упражнений')
  }
  if (!data.plans.every((plan) => plan && typeof plan.id === 'string' && typeof plan.name === 'string' && Array.isArray(plan.exerciseIds) && plan.exerciseIds.every((id) => typeof id === 'string'))) {
    throw new Error('Повреждены данные шаблонов')
  }
  const validResult = (result: Result) => result && typeof result.exerciseId === 'string' && typeof result.name === 'string' && typeof result.weight === 'string' && typeof result.reps === 'string'
  if (!data.sessions.every((session) => session && typeof session.id === 'string' && typeof session.planName === 'string' && typeof session.date === 'string' && Array.isArray(session.results) && session.results.every(validResult))) {
    throw new Error('Повреждены данные журнала')
  }
  if (data.draft && (typeof data.draft.planName !== 'string' || !Array.isArray(data.draft.results) || !data.draft.results.every(validResult))) {
    throw new Error('Повреждены данные текущей тренировки')
  }
  const validTechniques = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every((item) => item && typeof item.flagged === 'boolean' && typeof item.comment === 'string')
  const clients = data.clients ?? []
  if (!Array.isArray(clients) || !clients.every((client) => client && typeof client.id === 'string' && typeof client.name === 'string' && typeof client.contact === 'string' && typeof client.note === 'string' && Array.isArray(client.results) && client.results.every(validResult) && validTechniques(client.techniques)) || new Set(clients.map((client) => client.id)).size !== clients.length) throw new Error('Повреждены карточки клиентов')
  if (!validTechniques(data.techniques ?? {})) throw new Error('Повреждены пометки о технике')
  const validOwner = (item: { clientId?: string }) => item.clientId === undefined || clients.some((client) => client.id === item.clientId)
  if (!data.plans.every(validOwner) || !data.sessions.every(validOwner) || (data.draft && !validOwner(data.draft))) throw new Error('Не найден клиент для тренировки')
  return { ...data, clients, techniques: data.techniques ?? {} } as AppData
}

export async function imageToDataUrl(file: File, maxSize = 1600): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Выберите изображение')
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Нет доступа к обработке изображений')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Не удалось прочитать изображение'))
      reader.readAsDataURL(file)
    })
  }
}
