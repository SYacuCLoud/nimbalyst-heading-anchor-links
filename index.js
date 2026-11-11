// Nimbalyst opens console page links in-app but drops the #hash (parseConsoleLink only reads pathname).
// Headings already carry slug ids (built-in heading-anchor extension), so we just scroll after the page opens.
const ORIGIN = 'https://console.nimbalyst.com';
const LOCAL_PAGE = /^\/app\/page\/([^/]+)$/;
const POLL_MS = 100;
const TIMEOUT_MS = 5000;

let timer = null;

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `https://console.nimbalyst.com/app/page/<id>#slug` → { pageId, slug }, anything else → null. */
export function parseAnchorLink(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const match = url.origin === ORIGIN && LOCAL_PAGE.exec(url.pathname);
  if (!match || url.hash.length < 2) return null;
  return { pageId: decode(match[1]), slug: decode(url.hash.slice(1)) };
}

// Local wiki pages open as file tabs (.tab-editor[data-file-path]) that carry no page id,
// so the target is "the tab that becomes visible after the click".
// shortcut: a full-URL link to the page you are already on scrolls only after SAME_PAGE_MS; resolve id → file if that matters.
const SAME_PAGE_MS = 1000;

function findHeading(slug, sourceTab, allowSource) {
  // Background tabs stay in the DOM, so take the one on screen.
  return [...document.querySelectorAll(`[id="${CSS.escape(slug)}"]`)].find((el) => {
    const tab = el.closest('.tab-editor');
    return tab && (allowSource || tab !== sourceTab) && el.checkVisibility();
  }) ?? null;
}

function scrollWhenReady({ slug }, sourceTab) {
  clearInterval(timer);
  const start = Date.now();
  // The page opens asynchronously and its body loads later, so poll until the heading shows up.
  timer = setInterval(() => {
    const elapsed = Date.now() - start;
    const heading = findHeading(slug, sourceTab, elapsed > SAME_PAGE_MS);
    if (heading) heading.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (heading || elapsed > TIMEOUT_MS) {
      clearInterval(timer);
      timer = null;
    }
  }, POLL_MS);
}

// The app's Back only walks page history, so a same-page #anchor jump leaves nothing to go back to.
// We keep our own stack of those jumps and let Back undo them first.
// shortcut: Ctrl+[ is an Electron menu accelerator we cannot intercept, so only the Back button and mouse back button undo jumps; no Forward.
const jumps = []; // { filePath, scroller, top }

function visibleBackButton() {
  return [...document.querySelectorAll('[data-testid="pages-tab-back"]')].find((b) => b.checkVisibility()) ?? null;
}

function scrollParent(el) {
  for (let e = el.parentElement; e; e = e.parentElement) {
    if (e.scrollHeight > e.clientHeight && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) return e;
  }
  return null;
}

function rememberJump(anchor) {
  const id = decode(anchor.getAttribute('href').slice(1));
  // Mirror the app's same-page handler: it only scrolls when the target exists.
  if (!(anchor.closest('.editor-scroller') ?? document).querySelector(`#${CSS.escape(id)}`)) return;
  const scroller = scrollParent(anchor);
  const filePath = anchor.closest('.tab-editor')?.dataset.filePath;
  if (!scroller || !filePath) return;
  jumps.push({ filePath, scroller, top: scroller.scrollTop });
  // The app disables Back when the tab has no page history; React leaves the DOM attribute alone until that prop changes.
  visibleBackButton()?.removeAttribute('disabled');
}

/** Undo the latest same-page jump if it belongs to the page on screen; otherwise let the app go back. */
function undoJump(event) {
  while (jumps.length && !jumps.at(-1).scroller.isConnected) jumps.pop();
  const jump = jumps.at(-1);
  const current = [...document.querySelectorAll('.collab-mode .tab-editor[data-file-path]')].find((t) => t.checkVisibility());
  if (!jump || jump.filePath !== current?.dataset.filePath) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  jumps.pop();
  jump.scroller.scrollTo({ top: jump.top, behavior: 'smooth' });
}

function onClick(event) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest('[data-testid="pages-tab-back"]')) return undoJump(event);
  const anchor = event.target.closest('a[href]');
  // Same condition the app uses before opening a console link in-app instead of the browser.
  if (!anchor || !anchor.closest('.collab-mode .tab-content')) return;
  const href = anchor.getAttribute('href');
  if (href.startsWith('#') && href.length > 1) return rememberJump(anchor);
  const link = parseAnchorLink(href);
  if (link) scrollWhenReady(link, anchor.closest('.tab-editor'));
}

function onAuxClick(event) {
  if (event.button === 3) undoJump(event); // mouse back button
}

export function activate() {
  // Window capture runs before the app's handlers (document capture for links, document auxclick, React root for buttons).
  window.addEventListener('click', onClick, true);
  window.addEventListener('auxclick', onAuxClick, true);
}

export function deactivate() {
  window.removeEventListener('click', onClick, true);
  window.removeEventListener('auxclick', onAuxClick, true);
  clearInterval(timer);
  timer = null;
  jumps.length = 0;
}
