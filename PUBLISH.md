# Publishing Keyflow

Publish an installable `.tgz` archive as a GitHub Release in `legitminh/keyflow`. The package is not published to the npm registry. The `v0.1.2` release used this process: bump the version, validate and pack, push the source, wait for GitHub CI, then create the release and upload the archive.

## Automated release

From a clean `main` checkout, run:

```sh
pnpm release          # next patch version
pnpm release minor    # next minor version
pnpm release 1.0.0    # explicit newer stable version
```

The script checks the repository, branch, GitHub write access and remote ancestry. It installs the frozen lockfile, runs type checks/build/unit tests/browser tests, updates package.json and versioned README install links, packs outside the repository, and checks public modules/declarations and the archive checksum. It commits only the two version files, pushes the exact release commit, waits for `check.yml` on that SHA, and publishes a GitHub Release with the archive. Finally it verifies the stable release, tag commit and asset SHA-256. Feature changes must be committed first; it never stages them automatically.

Release notes come from commit messages since the latest release, with installation, validation and documentation links. To use reviewed custom notes for the Changes section:

```sh
pnpm release minor --notes-file /path/to/changes.md
```

Preview the next version and notes without changing files, pushing or publishing:

```sh
pnpm release minor --dry-run
```

If pushing, CI, uploading or final publication fails after the script has created its `Release vX.Y.Z` commit, resolve the problem and rerun without another version bump:

```sh
pnpm release --resume
```

Resume requires that exact clean release commit at HEAD. It revalidates the source, rebuilds the archive and checks CI; it can finish a matching draft or upload a missing asset, and refuses to overwrite a mismatched archive or tag. An already published matching release is verified instead of replaced. Failures before a release commit preserve any version-file changes for inspection; the script does not reset user work.

Requirements: Node 24, the pinned pnpm version, Git, GitHub CLI, and browser-test dependencies. `CHROME_PATH` is respected; installed Chrome is detected automatically on macOS/Linux, otherwise Playwright's installed browser is used. Local browser validation uses three workers. The script uses the existing GitHub CLI account when authorized, or the Git-credential fallback documented below, without printing/saving tokens or changing the default account.

The manual procedure below remains available for inspection and troubleshooting. Releases are still GitHub archives, not npm publications. Local linking and Notework's commit-pin workflow in [docs/development.md](docs/development.md) remain available without releases.

## 1. Check access and the next version

Run from the repository root with Node.js 24, pnpm 9.15.0 (pinned in `package.json`), Git, and GitHub CLI installed.

```sh
git status --short
git branch --show-current
git remote -v
gh auth status
gh api user --jq .login
gh api repos/legitminh/keyflow --jq .permissions.push
gh release list --repo legitminh/keyflow --limit 10
git ls-remote origin HEAD 'refs/tags/*'
```

Use `main` and confirm `origin` points to `https://github.com/legitminh/keyflow.git`. Review any uncommitted work before including it. GitHub access must allow pushing commits and creating releases; the permissions check should print `true`.

If GitHub CLI uses an account without write access, switch to an authorized account:

```sh
gh auth switch --hostname github.com --user legitminh
# If that account has not been added:
gh auth login --hostname github.com
```

Git and GitHub CLI can use different credentials. See the fallback below if Git can push but GitHub CLI still uses the wrong account.

Choose a version not already used by a release or tag. Update `package.json` and all versioned archive names and installation URLs in `README.md`. For example, the release after `0.1.2` could be `0.1.3`.

