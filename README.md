# LO developer tools

Tools and documentation for building applications for LO.

## Validate application metadata

With this package installed, run:

```sh
lo doctor ./lo.app.json
lo doctor ./lo.app.json --json
```

The command checks a local manifest. It does not publish an application, verify URL availability, grant permissions, or replace server validation. Exit codes: `0` valid metadata, `1` invalid or unreadable manifest, `2` command usage error.

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

This is the local tooling manifest, not an RPC request or proof of registration. Registration identifiers and credentials belong to the deployment configuration. Optional `privacyUrl` follows the same URL rules. Optional `capabilities` declares distinct names; runtime availability is negotiated with the host.

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
