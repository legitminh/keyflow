#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { nextVersion, parseArguments, releaseNotes, updateReadme, verifyPublishedRelease, versionParts } from './release-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = 'legitminh/keyflow';
let ghEnv = process.env;
let committed = false;
let artifactDirectory;

function execute(command, args, { capture = false, allowFailure = false, env = process.env, input } = {}) {
  const result = spawnSync(command, args, {
    cwd: root, env, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    stdio: capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit'
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    // Commands never include tokens; credential-helper output is never passed to this reporter.
    throw new Error(`${command} ${args.join(' ')} failed${capture && result.stderr ? `:\n${result.stderr.trim()}` : ''}`);
  }
  return result;
}
const output = (command, args) => execute(command, args, { capture: true }).stdout.trim();
const git = (...args) => output('git', args);
const gh = (...args) => execute('gh', args, { capture: true, env: ghEnv }).stdout.trim();
const api = (path) => JSON.parse(gh('api', path));

function cleanTree() {
  if (git('status', '--porcelain')) throw new Error('Commit or stash working-tree changes before releasing; the script never stages feature changes.');
}
function authenticate() {
  const allowed = (env) => {
    const result = execute('gh', ['api', `repos/${repo}`, '--jq', '.permissions.push'], { capture: true, allowFailure: true, env });
    return !result.error && result.status === 0 && result.stdout.trim() === 'true';
  };
  if (!allowed(ghEnv)) {
    // Follow PUBLISH.md's existing fallback without printing/saving credentials or changing accounts.
    const credential = spawnSync('git', ['credential', 'fill'], {
      cwd: root, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, encoding: 'utf8',
      input: `protocol=https\nhost=github.com\npath=${repo}.git\n\n`, stdio: ['pipe', 'pipe', 'pipe']
    });
    const password = credential.status === 0
      ? credential.stdout.split('\n').find((line) => line.startsWith('password='))?.slice('password='.length) : undefined;
    if (!password) throw new Error('GitHub CLI lacks write access, and no authorized Git credential was available. See PUBLISH.md.');
    const fallback = { ...process.env, GH_TOKEN: password };
    if (!allowed(fallback)) throw new Error('Neither GitHub CLI nor the saved Git credential has repository write access.');
    ghEnv = fallback;
  }
  console.log(`GitHub account: ${gh('api', 'user', '--jq', '.login')}`);
}
function optionalRelease(tag) {
  const result = execute('gh', ['api', `repos/${repo}/releases/tags/${tag}`], { capture: true, allowFailure: true, env: ghEnv });
  if (result.status === 0) return JSON.parse(result.stdout);
  if (result.stderr?.includes('(HTTP 404)')) return null;
  throw new Error(`Could not check the release: ${result.stderr?.trim() || 'GitHub request failed'}`);
}
function tagCommit(tag) {
  let object = api(`repos/${repo}/git/ref/tags/${tag}`).object;
  while (object.type === 'tag') object = api(`repos/${repo}/git/tags/${object.sha}`).object;
  if (object.type !== 'commit') throw new Error(`Tag ${tag} does not resolve to a commit`);
  return object.sha;
}
function browserEnvironment() {
  const chrome = process.env.CHROME_PATH || [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ].find(existsSync);
  return chrome ? { ...process.env, CHROME_PATH: chrome } : process.env;
}
function validateArchive(archive, version) {
  const names = new Set(output('tar', ['-tzf', archive]).split('\n'));
  const packed = JSON.parse(output('tar', ['-xOf', archive, 'package/package.json']));
  if (packed.name !== '@legitminh/keyflow' || packed.version !== version) throw new Error('Archive package identity/version mismatch');
  const required = ['dist/index.js', 'dist/index.d.ts', 'dist/styles.css'];
  const index = output('tar', ['-xOf', archive, 'package/dist/index.js']);
  for (const match of index.matchAll(/from\s+['"]\.\/(.+?)['"]/g)) {
    const path = `dist/${match[1]}`;
    required.push(path, path.endsWith('.svelte') ? `${path}.d.ts` : path.replace(/\.js$/, '.d.ts'));
  }
  for (const path of required) if (!names.has(`package/${path}`)) throw new Error(`Archive missing public module/declaration: ${path}`);
  const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
  console.log(`Verified ${names.size} archive entries. SHA-256: ${digest}`);
  return digest;
}
async function waitForCI(commit) {
  console.log(`Waiting for check.yml on ${commit}...`);
  let run;
  for (let attempt = 0; attempt < 18; attempt++) {
    const runs = JSON.parse(gh('run', 'list', '--repo', repo, '--commit', commit, '--workflow', 'check.yml',
      '--event', 'push', '--limit', '5', '--json', 'databaseId,headSha,status,conclusion,url'));
    run = runs.find((item) => item.headSha === commit);
    if (run) break;
    await delay(10000);
  }
  if (!run) throw new Error('No validation run appeared for the release commit. Resume once GitHub CI is available.');
  execute('gh', ['run', 'watch', String(run.databaseId), '--repo', repo, '--exit-status', '--interval', '10'], { env: ghEnv });
  const checked = JSON.parse(gh('run', 'view', String(run.databaseId), '--repo', repo, '--json', 'headSha,status,conclusion'));
  if (checked.headSha !== commit || checked.status !== 'completed' || checked.conclusion !== 'success') {
    throw new Error(`Release commit has not passed GitHub CI: ${run.url}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: pnpm release [patch|minor|major|X.Y.Z] [--notes-file PATH] [--dry-run]\n' +
      '       pnpm release --resume [--notes-file PATH]\n\n' +
      'Default: patch. Requires a clean main branch. Validates, packs, commits the version bump, pushes,\n' +
      'waits for exact-commit CI, publishes a GitHub Release, and verifies the tag/archive digest.\n' +
      '--dry-run only checks preconditions and prints notes. --resume retries a clean Release vX.Y.Z commit without bumping.');
    return;
  }
  cleanTree();
  if (git('branch', '--show-current') !== 'main') throw new Error('Release from main');
  const remote = git('remote', 'get-url', 'origin');
  if (!/^https:\/\/github\.com\/legitminh\/keyflow(?:\.git)?\/?$/.test(remote) && remote !== 'git@github.com:legitminh/keyflow.git') {
    throw new Error('origin must point to legitminh/keyflow on github.com');
  }
  const packagePath = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (pkg.name !== '@legitminh/keyflow') throw new Error('Unexpected package name');
  versionParts(pkg.version);
  const version = options.resume ? pkg.version : nextVersion(pkg.version, options.bump);
  const tag = `v${version}`;
  const initialCommit = git('rev-parse', 'HEAD');
  if (options.resume && git('log', '-1', '--format=%s') !== `Release ${tag}`) {
    throw new Error('--resume requires the clean Release vX.Y.Z commit created by this script at HEAD');
  }
  authenticate();
  const remoteCommit = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0];
  if (!/^[a-f0-9]{40}$/.test(remoteCommit) ||
      execute('git', ['merge-base', '--is-ancestor', remoteCommit, initialCommit], { capture: true, allowFailure: true }).status !== 0) {
    throw new Error('Local main does not contain remote main. Fetch and integrate it before releasing.');
  }
  let existing = optionalRelease(tag);
  const remoteTag = git('ls-remote', 'origin', `refs/tags/${tag}`);
  if (!options.resume && (existing || remoteTag)) throw new Error(`${tag} already exists; choose a new version`);
  if (options.resume && remoteTag && tagCommit(tag) !== initialCommit) throw new Error('Existing tag belongs to a different commit');
  if (options.resume && existing?.draft && existing.target_commitish !== initialCommit) throw new Error('Draft targets a different commit');
  const latest = JSON.parse(gh('release', 'list', '--repo', repo, '--limit', '100', '--json', 'tagName,isLatest')).find((item) => item.isLatest);
  const baseline = latest && latest.tagName !== tag ? tagCommit(latest.tagName) : null;
  const changes = git('log', ...(baseline ? [`${baseline}..${initialCommit}`] : [initialCommit, '-20']), '--format=%s')
    .split('\n').filter((line) => line && !line.startsWith('Release v'));
  const notes = releaseNotes({ version, changes, body: options.notesFile ? readFileSync(resolve(options.notesFile), 'utf8') : undefined,
    previousTag: baseline ? latest.tagName : undefined });
  console.log(`${options.resume ? 'Resume' : 'Release'} ${tag} on main. Package: legitminh-keyflow-${version}.tgz`);
  if (options.dryRun) { console.log(notes); return; }

  execute('pnpm', ['install', '--frozen-lockfile', '--config.update-notifier=false'], { env: { ...process.env, CI: 'true' } });
  execute('pnpm', ['check']);
  execute('pnpm', ['build']);
  execute('pnpm', ['test']);
  execute('pnpm', ['test:browser', '--workers=3'], { env: browserEnvironment() });
  execute('git', ['diff', '--check']);
  cleanTree();
  if (git('rev-parse', 'HEAD') !== initialCommit) throw new Error('HEAD changed during validation');
  if (!options.resume) {
    const readmePath = join(root, 'README.md');
    const readme = updateReadme(readFileSync(readmePath, 'utf8'), pkg.version, version);
    pkg.version = version;
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    writeFileSync(readmePath, readme);
  }
  artifactDirectory = mkdtempSync(join(tmpdir(), `keyflow-release-${version}-`));
  const archiveName = `legitminh-keyflow-${version}.tgz`;
  const archive = join(artifactDirectory, archiveName);
  execute('pnpm', ['pack', '--pack-destination', artifactDirectory]);
  const digest = validateArchive(archive, version);
  const notesFile = join(artifactDirectory, 'notes.md');
  writeFileSync(notesFile, notes);
  if (git('rev-parse', 'HEAD') !== initialCommit) throw new Error('HEAD changed while packing; refusing to publish a mixed revision');
  if (!options.resume) {
    const changed = git('diff', '--name-only').split('\n').filter(Boolean);
    if (changed.some((path) => !['package.json', 'README.md'].includes(path)) || git('ls-files', '--others', '--exclude-standard')) {
      throw new Error('Unexpected changes appeared while packing; nothing has been committed');
    }
    execute('git', ['add', '--', 'package.json', 'README.md']);
    execute('git', ['diff', '--cached', '--check']);
    execute('git', ['commit', '-m', `Release ${tag}`]);
  }
  const commit = git('rev-parse', 'HEAD');
  committed = true;
  cleanTree();
  execute('git', ['push', 'origin', `${commit}:refs/heads/main`]);
  await waitForCI(commit);
  existing = optionalRelease(tag);
  if (!existing) {
    execute('gh', ['release', 'create', tag, archive, '--repo', repo, '--target', commit,
      '--title', tag, '--notes-file', notesFile, '--latest'], { env: ghEnv });
  } else {
    if (!options.resume) throw new Error('A release with this tag appeared during validation; refusing to change it');
    if (existing.draft ? existing.target_commitish !== commit : tagCommit(tag) !== commit) {
      throw new Error('Existing release belongs to a different commit');
    }
    // Resume only fills a missing asset or finishes a draft; never overwrite a published archive.
    const asset = existing.assets.find((item) => item.name === archiveName);
    if (asset && (asset.state !== 'uploaded' || asset.digest !== `sha256:${digest}`)) {
      throw new Error('Existing asset differs from this archive; refusing to overwrite it');
    }
    if (!asset) execute('gh', ['release', 'upload', tag, archive, '--repo', repo], { env: ghEnv });
    if (existing.draft) execute('gh', ['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest'], { env: ghEnv });
  }
  const release = api(`repos/${repo}/releases/tags/${tag}`);
  const url = verifyPublishedRelease(release, tagCommit(tag), { version, commit, archiveName, digest });
  console.log(`\nPublished and verified: ${url}\nArchive: ${archive}\nSHA-256: ${digest}`);
}

main().catch((error) => {
  console.error(`\nRelease stopped: ${error.message}`);
  if (artifactDirectory) console.error(`Artifacts retained at: ${artifactDirectory}`);
  if (committed) console.error('After resolving the failure, retry with: pnpm release --resume');
  else console.error('No release was published. Review any version-file changes before retrying.');
  process.exitCode = 1;
});
