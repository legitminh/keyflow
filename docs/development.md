# Develop Keyflow and Notework together

A GitHub Release is optional during development. Use a local package link for immediate iteration, commit pins for reproducible shared builds, and versioned release archives when you want a stable milestone.

## Live local development

Keyflow's public exports resolve to `dist`, so keep the package builder watching while editing. In a terminal:

```sh
cd /Users/minh/Projects/cs/keyflow
pnpm dev:package
```

This performs the initial package build and rebuilds when library files change. In a second terminal, link the local package once and start Notework:

```sh
cd /Users/minh/Projects/productivity/notework
pnpm link /Users/minh/Projects/cs/keyflow
pnpm dev
```

Keep the watcher running. Keyflow edits rebuild the same linked `dist` files; Notework's dev server consumes them. No repacking, publishing, version bump, or repeated dependency installation is required for each edit. Restart Notework's dev server once if it was already running when the link was created.

The link is a local development override. Preserve Notework's committed Git dependency for portable builds, and review machine-specific link/override changes before committing Notework configuration. Dependencies must already be installed in both checkouts. See [pnpm's linking documentation](https://pnpm.io/cli/link).

To restore Notework's declared dependency:

```sh
cd /Users/minh/Projects/productivity/notework
pnpm unlink @legitminh/keyflow
```

pnpm removes that local link and reinstalls the declared dependency. See [pnpm unlink](https://pnpm.io/cli/unlink).

## Share a particular revision

Notework already declares Keyflow by Git commit and includes `scripts/update-keyflow.mjs`. After committing and pushing the desired Keyflow changes, run in Notework:

```sh
pnpm update:keyflow
```

That script resolves Keyflow's remote HEAD and records its exact SHA in Notework's `package.json` and lockfile. Commit those files in Notework so other machines and deployed builds use the same revision. A package version bump and GitHub Release are unnecessary for this path.

Local linking and commit pinning serve different needs: link while changing the library frequently; update the pin when sharing a tested revision. Publish a versioned archive when a stable, named release is useful.
