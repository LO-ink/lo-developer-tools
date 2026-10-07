# Package releases

Update the package version and lockfile in a pull request. After that pull request passes review and merges into `main`, the repository CI runs its existing checks and publishes new versions to npm. Versions already present in the registry are content-verified without republishing; retries never overwrite or blindly resend an upload. Workspace packages are published in dependency order. Stable versions use `latest`; prereleases use `next` when their semantic version does not precede the current tag. An older missing version uses `release-<version>` instead and preserves the newer channel tag.

npm access uses Trusted Publishing with GitHub owner `LO-ink`, this repository, workflow `ci.yml`, environment `npm`, and permission to run `npm publish`. No npm token is required. The `npm` environment permits only `main`. Pull requests cannot run the publishing job. The shared publishing action is pinned to a reviewed commit of `LO-ink/lo-developer-tools`.

To retry after an infrastructure failure, rerun the failed job in GitHub Actions or run the CI workflow on `main`. Each new uploaded archive is checked against the public registry integrity before the job succeeds. A registry error fails the job rather than being treated as a missing version.

Immediately before each upload, the publisher checks that the local HEAD and event SHA match the current remote `main`. A delayed job from an older revision stops before mutation; run checks on current `main` instead. Fresh registry tags are checked with strict semantic-version ordering, including numeric prerelease identifiers, and the uploaded tag is verified after registry processing. Tag and source lookup failures fail closed. Publishing jobs must retain their shared concurrency group; repository owners must coordinate external writes to these tags because npm does not provide an atomic compare-and-set for tag updates.

The action only uses `npm publish` for registry mutations. It does not require the optional Trusted Publishing permission for separate `npm dist-tag` commands or an npm token.
