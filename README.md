# LO developer tools

Tools and documentation for building applications for LO.

## Validate application metadata

With this package installed, run:

```sh
lo doctor ./lo.app.json
lo doctor ./lo.app.json --publish
lo doctor ./lo.app.json --json
```

The command checks draft metadata by default. `--publish` also requires the stored profile fields the server checks before publication: an app avatar URL, a non-empty description, and a terms URL. The server additionally requires a stored app key and, when configured, a still-valid bot association. This local command cannot inspect those server-owned conditions. It does not publish an application, verify URL availability, grant permissions, validate an uploaded avatar reference, or replace server validation. Exit codes: `0` valid metadata, `1` invalid or unreadable manifest, `2` command usage error.

```json
{
  "schemaVersion": 1,
  "name": "Garden",
  "description": "Track plant care.",
  "entryUrl": "https://example.com/app",
  "iconUrl": "https://example.com/icon.png",
  "termsUrl": "https://example.com/terms"
}
```

This is the local tooling manifest, not an RPC request or proof of registration. Registration identifiers and credentials belong to the deployment configuration. Drafts require `name` and `entryUrl`; `description`, `iconUrl`, `termsUrl`, and `privacyUrl` may be empty or omitted until publication. Names are limited to 64 Unicode code points and descriptions to 512. URLs are trimmed, limited to 2048 UTF-8 bytes, and must be absolute HTTPS URLs with a hostname and no credentials or fragment.

The deployment mapping is direct: `entryUrl` becomes `MiniAppSettings.url`, while `iconUrl`, `termsUrl`, and `privacyUrl` become their snake-case RPC fields. Omitted `description` and `iconUrl` map to empty draft values. On create, omitted legal URLs default to empty; on update, omission preserves a legal URL and an explicit empty string clears it. `schemaVersion` and `capabilities` are tooling-only fields and are not sent to the management RPC. The server can alternatively resolve an uploaded avatar from trusted `icon_file_id` and `icon_host` values; this local manifest deliberately cannot assert upload ownership, so `--publish` checks a resolved `iconUrl`.

Optional `capabilities` declares distinct names; runtime availability is still negotiated with the host. Applications can reuse the validator without invoking the CLI:

```ts
import { validateManifest } from '@lo/developer-tools';

const issues = validateManifest(value, { publication: true });
```

## Repositories

| Repository | Responsibility |
| --- | --- |
| [lo-miniapp-sdk](https://github.com/lo-ink/lo-miniapp-sdk) | Application API, protocol and lifecycle |
| [lo-ui](https://github.com/lo-ink/lo-ui) | Design tokens and web UI |
| [lo-platform-adapters](https://github.com/lo-ink/lo-platform-adapters) | Host integrations and compatibility |
| [lo-bot-sdk](https://github.com/lo-ink/lo-bot-sdk) | Server-side bot clients |
| [lo-developer-tools](https://github.com/lo-ink/lo-developer-tools) | Tooling, documentation and templates |

The organization migration is in progress. Repository creation does not imply registry publication, consumer migration or native support. Check the release notes for supported package and host versions.

## Development

```sh
npm ci
npm run check
npm test
npm pack --dry-run
```

See [architecture](docs/architecture.md) for package boundaries and [migration](docs/migration.md) for the delivery stages.

Application guides: [migrate a Mini App to SDK 0.19](docs/miniapps.md) and
[bring an existing bot to LO](docs/bots.md).
