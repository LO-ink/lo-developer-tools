# Build a native LO Mini App

Use the LO SDK for application intent and the native LO adapter for transport.
The SDK does not discover a host, inject globals or require a framework.

```sh
npm install @lo-ink/miniapp-sdk @lo-ink/adapter-lo
```

The native integration uses SDK 0.20.1 and adapter 0.23.0. Verify
registry availability and pin reviewed versions in your lockfile before rollout.

## Connect at the application boundary

```ts
import { createMiniAppClient, MiniAppError } from '@lo-ink/miniapp-sdk';
import { createAdapter } from '@lo-ink/adapter-lo';

const adapter = createAdapter();
if (!adapter) throw new Error('Open this application inside LO');
const client = createMiniAppClient(adapter);
if (client.supports('ready')) await client.call('ready', undefined);
```

Pass the client to features. UI components receive values and user actions;
they do not select hosts, load scripts or render authoritative permission prompts.
Native discovery uses only the LO port. It never silently adds older host APIs.
For an existing application on older LO clients, explicitly choose the separate
`@lo-ink/adapter-lo-legacy` integration until all required native features ship.

## Capabilities and lifecycle

```ts
if (client.supports('requestWriteAccess')) {
  const allowed = await client.call('requestWriteAccess', undefined);
  showMessagePermission(allowed);
}
renderTheme(client.adapter.snapshot().theme);
let stopTheme = () => {};
try {
  stopTheme = client.on('themeChanged', ({ theme }) => renderTheme(theme));
} catch (error) {
  if (!(error instanceof MiniAppError) || error.code !== 'unsupported') throw error;
  // Keep snapshot-only rendering when the host has no live theme events.
}

// At teardown:
stopTheme();
client.dispose();
```

Permission denial is a successful `false` result. Unsupported operations reject
with `MiniAppError` code `unsupported`. Event subscriptions can also be
unsupported. Requests have deadlines and accept cancellation. Handle timeout,
abort and transport failure even when a capability is available.
Cancellation cannot undo an already completed native action. Do not retry writes
automatically. A disposed client cannot be reused.

The host and device determine actual features. The current native adapter does
not advertise invoices. Story presentation and vertical dismissal require their
capabilities in the corresponding LO host release; older ports omit them. A
contract declaration alone is not host support. Record missing features and
choose explicit older-host integration when required.

## Authenticate on your server

Send unchanged launch bytes to your backend for signature, age and audience
verification. Host detection is not authentication. Issue application sessions
only after verification and keep server credentials out of browser bundles.

The optional `authenticate` helper accepts application-owned callbacks and an
explicit storage object. Cached sessions are only hints and are validated by
that backend. It reads no global browser storage implicitly.

## Test the application boundary

Exercise the public package entrypoints, permission decline, teardown,
cancellation, late responses, host appearance and required native operations.
Record the native client build and package versions for live acceptance.

[SDK contract and errors](https://github.com/LO-ink/lo-miniapp-sdk) ·
[Native integration](https://github.com/LO-ink/lo-platform-adapters/tree/main/packages/lo)
