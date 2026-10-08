# Architecture

## Ownership

The SDK describes application intent with LO types and operations. New LO applications call `createLoClient` at their composition root; it discovers the native LO port and returns a client or null outside the host. No additional adapter is required. Importing the package does not discover a host or load scripts. Unsupported required capabilities fail explicitly. Subscriptions return cleanup handles. Pending work has bounded lifetime and cancellation.

The UI receives values and emits user actions. It does not authenticate, fetch, publish, request permissions, or detect a host. Theme tokens, safe area values and integration state reach it through composition. React hooks belong to an optional SDK integration package; using the SDK does not require React.

Adapters depend on public contracts. The contracts never depend on adapters. An adapter translates host-specific messages, types, errors, theme values and authorization data at the boundary. Host-specific functionality remains an adapter extension rather than nullable fields added to every shared type.

The native container owns WebView isolation, navigation policy, permission prompts and trusted install confirmation. The application cannot render an authoritative permission prompt itself. Client-side capability reporting is not backend authorization.

Bot clients are server-side consumers with distinct credentials. Browser SDK packages must not import bot clients or server authentication helpers. User access tokens for LO remain inside the native client; application servers receive launch assertions and validate them before creating their own sessions.

Server RPC schemas remain owned by the existing schema repository. Public protocol packages include only the reviewed application-facing contract. Generated RPC code is generated from pinned schema revisions; it is not a second manually maintained source.

## Native composition

The native Mini App SDK owns host discovery, protocol validation and request lifecycle. The Bot SDK's `createLoBotClient` owns the LO HTTP transport at the server boundary. UI and developer tools depend on neither transport. A failed or unavailable operation cannot select a different transport. Keep launch assertions, bot credentials and application sessions in their respective trust boundaries.

## Distribution

Packages have explicit export maps. Consumers use public entrypoints, not repository internals. Native packages release independently with supported version ranges and tested combinations. Existing immutable releases remain available; a rollout cannot assume all mini-app deployments update at once.

Use a registry release when namespace ownership and publication credentials are configured. Until then, a release archive must contain reproducible built packages with checksums and pinned consumer lockfile integrity. Never publish a Git-only package whose install depends on private repositories or a developer's local paths.

## Quality gates

- Compile the public call sites as part of CI.
- Test success, unsupported capabilities, permission denial, timeout, cancellation, late responses and disposal.
- Test the native port and server HTTP contracts independently, then exercise their composition inside LO.
- Reject reverse dependencies from SDK/UI into adapters or application internals.
- Check accessible names, keyboard/focus behavior, text scaling, contrast and reduced motion for UI components.
- Verify packed artifacts in a clean consumer project.
- Record the host build, package versions and backend revision for live acceptance.

Mocks prove contract behavior. A merged PR proves code integration. Neither proves production deployment or interoperability with a real platform.
