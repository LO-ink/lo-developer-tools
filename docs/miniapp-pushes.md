# Пуши из мини-приложения

Рецепт для зарегистрированного мини-приложения LO. Требует `@lo-ink/miniapp-sdk`
0.20.1, `@lo-ink/bot-sdk` 0.4.0 и `@lo-ink/bot-http-lo` 0.4.0.
Эти версии нужно выпускать вместе; наличие исходников в main само по себе не означает публикацию в npm.

1. Создайте бота в том же сообществе и привяжите его к мини-приложению в LO Connect.
   Изменение настроек снимает публикацию: выберите «Сохранить и опубликовать».
2. Ключ подписи показывается один раз. Сохраните `appKey`, `appId` и токен бота на
   сервере. Ключ приложения и токен бота — разные секреты; ни один не попадает в
   бандл, URL, журнал или репозиторий. Строку `appKey` не декодируйте из base64.
3. Попросите `requestWriteAccess` один раз после понятного действия, например первой
   партии, и только после привязки бота. Новые хосты с поддержкой `NO_BOT` отвечают
   типизированной ошибкой `NoBot`. Старые хосты могут вернуть `false` и при отсутствии
   бота, и при отказе человека: различить эти случаи по этому ответу нельзя.
4. Сохраните ответ локально до подтверждения сервера. При временной ошибке повторите
   передачу этого ответа, а не вопрос человеку. Сервер проверяет данные запуска,
   сохраняет проверенный `user.id`, ответ и выбранный в приложении язык напоминаний.
5. Отправляйте сообщения через очередь с `conversationId = user.id`. Именно
   **проверенный `user.id` — `chat_id` для бота**. `launchUnsafe()` пригоден для
   интерфейса, но не для определения получателя на сервере.

```ts
// Только сервер. raw приходит из client.adapter.launchData.
import { verifyInitData } from "@lo-ink/miniapp-sdk/server";
import { createBotClient, RateLimited, NotAllowed, BadRequest, Unavailable } from "@lo-ink/bot-sdk";
import { createLoHttpBotTransport } from "@lo-ink/bot-http-lo";

const launch = verifyInitData(raw, { appKey, appId, maxAgeSec: 3600 });
if (!launch.user) throw new Error("Missing verified user");
const bot = createBotClient(createLoHttpBotTransport({ token: botToken }));
try {
  await bot.sendMessage({
    conversationId: launch.user.id,
    text: "Пора сыграть ещё одну партию!",
    replyMarkup: { inlineKeyboard: [[{
      text: "Открыть", miniApp: { url: registeredAppUrl },
    }]] },
  });
} catch (error) {
  if (error instanceof RateLimited) {
    // Перепланировать задание не раньше retryAfterSec; неизвестная пауза
    // требует консервативной задержки. SDK сам ничего не повторяет.
  } else if (error instanceof NotAllowed) {
    // Снять согласие и перестать писать этому человеку.
  } else if (error instanceof BadRequest) {
    // Исправить запрос; description содержит ограниченное очищенное описание.
  } else if (error instanceof Unavailable) {
    // Возможен дубль: сервер мог принять запрос до разрыва соединения.
    // Повтор с нарастающей паузой — явное решение приложения.
  } else throw error;
}
```

URL `miniApp` должен совпадать с URL приложения в LO Connect **байт в байт**,
включая путь, завершающий `/` и query. Иначе открытая страница может не получить
подписанные данные зарегистрированного приложения. Такие кнопки работают только
в личном чате и используют HTTPS. Кнопку меню задаёт `setChatMenuButton`.

По умолчанию платформа разрешает 30 сообщений/с на бота, 1/с на чат (всплеск 5) и
20/мин в группу. `BOT_SEND_LIMITS` экспортирует эти значения; конкретная инсталляция
может выставить более строгие. Ограничивайте очередь одновременно по боту и чату.
SDK не делает автоматических повторов и не включает скрытый ограничитель темпа.

Для фото используйте `sendPhoto({ conversationId, photo: { data, name, mime },
caption, replyMarkup })`. Сохраните `result.fileId` после успешной загрузки и затем
передавайте `photo: { fileId }`. При `BadRequest` с `wrong file identifier` удалите
ссылку из кеша и явно загрузите исходник заново. URL вместо файла LO не принимает.
Повтор multipart-загрузки создаёт новое сообщение: Idempotency-Key для неё нет.

Go-верификатор: публичный stdlib-модуль
`github.com/LO-ink/lo-miniapp-sdk/go/initdata`, функция `Verify`.
Node и Go используют общие векторы из `lo-miniapp-sdk/go/initdata/testdata/initdata.json`.

Перед рассылкой включите `DRY_RUN`, дневное окно по часовому поясу человека и
повторную проверку актуального согласия. Референсный сценарий — сервер «Высотки»,
`server/internal/{initdata,push,texts}`. В публичном примере не должно быть его
секретов или внутренних адресов.