## 2. Validate and build the archive

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
git diff --check
```

On Linux, use `pnpm exec playwright install --with-deps chromium` to install browser system dependencies too. To use an existing Chrome installation on macOS instead of downloading Chromium:

```sh
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' pnpm test:browser
```

GitHub CI uses Chrome already installed on the hosted runner through `CHROME_PATH`. This runs the same browser suite without downloading Chromium or extra system fonts from package mirrors. A clean Linux machine without Chrome can still use the Playwright installation command above.

Create the archive outside the repository. Keep these shell variables for the remaining steps:

```sh
release_version=$(node -p "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')).version")
release_tag="v${release_version}"
release_dir=$(mktemp -d /tmp/keyflow-release.XXXXXX)
release_archive="${release_dir}/legitminh-keyflow-${release_version}.tgz"
pnpm pack --pack-destination "$release_dir"
```

`pnpm pack` runs `prepack`, which rebuilds `dist`. Check the archive's version, public exports, declarations, and checksum:

```sh
tar -tzf "$release_archive"
tar -xOf "$release_archive" package/package.json
tar -xOf "$release_archive" package/dist/index.js
tar -xOf "$release_archive" package/dist/index.d.ts
shasum -a 256 "$release_archive"
```

Confirm any new public modules and their `.d.ts` files are included. If package contents change after packing, validate and pack again.

## 3. Commit, push, and wait for CI

Review the diff and stage the intended release changes, including new source files. Stage version and documentation updates explicitly:

```sh
git diff
git add package.json README.md PUBLISH.md
# Also stage the intended source/test changes, if not already committed.
git diff --cached
git commit -m "Release ${release_tag}"
git status --short
release_commit=$(git rev-parse HEAD)
git push origin main
```

The working tree should be clean before proceeding. The release must reference the commit containing the source used to build the archive.

Find the validation run for that exact commit:

```sh
gh run list --repo legitminh/keyflow --commit "$release_commit" --limit 5
release_run=$(gh run list --repo legitminh/keyflow --commit "$release_commit" --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$release_run" --repo legitminh/keyflow --exit-status --interval 10
```

If no run appears yet, wait briefly and repeat the lookup. Publish after the run passes. To diagnose a failure:

```sh
gh run view "$release_run" --repo legitminh/keyflow --log-failed
```

For `v0.1.2`, CI initially failed because `pnpm/action-setup` specified `version: 9` while `package.json` pinned `pnpm@9.15.0`. The fix was to remove the workflow's `version` setting and let the action read `packageManager`. Keep that single source of truth. If a fix adds another commit, push it, refresh `release_commit`, and wait for its validation run.

## 4. Write release notes and publish

Create `$release_dir/notes.md` with the actual changes, configuration examples where useful, validation results, and the installation command. For example:

```sh
cat > "$release_dir/notes.md" <<EOF
Describe the changes in ${release_tag} here.

### Install

\`\`\`sh
pnpm add https://github.com/legitminh/keyflow/releases/download/${release_tag}/legitminh-keyflow-${release_version}.tgz
\`\`\`

### Validation

Describe the checks that passed locally and in GitHub CI.
EOF
```

Replace the placeholder descriptions and review the notes before publishing:

```sh
cat "$release_dir/notes.md"
gh release create "$release_tag" "$release_archive" \
  --repo legitminh/keyflow \
  --target "$release_commit" \
  --title "$release_tag" \
  --notes-file "$release_dir/notes.md" \
  --latest
```

This creates the tag at the validated commit, publishes the release, and uploads the package archive. A separate local `git tag` step is unnecessary. Do not reuse an existing published version for different package contents.

## 5. Verify the published release

```sh
gh release view "$release_tag" --repo legitminh/keyflow \
  --json url,isDraft,isPrerelease,tagName,targetCommitish,assets
gh api "repos/legitminh/keyflow/git/ref/tags/${release_tag}" --jq .object.sha
```

Confirm the release is published (`isDraft: false`), is a stable release (`isPrerelease: false`), and its tag points to `$release_commit`. Confirm the archive asset is `uploaded`, its filename matches the version, and its SHA-256 digest matches the local checksum. Share the release URL and installation command.

## Fallback: use Git's saved credential for GitHub CLI

During `v0.1.2`, GitHub CLI authenticated as `jobnest-org` with read-only access, while Git's credential helper authenticated as `legitminh` with write access. The release used the latter credential for a single GitHub CLI process, without changing the default CLI account.

If this happens again, the following wrapper passes Git's saved GitHub credential directly to the CLI process. It does not print or save the credential. Use it only when the configured credential helper already has an authorized GitHub credential for this repository.

```sh
gh_with_git_credentials() {
  python3 - "$@" <<'PY'
import os
import subprocess
import sys

result = subprocess.run(
    ['git', 'credential', 'fill'],
    input='protocol=https\nhost=github.com\npath=legitminh/keyflow.git\n\n',
    text=True, capture_output=True, check=True,
)
credential = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
env = os.environ.copy()
env['GH_TOKEN'] = credential['password']
subprocess.run(['gh', *sys.argv[1:]], env=env, check=True)
PY
}

gh_with_git_credentials api user --jq .login
gh_with_git_credentials api repos/legitminh/keyflow --jq .permissions.push
```

If these show the intended account and `true`, substitute `gh_with_git_credentials` for `gh` in the release creation command above. This uses the same archive, notes, tag, and validated commit.
