import { useEffect, useState } from "react";
type InstallEvent = Event & { prompt: () => Promise<{ outcome: string }> };
export function InstallHelp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const media = matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        media.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    update();
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", ready);
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      media.removeEventListener("change", update);
    };
  }, []);
  return (
    <section className="surface">
      <h2>Как приложение</h2>
      {installed ? (
        <p>Открыто с главного экрана.</p>
      ) : (
        <>
          <p>
            Запускайте с иконки, чтобы работать без адресной строки браузера.
          </p>
          {prompt && (
            <button
              className="btn primary full"
              onClick={async () => {
                await prompt.prompt();
                setPrompt(null);
              }}
            >
              Установить приложение
            </button>
          )}
          <h3>iPhone · Safari</h3>
          <p>
            «Поделиться» → «На экран Домой» → «Добавить». Если есть
            переключатель «Открывать как веб-приложение», включите его.
          </p>
          <h3>Android · Chrome</h3>
          <p>
            Меню ⋮ → «Установить приложение» или «Добавить на главный экран».
          </p>
          <p className="footnote">
            Перед первым запуском с иконки скачайте резервную копию. Если записи
            не появились, восстановите их из файла.
          </p>
        </>
      )}
    </section>
  );
}
