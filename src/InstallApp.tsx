import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type InstallEvent = Event & {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallApp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  const [standalone, setStandalone] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)')
    const updateDisplay = () => setStandalone(display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
    const ready = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent) }
    const installed = () => { setPrompt(null); setMessage('Приложение установлено. Откройте «Мой темп» с главного экрана.') }
    updateDisplay()
    display.addEventListener('change', updateDisplay)
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', installed)
    return () => {
      display.removeEventListener('change', updateDisplay)
      window.removeEventListener('beforeinstallprompt', ready)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  async function install() {
    if (!prompt) return
    try {
      const choice = await prompt.prompt()
      if (choice.outcome === 'accepted') setMessage('Откройте «Мой темп» с главного экрана после установки.')
    } catch { setMessage('Используйте меню браузера, чтобы добавить приложение на главный экран.') }
    finally { setPrompt(null) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="app-dialog install-dialog">
    <DialogHeader><DialogTitle><Smartphone size={22} /> Как приложение</DialogTitle><DialogDescription>Запускайте «Мой темп» с главного экрана — без адресной строки и нижней панели браузера.</DialogDescription></DialogHeader>
    {standalone ? <p>Вы уже открыли приложение в отдельном окне.</p> : <>
      {prompt && <Button className="primary-button" onClick={install}><Download size={18} /> Установить приложение</Button>}
      <div className="install-instructions"><h3>iPhone · Safari</h3><ol><li>Откройте сайт в Safari и нажмите «Поделиться».</li><li>Выберите «На экран Домой».</li><li>Если есть переключатель «Открывать как веб-приложение», включите его. Нажмите «Добавить».</li><li>Запускайте «Мой темп» через новую иконку.</li></ol></div>
      <div className="install-instructions"><h3>Android · Chrome</h3><p>В меню ⋮ выберите «Установить приложение» или «Добавить на главный экран». Затем открывайте его через иконку.</p></div>
      <p className="settings-note">Перед первым запуском с иконки скачайте резервную копию в настройках. Если записи не появились в приложении, восстановите их из этой копии.</p>
    </>}
    {message && <p role="status">{message}</p>}
  </DialogContent></Dialog>
}
