# infra/ — hosting & deploy (Cloudflare -> public GCS bucket, ~$0/mo)

Infrastructure-as-code for deploying the Violin Tools static site. The design is
deliberately **lean**: Cloudflare's free edge fronts a public-read GCS bucket.
There is **no GCP load balancer, no Cloud CDN, no managed cert** — those would
add ~$18/mo of standing cost for a low-traffic static SPA, so they are deferred
(an LB can be added later, in front of the same bucket, if metrics warrant it).

## Architecture

```
            HTTPS                         HTTPS (anonymous, public-read)
  user  ───────────►  Cloudflare edge  ─────────────────────────────►  GCS bucket
                      (TLS + CDN +                                       strings-solo-prod-web
                       Worker: index/SPA/www->apex)                      (static site + assets)
```

- **TLS + CDN + DNS:** Cloudflare (free). A small **Worker** (`cloudflare/worker.js`)
  serves the bucket: maps `/` to `index.html`, does SPA fallback (404 -> `index.html`
  with 200), redirects `www` -> apex with a 301, and sets cache headers (immutable
  for `assets/`, `no-cache` for the entry). TLS is end-to-end: the Worker fetches the
  origin over `https://storage.googleapis.com/...`.
- **Origin:** a single **public-read** GCS bucket (`storage.tf`). Public-read is
  intentional — a public static site with no secrets, no user data, no backend
  (see repo `SECURITY.md` / `README.md`). `public_access_prevention=enforced` is
  deliberately NOT set, since that would block the `allUsers` read grant.
- **CI deploy:** keyless **Workload Identity Federation** (`wif.tf`) — GitHub
  Actions on `main` mints a short-lived GCP token; **no SA JSON key** exists.
  The deploy SA holds **only** `roles/storage.admin` (it rsyncs the build to the
  bucket — there is no compute to manage).

## What Terraform owns vs. not

| Owned by Terraform (`infra/*.tf`)                          | NOT in Terraform                                  |
| ---------------------------------------------------------- | ------------------------------------------------- |
| Public-read GCS website bucket (SPA index fallback)        | Cloudflare Worker, DNS, TLS (Phase C, via CF MCP) |
| WIF pool + GitHub OIDC provider + keyless deploy SA        | The GCS **state** bucket (Phase A, manual)        |
| `roles/storage.admin` on the deploy SA (no compute role)   | Any GCP load balancer / Cloud CDN (deferred)      |

## Manual bootstrap (Phase A — already DONE, do not recreate)

- Project `strings-solo-prod` (number `48440654897`); billing linked; required APIs enabled.
- Versioned **state bucket** `gs://strings-solo-prod-tfstate` (the `backend.tf` target).
- Domain `strings-solo.com` on Cloudflare (zone `c58ba2a0fd727ad08720af2261c34b3e`).
- GitHub Actions repo variable `GCP_PROJECT` set.

WIF + the deploy SA are **created by this Terraform** (no import) — Path 2.

## Validate offline (no cloud, no credentials)

The variables all have safe defaults, so validation needs no `terraform.tfvars`:

```sh
cd infra
terraform fmt -check -recursive
terraform init -backend=false   # downloads providers, skips the GCS backend
terraform validate
```

`-backend=false` is what lets `validate` run on a cold checkout with no GCP
auth. **Do not** `terraform plan`/`apply` here — apply is the orchestrator's
Phase C.

## Apply (Phase C — orchestrator only)

1. `terraform init` (connects to the GCS state backend) then `terraform apply`.
2. Read the outputs and set them as GitHub Actions **repo variables**:
   - `WIF_PROVIDER`        <- `terraform output -raw wif_provider`
   - `DEPLOY_SA`           <- `terraform output -raw deploy_sa_email`
   - `GCS_WEBSITE_BUCKET`  <- `terraform output -raw website_bucket`
   - (`GCP_PROJECT` is already set from Phase A.)
3. Deploy the **Cloudflare Worker** (`cloudflare/worker.js`) via the Cloudflare
   API / MCP, bound to a Workers custom domain / route for `strings-solo.com`
   and `www.strings-solo.com`, and create the **proxied (orange-cloud)** DNS for
   apex + `www`. This is done out-of-band so **no `CLOUDFLARE_API_TOKEN` is
   committed or held in CI**.

After that, every push to `main` runs `.github/workflows/deploy.yml`:
checkout -> pnpm + Node 22 -> WIF auth -> `pnpm build` -> two-pass
`gcloud storage rsync` to the bucket (immutable default for hashed assets,
`no-cache` rewritten onto `index.html`).

## Cache invalidation

There is no Cloud CDN to invalidate. Cloudflare honours the `no-cache` on
`index.html`, so a deploy goes live without a purge. An explicit Cloudflare
cache purge would require a CF API token — **deliberately omitted** for the
no-secrets posture. If one is ever needed, do it as a manual / MCP step; do not
add a long-lived CF token to CI.

## Files

| File                       | Purpose                                                      |
| -------------------------- | ----------------------------------------------------------- |
| `backend.tf`               | GCS remote state (`strings-solo-prod-tfstate`)              |
| `providers.tf`             | `hashicorp/google ~> 6.0`, `required_version >= 1.5`        |
| `variables.tf`             | `project_id` / `region` / `bucket_name` / `domain` (defaults)|
| `terraform.tfvars.example` | Override template (live `terraform.tfvars` is gitignored)   |
| `storage.tf`               | Public-read website bucket (SPA index fallback)            |
| `wif.tf`                   | WIF pool + OIDC provider + keyless deploy SA (storage-only) |
| `outputs.tf`               | `wif_provider`, `deploy_sa_email`, `website_bucket`        |
| `cloudflare/worker.js`     | Edge Worker (index/SPA/www->apex) — deployed via MCP        |
| `.terraform.lock.hcl`      | Provider lock (committed for reproducible CI resolution)   |
