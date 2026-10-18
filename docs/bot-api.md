# LO Bot API

The HTTP API root is `https://api.lo.ink`. Keep the token on the server. `@lo-ink/bot-sdk` uses string identifiers; its native HTTP transport handles serialization.

| SDK operation             | LO support                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------- |
| sendMessage / editMessage | Up to 4096 UTF-16 units; whitespace-only text is rejected                               |
| deleteMessage             | Deletes the bot's own message; cannot delete an incoming user message in a private chat |
| sendPhoto                 | Upload up to 10 MiB or a fileId; HTTP URLs are rejected                                 |
| sendDocument              | Upload up to 50 MiB or a fileId                                                         |
| sendVoice                 | AAC in M4A/MP4 or raw AAC; no caption                                                   |
| sendVideo                 | Upload up to 50 MiB when enabled by the installation, or a fileId                       |
| sendAudio                 | fileId only; no audio uploads                                                           |
| sendMediaGroup            | 2–10 photos or 2–10 documents; caption on the first item only                           |
| getFile / downloadFile    | Metadata and a byte stream; catalog media may have no path                              |

Deleting an incoming private-chat message returns `400: message to delete not found`. Do not promise automatic removal of user-uploaded secrets. Deleting a message does not establish that its file was removed from storage.

Captions are limited to 1024 UTF-16 units; an emoji can occupy two units. Use `replyMarkup` for keyboards. Reply keyboards are accepted by sendMessage; other methods accept inline keyboards. A registered app's button URL must match its LO Connect URL byte for byte.

Uploaded video accepts duration (0–86400), width/height (0–16384), an uploaded thumbnail and supportsStreaming. Upload metadata cannot accompany a fileId. Transcoding can take up to 45 seconds; the SDK allows 90 seconds for video by default. Disabled uploads produce an explicit error.

Correct `BadRequest` inputs and stop sending after `NotAllowed`. `RateLimited.retryAfterSeconds` specifies the delay. `Unavailable` denotes temporary failure, including non-JSON HTTP 5xx responses. A network failure does not prove the server rejected a send. Mutations are never retried automatically. `retryRejected` explicitly repeats one confirmed, safeToRetry refusal after its delay. Reuse bytes/Blob or create a fresh stream for each attempt.

Default limits are 30 messages per second per bot, 1 per second per chat (burst 5), and 20 per minute per group. Installations may impose stricter limits.

Native keyboard fields are `inlineKeyboard`, `callbackData`, `miniApp`, `resize`, `oneTime`, `persistent` and `placeholder`. App menu buttons use `type: "miniApp"`; the adapter constructs the HTTP representation.

`await bot.getCapabilities()` reads installation flags and refreshes its cache on demand after five minutes. Call it at startup and before capability-dependent jobs. `getCapabilities({ refresh: true })` forces a refresh. Missing capabilities remain unknown. Installation flags do not grant bot permissions.

For Python, `from lo_aiogram import capabilities` provides `await capabilities(bot)` and `await capabilities(bot, refresh=True)`. A structured `feature_disabled` response invalidates this per-session cache; the next read fetches current installation flags. The strict session preserves unsupported requests and errors. Existing handlers can opt into a separate compatibility layer, documented in the [Python adapter guide](https://github.com/LO-ink/lo-platform-adapters/tree/main/python/lo-aiogram). Its omissions and fallbacks do not add features to LO.

Ordinary message updates identify the sender by `from.id`. Do not depend on a populated name, username or `language_code` there; a serialized name may be empty. Callback-query and inline-query senders can carry `language_code`. Offer a `/language` command or language-selection buttons and persist the explicit choice by sender ID instead of guessing it from ordinary messages.

The request-contract emulator can queue synthetic messages, button callbacks and inline queries, wait on empty long polls, deliver webhooks and edit message keyboards. Its README lists implemented LO methods that remain unmodeled. Use its JSONL journal and `lo-bot-api-emulator verdict ... --require-response` for cross-container CI; synthetic success does not prove production permissions, storage or delivery. See the [Python adapter and emulator](https://github.com/LO-ink/lo-platform-adapters/tree/main/python) documentation for explicit compatibility, webhook limits and the loopback-only HTTP session restriction.
