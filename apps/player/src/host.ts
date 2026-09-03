/**
 * index.html embeds play.html in a sandboxed iframe with a static `src`
 * attribute (see index.html / README.md). Because of that, the top-level
 * page's query string — e.g. `?debug`, which opts into the hotspot debug
 * overlay (see RoomSceneOptions.showHotspotDebug) — never reaches play.html
 * on its own: `location.search` inside the iframe reflects the iframe's own
 * URL, not the page the player actually navigated to.
 *
 * This is the one script index.html's CSP allows to run (`script-src
 * 'self'`, added just for this). It only forwards the current page's query
 * string onto the iframe's src; it doesn't otherwise touch play.html's
 * opaque-origin sandbox (see README.md's "The two pages" section).
 */
export function resolvePlayIframeSrc(currentSrc: string, search: string): string {
  if (!search) return currentSrc;
  const [path] = currentSrc.split("?");
  return `${path}${search}`;
}

const iframe = document.querySelector("iframe");
if (iframe) {
  iframe.src = resolvePlayIframeSrc(iframe.getAttribute("src") ?? "/play.html", location.search);
}
