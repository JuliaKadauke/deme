// index.html's sandboxed iframe has a fixed embed point — it never inherits
// this page's own query string just by being an iframe — so a `?debug`
// typed into index.html's URL has to be forwarded onto play.html's src by
// hand, or play.html's `location.search` (see app.ts's
// resolveShowHotspotDebug) never sees it.
const iframe = document.querySelector("iframe");
if (iframe) {
  iframe.src = `/play.html${location.search}`;
}
