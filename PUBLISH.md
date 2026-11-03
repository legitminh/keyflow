```sh
cd /Users/minh/Projects/cs/keyflow
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm test
pnpm test:browser
pnpm pack
```
## Create new version
First, update package.json version.
```sh
git add .
git commit -m "Release 0.1.2"
git tag v0.1.2
git push origin main v0.1.2
```