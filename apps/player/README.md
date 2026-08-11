# @deme/player

The browser shell that hosts a deme game. Structured as two pages, not one,
specifically for the iframe + CSP isolation the scripting sandbox's threat
model calls for (see [`docs/architecture.md`](../../docs/architecture.md#scripting)):
unreviewed, community-authored Lua runs inside `@deme/engine`'s sandboxed
wasmoon VM (instruction budget, call-depth limit, memory ceiling — see
[`packages/engine/src/lua-sandbox.ts`](../../packages/engine/src/lua-sandbox.ts)),
and this app is the defense-in-depth layer around _that_: if a VM-level
sandbox escape ever happened anyway, it should still not be able to reach
this page's DOM, cookies, or another game's saved data.

## The two pages

- **`index.html`** — the host shell. Runs no game code and has no
  `script-src` in its CSP at all; its only job is embedding `play.html` in
  an `<iframe sandbox="allow-scripts">`.
- **`play.html`** — where the game actually renders: PixiJS, `GameSession`,
  and (once wired in) the wasmoon VM. Its CSP allows `'wasm-unsafe-eval'`
  (WebAssembly compilation only — not general `eval`) alongside same-origin
  script/style/image/connect/worker sources.

The `sandbox="allow-scripts"` attribute on the iframe **deliberately omits
`allow-same-origin`**. That omission is what makes the isolation real: a
sandboxed iframe without `allow-same-origin` runs its content under a
unique, opaque origin, distinct both from `index.html`'s origin and from
every other game's `play.html` origin. An opaque origin can't read or write
another origin's DOM, cookies, or `localStorage` — so even a full JS-level
compromise inside `play.html` has nothing to reach out to. Adding
`allow-same-origin` back would defeat this entirely; don't.

## HTTP-header CSP (`public/_headers`)

Two directives — `frame-ancestors` and `X-Frame-Options` — are not
permitted in a `<meta http-equiv="Content-Security-Policy">` tag (the CSP
spec ignores them there); they only take effect as real HTTP response
headers. [`public/_headers`](./public/_headers) sets them using the
Netlify/Cloudflare Pages convention (Vite copies `public/` into `dist/`
verbatim, and both platforms read a `_headers` file from the site root at
that path). Deploying elsewhere (a different static host, a CDN, an nginx
config) needs the equivalent header configuration in that platform's own
format — copy the two header lines in `_headers`.

## wasmoon's `.wasm` load

`src/app.ts` imports wasmoon's `glue.wasm` as a Vite asset
(`import wasmUrl from "wasmoon/dist/glue.wasm?url"`) and passes it to
`@deme/engine`'s `setLuaWasmUri` before booting a `GameSession`. This isn't
optional wiring: `wasmoon`'s `LuaFactory` defaults an unset wasm URI to
`https://unpkg.com/wasmoon@<version>/dist/glue.wasm` whenever it detects a
browser (`window`/`self`), which `play.html`'s `connect-src 'self'` CSP
blocks outright — wasmoon expects bundler consumers to resolve and supply
the URI themselves rather than rely on that default. See
[`setLuaWasmUri`'s doc comment](../../packages/engine/src/lua-sandbox.ts)
for the full explanation.

Separately: the opaque origin `play.html`'s sandboxed iframe runs under
makes every subresource fetch it makes — its own JS/CSS bundle, that
`.wasm` file, content images — cross-origin _with respect to this same
server_, even though the URL is same-path (an opaque origin can never be
"same-origin" with anything). Vite already marks the module script/
stylesheet tags `crossorigin`, so those go out as real CORS requests;
[`public/_headers`](./public/_headers) answers all of them with
`Access-Control-Allow-Origin: *` — without it, nothing here would load at
all once actually served (not just wasmoon), CORS-blocked rather than
sandbox-blocked.
