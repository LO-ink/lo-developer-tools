# Moving a Mini App to the LO SDK

The 0.19 SDK separates the application API from host discovery. It is a breaking
change from 0.18 and earlier: adding the new dependency alone is insufficient.

The packages are being prepared for registry publication. The `@lo` names below
are the current source package names; they are not a promise that those names
can already be installed from npm. Until publication, use reviewed package
archives with recorded source revisions, SHA-256 checksums and a committed
package-manager lockfile.

## Choose a host at the application boundary

Keep the host selection in one integration module. Pass the resulting client
to application features; UI components do not select platforms.

```ts
import { createMiniAppClient } from '@lo/miniapp-sdk';
import { createAdapter as createLoAdapter } from '@lo/adapter-lo';
import { createAdapter as createTelegramAdapter } from '@lo/adapter-telegram';

const adapter = createLoAdapter() ?? createTelegramAdapter();
const client = adapter ? createMiniAppClient(adapter) : null;
```

This example detects already-initialized hosts and performs no script loading.
The Telegram adapter also exports an explicit `loadAdapter` for applications
that need the official host script. Keep it in the integration module and do
not invoke it when an LO host has already been injected. A keyboard-launched
Telegram application may explicitly opt into empty launch data; that mode
does not establish a signed identity.

## Replace the old entrypoints

| Earlier application code | 0.19 application code |
| --- | --- |
| `detectHost` / `loadHost` from the SDK | Discovery from the chosen adapter package |
| `host.sdk` | `createMiniAppClient(adapter)` |
| `supports(host, feature)` | `client.supports(feature)` |
| `sdk.ready()` / `sdk.expand()` | `client.call('ready', undefined)` / `client.call('expand', undefined)` |
| `sdk.BackButton.show()` | `client.call('setButton', { button: 'back', params: { visible: true } })` |
| `sdk.BackButton.onClick(handler)` | `client.on('backButtonClicked', handler)`; retain the returned unsubscribe function |
| Raw `themeParams` | `adapter.snapshot().theme` with semantic color roles |
| Browser globals and foreign version checks | Adapter capability checks or provider-specific extensions |

An unavailable capability rejects with `MiniAppError` code `unsupported`.
Render controls according to `client.supports(...)`. A supported operation can
still fail if the host disconnects or the request times out. Permission denial
is a successful boolean result of
`false`; it is distinct from a failed request.

Calls accept an `AbortSignal` and a positive timeout. Cancellation ends the
application's wait, aborts the adapter request signal and runs any cleanup
supplied by the adapter; it cannot undo a completed
payment, sent message, or native action. Do not retry writes automatically.
Call `client.dispose()` when its owner unmounts, and unsubscribe listeners when
their controls disappear. The client cannot be reused after disposal.

## Keep authentication on the server

Send the exact launch assertion to the application backend. The backend
selects the provider's verification algorithm, verifies the signature and age,
and issues its own session. Adapter detection is not authentication. Keep
provider-specific IDs namespaced; equal numeric IDs on two platforms do not
identify the same person.

The optional `authenticate` helper accepts an injected storage object and
application-owned `authenticate`, `validate` and `isUnauthorized` callbacks.
Its cache is only a hint. Existing backends may retain their current
`{ provider, initData }` request shape: map the neutral `adapterId` and
`launchData` at the integration boundary, without changing the signed bytes.

## Adopt UI independently

`@lo/ui` has no SDK or adapter dependency. Import its stylesheet explicitly and
apply `lo-ui-root` to the component subtree. Pass `data-lo-theme="light"` or
`"dark"` when the host should control the theme, and map the host palette to UI
tokens in the application's integration layer. Without an explicit theme, the
UI follows the operating system.

Host palette roles and a product's grouped-page layout are different concerns.
Preserve the existing page/card role choices when migrating a custom design.
Use the native host for install and permission confirmation; a web component
cannot grant platform permissions.

## Current host coverage

| Integration | Implemented boundary | Acceptance still needed |
| --- | --- | --- |
| LO | SDK 0.19 with `@lo/adapter-lo` 0.20: canonical `ready`, `expand`, `setClosingConfirmation`, `openLink`, `sendData`, and `requestWriteAccess`; matching-session legacy fallback | Dynamic appearance remains legacy-backed; released-client acceptance |
| Telegram | Version-gated operations, normalized callbacks/events, provider extensions | Hosted application acceptance on supported Telegram clients |
| VK | Official VK Bridge initialization, ready, theme, viewport, safe areas and lifecycle | Hosted authentication and broader operation support |

For VK, unsupported operations remain unavailable. Adding a new provider
requires an adapter and provider-specific authentication; it does not require
platform conditionals in SDK core or UI. Similar-looking APIs should only be
unified when their behavior, permission model and failure semantics agree.

See the [compiled integration example](https://github.com/lo-ink/lo-platform-adapters/blob/main/examples/vanilla.ts)
and [capability inventory](https://github.com/lo-ink/lo-platform-adapters/blob/main/docs/0.18.0-inventory.md).
Keep the previous deployed bundle available during rollout. Remove old
entrypoints only after consumer and client acceptance has passed.
