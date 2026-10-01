# Bringing a bot to LO

Bot libraries run on your server. Mini App SDKs run in the embedded web page.
They have separate credentials and do not share an initialization mechanism.

## Native LO bot client

For new bots, `@lo-ink/bot-sdk` provides a platform-neutral typed API. The separate
`@lo-ink/bot-http-lo` transport owns credentials, URLs and HTTP serialization.
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

For an existing bot library, use the separate [migration guide](telegram-bots.md).
