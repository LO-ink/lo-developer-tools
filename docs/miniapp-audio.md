# Звук в мини-играх

На хостах LO, требующих жест для медиа, `AudioContext` после создания остаётся
`suspended`. Пытайтесь активировать его при старте и ещё раз на первом касании.
Ошибка автозапуска не должна блокировать игру или порождать необработанный Promise.

```ts
const audio = new AudioContext();
const resume = async () => {
  if (audio.state === "suspended") {
    try { await audio.resume(); } catch { /* Повтор на следующем жесте. */ }
  }
};
const onGesture = () => { void resume(); };
void resume();
window.addEventListener("pointerdown", onGesture);
// При размонтировании игры:
const disposeAudio = () => {
  window.removeEventListener("pointerdown", onGesture);
  void audio.close();
};
```

Отдельный переключатель звука должен оставаться доступным. Если контекст не
запустился после жеста, покажите состояние и разрешите повторное включение.
Для HTML `<audio>` также обработайте отказ `play()` и повторите его из обработчика
касания. Фоновый звук останавливайте при деактивации мини-приложения.

Подготовленная настройка WebView — `mediaPlaybackRequiresUserAction={false}` и
`allowsInlineMediaPlayback` в хосте. На 02.10.2026 выпуск этой правки не подтверждён;
**номера версии, начиная с которой жест не требуется, пока нет**. Не обещайте
автозапуск по номеру сборки и проверяйте состояние контекста на устройстве.
