# Keyflow delivery

- Completed feature changes must be committed, pushed, and published as a GitHub Release unless the user explicitly requests local-only work. A local build or package link does not complete delivery for live consuming applications.
- Follow `PUBLISH.md` and use `pnpm release` for publication. New public APIs normally warrant a minor release. Verify the exact release commit's CI and the published archive before reporting completion.
- When a live consuming application's update is in scope, update its pinned dependency to the published revision, run its required checks, and push the dependency update. Preserve unrelated work by using an isolated checkout when needed.
