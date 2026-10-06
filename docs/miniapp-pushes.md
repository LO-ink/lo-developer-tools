# Messages from a mini-app

Use `@lo-ink/miniapp-sdk` and `@lo-ink/bot-sdk` for a registered LO mini-app.

1. Create a bot in the same community and associate it with the app in LO Connect. After changing settings, choose **Save and publish**.
2. Save the one-time app key, appId and bot token on the server. The app key and bot token are separate secrets. Keep both out of bundles, URLs, logs and repositories. Use the appKey string directly; do not base64-decode it.
3. Request write access after a meaningful user action and after associating the bot. Hosts supporting `NO_BOT` produce a typed `NoBot` error. Older hosts may return false for either a missing bot or a declined permission; this response cannot distinguish them.
4. Retain the permission response until the server acknowledges it. On temporary failure, retry storing the response instead of asking the person again. The server verifies launch data and stores the verified user.id, permission response and reminder language selected in the app.
5. Send through a queue with `conversationId = user.id`. The **verified user.id is the bot's chat_id**. `launchUnsafe()` is for display and must not determine a server-side recipient.

```ts
// Server only. Obtain raw from client.adapter.launchData.
import { verifyInitData } from "@lo-ink/miniapp-sdk/server";
import {
  createLoBotClient,
  RateLimited,
  NotAllowed,
  BadRequest,
  Unavailable,
} from "@lo-ink/bot-sdk";

const launch = verifyInitData(raw, { appKey, appId, maxAgeSec: 3600 });
if (!launch.user) throw new Error("Missing verified user");
const bot = createLoBotClient({ token: botToken });
try {
  await bot.sendMessage({
    conversationId: launch.user.id,
    text: "Time for another game!",
    replyMarkup: {
      inlineKeyboard: [
        [
          {
            text: "Open",
            miniApp: { url: registeredAppUrl },
          },
        ],
      ],
    },
  });
} catch (error) {
  if (error instanceof RateLimited) {
    // Reschedule after retryAfterSeconds; use a conservative delay if unknown.
  } else if (error instanceof NotAllowed) {
    // Revoke stored consent and stop sending to this person.
  } else if (error instanceof BadRequest) {
    // Correct the request; description is bounded and sanitized.
  } else if (error instanceof Unavailable) {
    // Delivery may have succeeded. Any retry is an explicit application decision.
  } else throw error;
}
```

The miniApp URL must match the registered URL **byte for byte**, including path, trailing slash and query. Otherwise the page may not receive signed launch data for the registered app. These HTTPS buttons work in private chats. Use `setChatMenuButton` for the menu entry.

`BOT_SEND_LIMITS` exposes defaults: 30 messages per second per bot, 1 per second per chat (burst 5), and 20 per minute per group. Limit the queue by both bot and chat. The SDK provides neither an implicit limiter nor automatic send retries.

Upload photos with `sendPhoto({ conversationId, photo: { data, name, mime }, caption, replyMarkup })`. Save result.fileId and reuse `{ fileId }` afterwards. On `wrong file identifier`, remove the cached reference and explicitly upload the original again. LO accepts files, not photo URLs. Repeating a multipart upload creates a new message; it has no Idempotency-Key.

The Go verifier is `github.com/LO-ink/lo-miniapp-sdk/go/initdata`, function `Verify`. Node and Go share adversarial vectors in `go/initdata/testdata/initdata.json`.

Before enabling reminders, implement dry-run delivery, quiet hours in the person's timezone, and a fresh consent check at delivery.
