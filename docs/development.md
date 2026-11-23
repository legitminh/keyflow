# Develop Keyflow with a consuming app

A GitHub Release is optional during development. Use a local package link for immediate iteration, commit pins for reproducible shared builds, and versioned release archives when you want a stable milestone.

## Live local development

Keyflow's public exports resolve to `dist`, so keep the package builder watching while editing. In the Keyflow checkout:

```sh
pnpm dev:package
```

This performs the initial package build and rebuilds when library files change. In a second terminal, link the local package into the consuming app once and start its dev server:

```sh
cd path/to/app
pnpm link path/to/keyflow
pnpm dev
```

Keep the watcher running. Keyflow edits rebuild the same linked `dist` files, and the app's dev server consumes them. No repacking, publishing, version bump, or repeated dependency installation is required for each edit. Restart the app's dev server once if it was already running when the link was created.

The link is a local development override. Keep the app's committed dependency for portable builds, and review machine-specific link or override changes before committing app configuration. Dependencies must already be installed in both checkouts. See [pnpm's linking documentation](https://pnpm.io/cli/link).

To restore the app's declared dependency:

```sh
cd path/to/app
pnpm unlink @legitminh/keyflow
```

pnpm removes the local link and reinstalls the declared dependency. See [pnpm unlink](https://pnpm.io/cli/unlink).

## Share a particular revision

An app can declare Keyflow by Git commit:

```sh
pnpm add github:legitminh/keyflow#<commit-sha>
```

Commit the app's `package.json` and lockfile so other machines and deployed builds use the same revision. A package version bump and GitHub Release are unnecessary for this path.

Local linking and commit pinning serve different needs: link while changing the library frequently; update the pin when sharing a tested revision. Publish a versioned archive when a stable, named release is useful.
