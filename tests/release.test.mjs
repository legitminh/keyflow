import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextVersion, parseArguments, releaseNotes, updateReadme, verifyPublishedRelease } from '../scripts/release-utils.mjs';

test('release versions advance monotonically and reject invalid/stale versions', () => {
  assert.equal(nextVersion('0.3.0'), '0.3.1');
  assert.equal(nextVersion('0.3.9', 'minor'), '0.4.0');
  assert.equal(nextVersion('1.9.9', 'major'), '2.0.0');
  assert.equal(nextVersion('0.3.0', '0.4.2'), '0.4.2');
  for (const version of ['0.3.0', '0.2.9', 'v0.4.0', '0.04.0', '0.4.0-beta.1', '9007199254740992.0.0']) {
    assert.throws(() => nextVersion('0.3.0', version));
  }
});
test('release arguments keep dry-run and resume explicit and reject ambiguous inputs', () => {
  assert.equal(parseArguments([]).bump, 'patch');
  assert.deepEqual(parseArguments(['minor', '--dry-run', '--notes-file', 'notes.md']), {
    bump: 'minor', dryRun: true, resume: false, help: false, notesFile: 'notes.md'
  });
  assert.equal(parseArguments(['--resume']).resume, true);
  for (const args of [['--resume', 'minor'], ['--force'], ['patch', 'minor'], ['--notes-file'], ['--notes-file', '--dry-run']]) {
    assert.throws(() => parseArguments(args));
  }
});
test('versioned install links change without rewriting unrelated historical text', () => {
  const readme = 'History: 0.3.0\nreleases/download/v0.3.0/legitminh-keyflow-0.3.0.tgz\n./vendor/legitminh-keyflow-0.3.0.tgz';
  const updated = updateReadme(readme, '0.3.0', '0.4.0');
  assert.ok(updated.startsWith('History: 0.3.0\n'));
  assert.ok(updated.includes('releases/download/v0.4.0/legitminh-keyflow-0.4.0.tgz'));
  assert.ok(updated.includes('./vendor/legitminh-keyflow-0.4.0.tgz'));
  assert.throws(() => updateReadme('Missing installation links', '0.3.0', '0.4.0'));
});
test('release notes use commit messages or supplied changes and always include installation and validation', () => {
  const notes = releaseNotes({ version: '0.4.0', changes: ['Add TextBox'], previousTag: 'v0.3.0' });
  assert.ok(notes.includes('- Add TextBox'));
  assert.ok(notes.includes('v0.3.0...v0.4.0'));
  assert.ok(notes.includes('legitminh-keyflow-0.4.0.tgz'));
  assert.ok(notes.includes('GitHub CI passed'));
  assert.ok(releaseNotes({ version: '0.4.0', changes: ['Unused'], body: 'Reviewed notes' }).includes('Reviewed notes'));
});
test('published release verification requires the exact commit and uploaded archive digest', () => {
  const expected = { version: '0.4.0', commit: 'abc', archiveName: 'legitminh-keyflow-0.4.0.tgz', digest: '123' };
  const release = { tag_name: 'v0.4.0', draft: false, prerelease: false, html_url: 'release-url',
    assets: [{ name: expected.archiveName, state: 'uploaded', digest: 'sha256:123' }] };
  assert.equal(verifyPublishedRelease(release, 'abc', expected), 'release-url');
  for (const invalid of [
    { ...release, draft: true }, { ...release, prerelease: true }, { ...release, tag_name: 'v0.3.0' },
    { ...release, assets: [] }, { ...release, assets: [{ ...release.assets[0], digest: 'sha256:wrong' }] },
    { ...release, assets: [{ ...release.assets[0], state: 'new' }] }
  ]) assert.throws(() => verifyPublishedRelease(invalid, 'abc', expected));
  assert.throws(() => verifyPublishedRelease(release, 'different-commit', expected));
});
