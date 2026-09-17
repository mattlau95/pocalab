# Deploying pocalab

pocalab is a static Vite build hosted on Vercel. There is no backend, no environment variables, and no deploy script: Vercel's GitHub integration builds and deploys on every push.

## How a change reaches pocalab.app

| Push to | Result |
|---|---|
| `main` | Production deploy, live on pocalab.app within about a minute |
| Any other branch | Preview deploy at a unique `pocalab-<hash>-matthew-lau-s-projects.vercel.app` URL, linked from the PR |

So the release process is:

1. Work on a branch and open a PR against `main`.
2. Wait for CI to pass, and check the PR's Vercel preview (the link is in the PR's checks and deployments).
3. Merge the PR. The merge commit on `main` deploys to production.
4. Confirm the live site serves the new build (see below).

Don't push straight to `main` unless you mean to ship: it goes live immediately.

## Vercel project settings

| Setting | Value |
|---|---|
| Project | `matthew-lau-s-projects/pocalab` |
| Framework preset | Vite |
| Build command | `vite build` |
| Output directory | `dist` |
| Node.js | 24.x |
| Domains | pocalab.app, www.pocalab.app, pocalab.com, www.pocalab.com, pocalab.vercel.app |

The Vercel build command is `vite build`, not `npm run build`, so **Vercel does not type-check**. GitHub Actions CI (`.github/workflows/ci.yml`) covers this: every PR and every push to `main` runs lint, type-check and build, unit tests and browser tests. Merge only when CI is green.

## Checking what is live

```bash
vercel inspect pocalab.app --scope matthew-lau-s-projects
```

This shows which deployment the domain points at and when it was created. To map it to a commit, compare against the GitHub deployments list:

```bash
gh api repos/mattlau95/pocalab/deployments --jq '.[] | "\(.environment) \(.sha[0:7]) \(.created_at)"'
```

The `Last-Modified` header on pocalab.app is a CDN timestamp and does not mean a new build was deployed.

After a deploy, spot-check the changes on the live site. For changes to `index.html` meta tags, paste the URL into a chat app to confirm the social preview (`/og-image.png`) renders.

## Rolling back

Point production back at the previous deployment without a new build:

```bash
vercel ls pocalab --scope matthew-lau-s-projects --prod   # find the previous deployment URL
vercel rollback <deployment-url> --scope matthew-lau-s-projects
```

Then revert the bad commit on `main`. Otherwise the next push to `main` redeploys it.
