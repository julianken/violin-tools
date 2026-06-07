# infra/ — Violin Tools hosting (Terraform)

Provisions the static-site hosting stack for Violin Tools on GCP and the keyless
CI/CD that publishes to it:

- a **GCS website bucket** (the artifact target),
- **Cloud CDN** over a backend bucket (with a per-object cache split),
- a **global external HTTPS load balancer** with a **Google-managed TLS cert**
  covering both `strings-solo.com` and `www.strings-solo.com`,
- a **URL map** with SPA fallback (unknown paths → `index.html`, 200) and a
  `www` → apex 301,
- **Workload Identity Federation** (keyless GitHub Actions → GCP) + a deploy
  service account.

The deploy pipeline is `.github/workflows/deploy.yml` (runs on push to `main`).

> **Status:** the Terraform is written and validates offline; it is **not yet
> applied**. Hosting goes live after the gated `terraform apply` + the Cloudflare
> DNS step below.

---

## One-time bootstrap — what is manual vs. Terraform-owned

This is **Path 2**: a small manual bootstrap, then Terraform creates the rest
(including WIF/SA — they are **not** pre-created).

### Manual (done once, out of band) — already complete

These cannot be Terraform-managed cleanly (the state backend can't store the
state of the bucket that holds it; project/billing/API enablement precede any
apply). They are **already done** for `strings-solo-prod`:

1. **Project + billing.** Project `strings-solo-prod` (number `48440654897`),
   billing linked.
2. **APIs enabled.** `compute`, `storage`, `iam`, `iamcredentials`, `sts`,
   `cloudresourcemanager`, `serviceusage`.
3. **Terraform state bucket.** `gs://strings-solo-prod-tfstate` (versioned, for
   rollback). `backend.tf` points at it with prefix `violin-tools/state`.

### Terraform-owned (created by `terraform apply`) — NOT manual

