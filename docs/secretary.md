# Build a LO secretary

A secretary is a bot acting in selected private human conversations on behalf of
an owner. Recipients see the human author; LO separately records the bot actor.
LO enforces consent and stores messages and drafts. Your bot runtime hosts the
response logic, storage and any AI provider.

Use `@lo-ink/bot-sdk` 0.4.4 with `@lo-ink/bot-http-lo` 0.5.1, or a later combination
verified against your deployed LO backend. Start with the
[reference bot](https://github.com/LO-ink/lo-platform-adapters/tree/main/examples/secretary)
and its synthetic tests. The Node example is a single-process template bot without AI.
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
6. Call `proposeDraft` with `reason: "manual_review"` and a stable request ID.
   The owner reviews and approves or cancels in LO. Approval belongs to the
   authenticated owner API, not the bot SDK.
7. Confirm the draft is sent, one outgoing message reaches the selected peer,
   and an excluded third conversation receives no action. Revoke the connection
   and confirm pending work cannot send.

The bot can separately use `sendText` when the owner grants `send_messages`.
There is no universal review requirement for third-party runtimes. A proposed
review draft cannot bypass its approval through direct sending. Reference
automatic templates require a separate explicit per-chat owner rule; sending
permission alone does not enable that rule.

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
The reference implementation demonstrates private state and restart recovery.

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

Draft text is bounded to 4096 UTF-16 units. Media require signed, scoped file IDs;
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
After uncertain owner approval, inspect drafts in LO and retry the exact owner
decision; receipts are retained only for their documented recovery window.

## Add AI deliberately

AI runs in your bot service, not inside the SDK. Explain which provider receives
conversation data and obtain the appropriate consent. Bound generation time,
output length and cost. Treat incoming text and model output as untrusted data:
neither may change the owner, recipient, rights, source context or request key.
Recheck server policy when submitting a result generated before an edit or revoke.
Do not treat model quality, prompt-injection resistance or spending controls as
properties certified by LO's authorization checks.

## Diagnose in order

Check capability, saved owner consent, selected chat and rights, then a fresh
incoming event, bot delivery, proposal and owner approval. A successful ordinary
chat with the bot proves only its ordinary receive path. A read-only connection
check does not prove secretary delivery or generation. Record the backend,
client, SDK and adapter versions when reporting failures.

See [operations and failures](https://github.com/LO-ink/lo-platform-adapters/blob/main/docs/secretary.md)
and the [typed review example](https://github.com/LO-ink/lo-platform-adapters/blob/main/examples/secretary-review.ts).
