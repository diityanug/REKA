# REKA Gemini Proxy (Cloudflare Workers)

Serverless proxy for REKA's receipt and e-Statement scanners so `GEMINI_API_KEY` stays strictly server-side and is never embedded inside shared CBT APKs or store builds.

## Security Controls Built In

1. **Server-side secret isolation**: `GEMINI_API_KEY` is stored as a Cloudflare Worker secret and sent via the `x-goog-api-key` header (never in URL query strings or mobile app bundles).
2. **Locked prompts, schemas & model cascade**: The proxy ignores arbitrary prompts or model names from clients and enforces receipt/e-Statement JSON schemas server-side.
3. **Strict allowlists & payload caps**: Only `POST` JSON requests with allowlisted MIME types (`image/*`, `application/pdf`, `text/csv`, `text/plain`) and bounded sizes are accepted (`413` on oversize payloads).
4. **Per-IP rate limiting**: Configured via Cloudflare's free-tier `ratelimits` binding in `wrangler.jsonc` (`15` scan requests per `60` seconds per IP).
5. **Optional CBT access token (`PROXY_ACCESS_TOKEN`)**: Verified with SHA-256 constant-time comparison against the `X-REKA-Proxy-Token` header to block automated scanners hitting your `.workers.dev` URL directly.
6. **Zero-logging**: Financial receipt images, bank statements, and extracted transaction JSON are never logged (`observability.enabled = false`).

---

## Option A — Deploy via Wrangler CLI (Recommended)

From `workers/gemini-proxy/`:

```bash
# 1. Authenticate with Cloudflare (opens browser once)
npx wrangler login

# 2. Store your Gemini API key securely as an encrypted Worker secret
npm run secret:gemini

# 3. (Optional) Add an app token header for CBT bot filtering
npm run secret:token

# 4. Deploy to Cloudflare Workers Free
npm run deploy
```

Wrangler will print your live HTTPS URL, e.g.:
`https://reka-gemini-proxy.<your-subdomain>.workers.dev`

> **Verify health**: Opening `https://reka-gemini-proxy.<your-subdomain>.workers.dev/health` in a browser returns `{"ok":true,"service":"reka-gemini-proxy"}`.

---

## Option B — Deploy via Cloudflare Dashboard (No CLI)

1. Open **Cloudflare Dashboard -> Compute (Workers) -> Workers & Pages -> Create -> Create Worker**.
2. Open **Edit Code** and paste the entire contents of `src/index.js`, then click **Deploy**.
3. Go to **Worker -> Settings -> Variables and Secrets -> Add**:
   - Type: **Secret**
   - Name: `GEMINI_API_KEY` -> Value: your Gemini API key -> **Save**.
   - *(Optional)* Secret `PROXY_ACCESS_TOKEN` -> random long string.
   - *(Optional)* Text `GEMINI_MODELS` -> comma-separated model names to override defaults (`gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.5-flash`).

---

## Connect REKA (Expo / EAS Build)

In **Expo Dev Dashboard -> Environment Variables** (and/or your local untracked `.env`):

1. **Delete `EXPO_PUBLIC_GEMINI_API_KEY`** from `preview` and `production` environments so no Gemini key is bundled into shared APKs.
2. Add **`EXPO_PUBLIC_GEMINI_PROXY_URL`** = `https://reka-gemini-proxy.<your-subdomain>.workers.dev` (Visibility: `Plain text` or `Sensitive` — URLs shipped in the app are public endpoints).
3. *(Optional, only if you set `PROXY_ACCESS_TOKEN` above)* Add **`EXPO_PUBLIC_GEMINI_PROXY_TOKEN`** with the matching token value.

Then build a fresh APK (`eas build --platform android --profile preview`) and distribute it for CBT.

> **Before Play Store / App Store production release**: Upgrade the token check in `verifyProxyToken` to verify **Google Play Integrity API** (Android) and **Apple App Attest** (iOS) tokens so only authentic signed app binaries can invoke the proxy.
