# Bringing a bot to LO

Bot libraries run on your server. Mini App SDKs run in the embedded web page.
They have separate credentials and do not share an initialization mechanism.

## Native LO bot client

For new bots, `@lo-ink/bot-sdk` provides a typed LO API. The separate
`@lo-ink/bot-http-lo` transport owns credentials, URLs and HTTP serialization.
The client supports identity flags, text send/edit/delete, typed keyboards, photo/document/voice/video uploads, audio references, homogeneous albums, file metadata/downloads, commands and polling. See [Bot API](bot-api.md) for limits and error handling.

Use string identifiers without conversion to JavaScript numbers. Store
processed updates durably before advancing the polling cursor. Unknown
updates are returned as `kind: 'unhandled'`; decide how to handle them before
acknowledging them. A failed send may already have reached the server, so
automatic retries can duplicate messages.

The SDK contract and transport are independent of internal Connect RPC schemas.
Foreign request/response shapes stay in HTTP compatibility modules. New native
domain operations should not be modeled around a foreign library's class
hierarchy or numeric-ID assumptions.

Existing-library integrations and migration guides live in [lo-platform-adapters](https://github.com/LO-ink/lo-platform-adapters).
