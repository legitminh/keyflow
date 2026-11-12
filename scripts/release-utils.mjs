const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function versionParts(version) {
  if (!stable.test(version)) throw new Error(`Expected a stable version (X.Y.Z), received: ${version}`);
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version components must be safe integers');
  return parts;
}

export function nextVersion(current, requested = 'patch') {
  const previous = versionParts(current);
  let next;
  if (['major', 'minor', 'patch'].includes(requested)) {
    const index = ['major', 'minor', 'patch'].indexOf(requested);
    next = [...previous];
    next[index]++;
    next.fill(0, index + 1);
  } else next = versionParts(requested);
  const firstDifference = next.findIndex((part, index) => part !== previous[index]);
  if (firstDifference < 0 || next[firstDifference] < previous[firstDifference]) {
    throw new Error(`Release version must be newer than ${current}`);
  }
  const result = next.join('.');
  versionParts(result);
  return result;
}

export function parseArguments(args) {
  const options = { bump: 'patch', dryRun: false, resume: false, help: false, notesFile: undefined };
  let positional = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--resume') options.resume = true;
    else if (arg === '--notes-file') {
      const path = args[++index];
      if (!path || path.startsWith('--') || options.notesFile) throw new Error('Provide one path after --notes-file');
      options.notesFile = path;
    } else if (!arg.startsWith('-') && !positional) {
      if (!['major', 'minor', 'patch'].includes(arg)) versionParts(arg);
      options.bump = arg;
      positional = true;
    } else throw new Error(`Unknown or duplicate argument: ${arg}`);
  }
  if (options.resume && positional) throw new Error('--resume cannot be combined with a new version or bump');
  return options;
}

export function updateReadme(readme, previous, next) {
  const download = `releases/download/v${previous}/`;
  const archive = `legitminh-keyflow-${previous}.tgz`;
  if (!readme.includes(download) || !readme.includes(archive)) throw new Error('README has no current release installation links');
  return readme.replaceAll(download, `releases/download/v${next}/`)
    .replaceAll(archive, `legitminh-keyflow-${next}.tgz`);
}

export function releaseNotes({ version, changes, body, previousTag }) {
  const tag = `v${version}`;
  const details = body?.trim() || changes.map((change) => `- ${change}`).join('\n');
  return `## Changes\n\n${details || '- Package update.'}\n\n` +
    `## Install\n\n\`\`\`sh\npnpm add https://github.com/legitminh/keyflow/releases/download/${tag}/legitminh-keyflow-${version}.tgz\n\`\`\`\n\n` +
    `## Validation\n\nType checking, package build, unit tests, browser tests, archive checks, and GitHub CI passed for this release commit.\n\n` +
    `[Documentation](https://github.com/legitminh/keyflow/tree/${tag}/docs)` +
    (previousTag ? ` · [Full changelog](https://github.com/legitminh/keyflow/compare/${previousTag}...${tag})` : '') + '\n';
}

export function verifyPublishedRelease(release, tagCommit, expected) {
  if (release.tag_name !== `v${expected.version}` || release.draft || release.prerelease) {
    throw new Error('Release is not the expected published stable version');
  }
  if (tagCommit !== expected.commit) throw new Error('Published tag does not point to the validated release commit');
  const assets = release.assets.filter((asset) => asset.name === expected.archiveName);
  if (assets.length !== 1 || assets[0].state !== 'uploaded' || assets[0].digest !== `sha256:${expected.digest}`) {
    throw new Error('Published archive is missing, incomplete, or has a different SHA-256 digest');
  }
  return release.html_url;
}
