# Build a native LO Mini App

Use Mini App SDK 0.22 or later for the native LO client and transport.
The SDK discovers the host only when createLoClient is called; importing it is inert.
It does not inject globals or require a framework.

```sh
npm install @lo-ink/miniapp-sdk
```

Pin the reviewed SDK version in your lockfile before rollout. Check
its release notes and test it against your supported LO clients.

## Connect at the application boundary

```ts
import { createLoClient, MiniAppError } from "@lo-ink/miniapp-sdk";

const client = createLoClient();
if (!client) throw new Error("Open this application inside LO");
if (client.supports("ready")) await client.call("ready", undefined);
```

Pass the client to features. UI components receive values and user actions;
they do not select hosts, load scripts or render authoritative permission prompts.
Native discovery uses only the LO port. There is no additional LO adapter to
install. If the host lacks a required capability, explain the requirement to
the user and keep that action unavailable.

## Capabilities and lifecycle

```ts
if (client.supports("requestWriteAccess")) {
  const allowed = await client.call("requestWriteAccess", undefined);
  showMessagePermission(allowed);
}
renderTheme(client.adapter.snapshot().theme);
let stopTheme = () => {};
try {
  stopTheme = client.on("themeChanged", ({ theme }) => renderTheme(theme));
} catch (error) {
  if (!(error instanceof MiniAppError) || error.code !== "unsupported")
    throw error;
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

The host and device determine actual features. The current native transport does
not advertise invoices. Story presentation and vertical dismissal require their
capabilities in the corresponding LO host release; older ports omit them. A
contract declaration alone is not host support. Record missing features and
test required operations on the LO client builds your application supports.

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

[SDK contract and errors](https://github.com/LO-ink/lo-miniapp-sdk)
