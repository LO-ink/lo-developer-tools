# Build a LO secretary

A secretary is a bot acting in selected private human conversations on behalf of
an owner. Recipients see the human author; LO separately records the bot actor.
LO enforces chat scope and delegated permissions and stores messages. Your bot
runtime owns AI response logic, proposals, approval and any AI provider. Native
exact-template auto-replies and schedules remain in LO.

Use the current published `@lo-ink/bot-sdk` with its native HTTP transport,
verified against the deployed LO backend. `createLoSecretaryClient` needs no
separate adapter. New integrations use bot-owned proposals; SDK 0.6.0 removes
the old native proposal operation. Confirm release availability before upgrading.
The [old native review example](https://github.com/LO-ink/lo-platform-adapters/tree/main/examples/secretary)
is retired. Do not start its poller or replay its stored jobs as sends.
Python `lo-aiogram` does not implement this native LO extension; familiar business
method names do not grant access to any account outside LO.

## Connect a test owner

1. Create a dedicated test bot and enable its secretary capability in LO bot management.
2. In the human owner's LO settings, open Secretary, select the bot and choose
   one private test conversation with another human. A profile name containing
   “Bot” does not determine whether its account is a bot.
3. Grant `receive_messages` and `send_messages` and save owner consent. Capability
   and the bot token alone do not grant access. Avoid `all_private` during testing.
4. Start one poller, or an authenticated webhook receiver. Polling and webhooks
   must not compete for the same bot update stream. Require the configured
   webhook secret before decoding any body.
5. Have the other test human send a new message after consent. Existing history
   is not exported. Process the `secretary_message` update with its exact context.
6. Persist an exact proposed reply, its context and a stable request ID in the
   bot. Present it in the owner's private bot chat. Authenticate the owner and
   callback, bind it to that exact proposal/message and atomically claim it.
   Connection access or an owner ID alone is not approval.
7. Recheck current consent and call `sendText` only for that approved operation.
   Confirm one outgoing message reaches the selected peer. Discarded, unapproved
   or excluded work must not send; replayed callbacks must not send twice. Revoke
   the connection while work is pending and confirm it cannot send.

Bots may implement their own explicitly enabled automatic reply mode. LO
permissions do not certify a bot's approval implementation. Keep the proposal
state machine and authorization checks separate from the AI model: model output
cannot approve itself, select another recipient or regenerate an action key.

LO's exact templates and schedules are a separate native feature; removing AI
approval from LO does not remove those owner-controlled rules.

## Keep identifiers and consent separate

| Field                               | Meaning                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| Bot ID                              | Authenticated bot; namespace your durable state by it       |
| Connection ID                       | Opaque consent connection, not a user ID                    |
| `context.conversationId`            | Messenger conversation ID from the delivered event          |
| `context.chatId`                    | Human peer ID; not interchangeable with conversation ID     |
| `policyVersion`                     | Exact permission revision from the event                    |
| `sourceMessageId`, `sourceRevision` | Incoming source and revision authorizing the action         |
| `eventId`                           | Stable event identity for processing deduplication          |
| Update cursor                       | Polling position; acknowledge only after durable processing |
| `requestId`                         | Stable identity for one exact action and body               |

All int64 IDs and revisions are decimal strings. Never convert them to JavaScript
numbers. Pass delivered context unchanged. Owner identity and token generation
are server-derived; supplying their values cannot create a grant.

Persist the exact request ID, context and body before a write. Partition state by
bot, connection and peer. After a timeout, cancellation or connection failure,
the outcome may already be committed: reuse the stored request, never mint a new
key. Advance the polling cursor or return webhook success only after durable
processing. Ignore human owner echoes and messages with a secretary actor.
Retain uncertain sends and the exact already approved operation. Legacy native
draft IDs, request IDs and receipts are historical evidence, never a migration
queue. Do not assign new keys or convert them to bot-owned sends.

## Rights and limits

The six independent rights are `receive_messages`, `send_messages`, `mark_read`,
`edit_sent`, `delete_sent` and `delete_all`. Receiving does not mark messages read;
sending does not grant edits or deletion. `delete_all` is destructive and requires
its own explicit grant.

LO checks current consent and credential generation at delivery and every action.
Pause/revoke/replace, policy changes, token rotation, excluded chats, source edits
or deletion, new incoming messages and manual takeover can invalidate queued
work. The source incoming window is 24 hours; external generation does not extend
it. Fail closed and stop obsolete jobs, even if a cached connection was enabled.

Reply text is bounded to 4096 UTF-16 units. Media require signed, scoped file IDs;
an ordinary or expired file ID cannot grant secretary access. Do not export
history, profiles/stories, payment permissions or private message bodies through
diagnostics. Quotas and supported media depend on the deployed backend: handle
server denial rather than promising unlimited access.

## Handle outcomes

| SDK category                                     | Handling                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `unauthenticated`                                | Check server-held credentials; stop the worker until repaired                    |
| `forbidden`, `not-found`                         | Stop obsolete or inaccessible work; do not switch owner or connection            |
| `conflict`                                       | Context or exact request identity no longer matches; stop and obtain a new event |
| `invalid-input`, `unsupported`                   | Fix the request or escalate for owner review                                     |
| `rate-limited`                                   | Respect `retryAfterSeconds`; retain the exact request                            |
| `timeout`, `aborted`, `transport`, `unavailable` | Unknown outcome; retain the exact request and processing position                |
| `invalid-response`                               | Stop and investigate safely; do not assume the write failed                      |

Never display or log raw upstream bodies, credentials, quoted messages or AI
prompts. Record safe codes, operation names and correlation metadata. A cancelled
client request does not retract bytes already authorized and delivered externally.
After an uncertain bot-owned send, reconcile its persisted attempt and recipient
evidence. Do not assume a denial proves no commit. Receipts are retained only for
their documented recovery window; expiry never permits a replacement key.

## Add AI deliberately

AI runs in your bot service, not inside the SDK. Explain which provider receives
conversation data and obtain the appropriate consent. Bound generation time,
output length and cost. Treat incoming text and model output as untrusted data:
neither may change the owner, recipient, rights, source context or request key.
If an assistant uses MCP knowledge, use only the corpus already authorized for
that bot/owner. An owner prompt may narrow the subject; it never grants access to
another owner's corpus. Keep delegated chat processing read-only for knowledge
tools and separate from coding, shell and mutation tools. Credentials stay in
the bot service, not prompts, proposal state or browser configuration.
Recheck server policy when submitting a result generated before an edit or revoke.
Do not treat model quality, prompt-injection resistance or spending controls as
properties certified by LO's authorization checks.

## Diagnose in order

Check capability, saved owner consent, selected chat and rights, then a fresh
incoming event, bot delivery, persisted proposal, approval callback and delegated send. A successful ordinary
chat with the bot proves only its ordinary receive path. A read-only connection
check does not prove secretary delivery or generation. Record the backend,
client, SDK and adapter versions when reporting failures.

See [operations and failures](https://github.com/LO-ink/lo-platform-adapters/blob/main/docs/secretary.md)
and the [typed final-send consent example](https://github.com/LO-ink/lo-platform-adapters/blob/main/examples/secretary-approved-reply.ts).
That helper requires an already authenticated and atomically claimed proposal;
it does not implement approval or verify a live deployment.