> **Supersession note (vs. issue #39 §3 item 10).** Issue #39's §3 item-10 prose
> described "creating the WIF pool / registering the provider / SA" as part of
> the *manual* bootstrap. **This repo takes Path 2: the WIF pool, the OIDC
> provider, the deploy service account, and all IAM are created by
> `terraform apply`** (`wif.tf`), not by hand. This wording supersedes that
> phrasing. No §4 acceptance criterion changes — the §4 ACs only require that
> `infra/wif.tf` *declares* the pool, provider, and SA, which it does.

- The website bucket + public-read IAM (`storage.tf`)
- The Cloud CDN backend bucket (`cdn.tf`)
- The global address, managed cert, HTTPS proxy, forwarding rules, HTTP→HTTPS
  redirect (`lb.tf`)
- The URL maps — SPA fallback + `www`→apex 301 (`urlmap.tf`)
- The WIF pool, OIDC provider, deploy SA, and IAM bindings (`wif.tf`)

---

## GitHub Actions repo variables (not secrets)

`deploy.yml` reads these as **Actions *variables*** (Settings → Secrets and
variables → Actions → *Variables*), **never committed secrets**. None is
sensitive — they are resource names/IDs, not credentials (auth is keyless WIF).

| Variable       | Value source                                    |
| -------------- | ----------------------------------------------- |
| `GCP_PROJECT`  | `strings-solo-prod` (set now)                   |
| `WIF_PROVIDER` | `terraform output -raw wif_provider` after apply |
| `DEPLOY_SA`    | `terraform output -raw deploy_sa_email` after apply |
| `GCS_BUCKET`   | `terraform output -raw website_bucket` after apply |
| `URL_MAP`      | `terraform output -raw url_map_name` after apply |

There are **no committed secrets and no service-account JSON key** anywhere —
CI authenticates via Workload Identity Federation (`wif.tf`).

---

## Validate offline (no creds, no spend)

Both run cold (the variable defaults in `variables.tf` supply every value), with
no GCP credentials and no state-backend connection:

```sh
cd infra
terraform fmt -check          # formatting gate
terraform init -backend=false # download providers WITHOUT touching remote state
terraform validate            # syntax + type check, non-interactive
```

`-backend=false` is required: `terraform validate` needs providers initialized,
but a cold checkout has no GCS-backend credentials. Do **not** run
`terraform plan`/`apply` for validation — those need real creds and touch live
infra.

For a real plan/apply, copy the example tfvars and supply the real values:

```sh
cp terraform.tfvars.example terraform.tfvars   # gitignored; real per-deploy values
terraform init                                  # connects to the GCS backend
terraform plan
terraform apply                                 # the gated, spend-incurring step
```

---

## DNS + managed-cert ordering (Cloudflare, gray-cloud)

Cloudflare (`strings-solo.com`, zone `c58ba2a0fd727ad08720af2261c34b3e`) is
registrar **and authoritative DNS**. The architecture is **apex-canonical,
DNS-only (gray-cloud)**:

1. `terraform apply` → read `terraform output -raw lb_ip`.
2. In Cloudflare, **before** creating records, confirm there is **no conflicting
   apex/`www` `A`/`AAAA`/`CNAME`** record.
3. Create, both **proxy status = DNS-only (gray-cloud)**:
   - `strings-solo.com` `A` → the LB IP (add `AAAA` only if an IPv6 LB address
     is later allocated),
   - `www.strings-solo.com` `A` → the **same** LB IP.
4. The `www`→apex **301 is a GCP URL-map host rule** (`urlmap.tf`), **not** a
   Cloudflare redirect rule.

**Why gray-cloud is load-bearing (not a preference):** a Google-managed cert only
provisions once its domains resolve **to the LB**. A proxied (orange-cloud)
record returns Cloudflare's anycast IP, so Google's validation never sees the LB
and the cert sticks in `FAILED_NOT_VISIBLE`. A Cloudflare redirect rule would
*require* an orange-cloud `www` record — incompatible with this stack — which is
exactly why the `www`→apex redirect lives in the GCP URL map instead.

**Ordering:** the cert (`lb.tf`) is created on apply but stays `PROVISIONING`
until the gray-cloud DNS records resolve to the LB IP — expected, not an error.
Liveness check once it flips `ACTIVE`:

```sh
curl -sI https://strings-solo.com          # 200 over valid TLS
curl -sI https://www.strings-solo.com      # 301 → https://strings-solo.com
```

### Terraform-state gap (intentional — do NOT "fix" with the cloudflare provider)

The Cloudflare DNS record(s) are created **out of band** (dashboard or a scoped,
short-lived `Zone:DNS:Edit` token for this zone only) and are therefore
**outside Terraform state**: `terraform plan` will not see them, detect drift on
them, or recreate them. **This is deliberate.** Managing one near-static apex
record via the `cloudflare` Terraform provider would require a long-lived
`CLOUDFLARE_API_TOKEN` in CI — a third standing secret to leak/rotate on a
public repo, cutting against the keyless / no-committed-secrets posture. A later
agent must **not** "close the gap" by adding the `cloudflare` provider, which
would silently reintroduce that CI token. If DNS-in-IaC ever becomes worth it,
that is a deliberate decision with its own plan review, not a drive-by fix.

---

## SPA cache split (how `index.html` stays fresh)

`cdn.tf` sets `cache_mode = USE_ORIGIN_HEADERS`, so Cloud CDN honors each
object's own `Cache-Control`. `deploy.yml` syncs in two passes with **distinct**
headers:

- hashed Vite assets (`assets/*`) → `public, max-age=31536000, immutable`
- `index.html` (and the rest) → `no-cache`

so a deploy is visible immediately and never pins users to a stale shell. The
deploy job also `invalidate-cdn-cache --path=/index.html` as a belt-and-suspenders
flush. The SPA **200 fallback** itself comes from the bucket's
`website.not_found_page = "index.html"` (`storage.tf`).
