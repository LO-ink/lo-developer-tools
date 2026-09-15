# Bringing a bot to LO

Bot libraries run on your server. Mini App SDKs run in the embedded web page.
They have separate credentials and do not share an initialization mechanism.

## Existing Telegram bot libraries

The LO HTTP compatibility service uses a method root of `https://api.lo.ink`.
Libraries construct `/bot<TOKEN>/<method>` and the file-download route from
that root. Use an LO-issued bot token and preserve the existing library's
update-processing model.

| Library | Configuration | Local compatibility evidence |
| --- | --- | --- |
| Telegraf 4.16.3 | `telegram.apiRoot` | Actual client requests, JSON/multipart, files and errors |
| grammY 1.46.0 | `client.apiRoot` | Actual client requests, JSON/multipart, files and errors |
| aiogram 3.31.0 | `AiohttpSession(api=TelegramAPIServer.from_base(...))` | Actual client requests, commands, uploads, files and errors |
| python-telegram-bot / TelegramBots | Candidate integrations | No compatibility claim until their own contract and deployed tests pass |

Changing the root is enough to redirect requests. It does not make every
Telegram method, update type, keyboard or payment flow available in LO. Audit
the methods used by the application and compare them with the deployed
service's support before switching production traffic.

The [JavaScript library suite](https://github.com/lo-ink/lo-platform-adapters/tree/main/compatibility/bot-frameworks)
records the tested versions and configuration. The [Python suite](https://github.com/lo-ink/lo-platform-adapters/tree/main/compatibility/aiogram)
lives alongside it. These tests use a local HTTP
recorder, not a production bot. Polling and webhook ownership must be coordinated
separately: do not start a second poller against a bot already serving users.

## Native LO bot client

For new bots, `@lo/bot-sdk` provides a platform-neutral typed API. The separate
`@lo/bot-http-lo` transport owns credentials, URLs and HTTP serialization.
The initial client supports bot identity, plain-text send/edit/delete,
command management and polling. It does not yet expose every server method.

Use string identifiers without conversion to JavaScript numbers. Store
processed updates durably before advancing the polling cursor. Unknown
updates are returned as `kind: 'unhandled'`; decide how to handle them before
acknowledging them. A failed send may already have reached the server, so
automatic retries can duplicate messages.

The SDK contract and transport are independent of internal Connect RPC schemas.
Foreign request/response shapes stay in HTTP compatibility modules. New native
domain operations should not be modeled around a foreign library's class
hierarchy or numeric-ID assumptions.
