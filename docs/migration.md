# Organization migration

## Starting point

The source browser SDK is 0.18.0, revision `15b832edfd03559b12cbb2e843141f10532f5c96`. The inspected native application baseline is `64c63e9e350ba35c6b96f037b6fab0b21f9047b2`. Preserve working capabilities and deployed applications while moving ownership to this organization.

## Delivery stages

1. Inventory exported helpers, host APIs, wire events, consumer dependencies and server trust boundaries. Record what has actual runtime coverage.
2. Introduce the canonical SDK adapter contract and UI tokens. Move foreign host discovery and compatibility to adapters. Test the full existing helper surface and report gaps explicitly.
3. Integrate a native LO bridge and optional inbound compatibility at the composition root. Preserve server-side consent, scoped credentials, navigation checks and installed-app state.
4. Migrate the example applications through clean, reviewed branches. Compare actual generated packages, lockfiles and production behavior. Preserve unrelated local work.
5. Exercise the contract on a third host and publish a capability matrix. Add native extensions only when their semantics are real and tested.
6. Publish signed-off packages and migration guides. Update application dependencies and record rollout evidence before deprecating old entrypoints.

## Existing applications

Keep the old published entrypoint available until its consumers have migrated. Avoid a global search-and-replace of host names: authorization, identity, event timing and capabilities may differ. Keep provider-specific user identifiers namespaced and link accounts explicitly.

Applications may retain their current UI while adopting the SDK. UI migration is optional and can proceed screen by screen. Native launch, close and permission surfaces remain host-owned.

## Completion

The migration is complete only after package artifacts, native integration, consumer deployments and runtime acceptance are verified. Remaining gaps belong in release notes and work tracking; an empty repository or passing isolated test is not completion evidence.
