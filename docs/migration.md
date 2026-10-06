# Upgrading an LO application

Install the native SDK and LO adapter together. Keep the adapter in the application's composition root; the SDK does not discover platform globals.

```sh
npm install @lo-ink/miniapp-sdk @lo-ink/adapter-lo
```

Create one client for the application's lifetime and dispose it when its owner unmounts. Use `client.supports(...)` for controls, and still handle failures: a supported method can require consent or a configured bot. Verify signed launch data on the server before using it for identity or authorization.

For older LO installations, select `@lo-ink/adapter-lo-legacy` explicitly. Migration from other APIs is documented in [LO adapters](https://github.com/lo-ink/lo-platform-adapters/tree/main/docs); compatibility is opt-in.

When upgrading from Mini App SDK 0.19 to 0.20, import server verification from `@lo-ink/miniapp-sdk/server`, keep unverified `launchUnsafe` data for display only, and use `bindSafeAreaCss` to combine system and application insets.

Bot SDK 0.4 adds video, cached audio, albums and file downloads. Text is limited to 4096 UTF-16 units, captions to 1024. Media and edit operations accept inline keyboards. Uploaded video metadata cannot accompany cached file IDs. An explicit `retryRejected` can repeat one safe 429 refusal; it must not repeat uncertain sends or consumed streams.

Build from the lockfile and test the packaged dependencies as well as source imports. Check the application inside LO before rollout, including denied permissions, cancellation, theme changes and downloads. Record the deployed SDK and LO versions when reporting a failed method.
