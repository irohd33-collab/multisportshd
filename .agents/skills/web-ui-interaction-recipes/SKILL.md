---
name: web-ui-interaction-recipes
description: Implement accessible navigation, search/filter state, image reveals and purposeful motion with small working React/CSS recipes and version-aware library choices.
---

# Interaction recipes

Read only the recipe that the page needs. This pack supplies behavior, not a universal visual template. Use the existing brand tokens, component system and router. For page composition, use `../web-ui-design/SKILL.md` when installed; product flow belongs in `../web-ui-storefront/SKILL.md`, content presentation in `../web-ui-media/SKILL.md`, and complex operational tables in `../web-ui-admin/SKILL.md`.

Inspect `package.json`, the lockfile and existing imports before adding or upgrading anything. In a server-rendered framework, isolate hook/browser-dependent examples in the appropriate client boundary. Do not migrate a functioning app to another component library just to use a snippet. A copied snippet is a starting point: run it with the installed versions, keyboard and real data.

## Match the tool to the interaction

| Need | First choice | Add a library when |
|---|---|---|
| Hover/focus/pressed feedback | CSS, semantic button/link | A coordinated gesture/state transition genuinely benefits from Motion |
| Small mobile navigation or simple modal | Native `dialog` with `showModal()` | Existing Radix/shadcn dialog already solves this, or a more complex overlay needs its established focus/stack behavior |
| Small local catalogue search | Controlled input + derived array | Remote data, pagination, caching or expensive search requires a data layer |
| Browse a short product/media rail | CSS overflow and scroll-snap | Precise drag/snap/controls justify Embla |
| Navigation between pages | Existing router + real URLs | There is no router and the requested app needs client-side routing |

Do not confuse a library's default styling with finished art direction. An outlined button, dialog and toast still need hierarchy, spacing, type scale and clear language. Keep one icon family and its consistent stroke/size; named imports from an already installed Lucide package are sufficient for ordinary interface icons.

## 1. Primary and secondary controls

Use a link for navigation and a button for a state-changing action. Put a real destination or handler on every active control. Within one decision area, primary means “the next meaningful action”; secondary should remain available without competing at the same visual weight. Disabled is a real unavailable state, not a substitute for an unimplemented feature.

```css
.action {
  --action-bg: #263f32; --action-fg: #fff; --action-line: #9ba79e;
  display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  min-height: 2.8rem; padding: .7rem 1.15rem; border-radius: .5rem;
  border: 1px solid transparent; font-family: inherit; font-size: .94rem; font-weight: 600; line-height: 1.2;
  text-decoration: none; cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.action--primary { background: var(--action-bg); color: var(--action-fg); }
.action--secondary { background: transparent; color: var(--action-bg); border-color: var(--action-line); }
.action--quiet { background: transparent; color: var(--action-bg); padding-inline: .5rem; }
.action:focus-visible { outline: 3px solid #8c6d29; outline-offset: 3px; }
.action:disabled { opacity: .5; cursor: not-allowed; }
@media (hover: hover) {
  .action--primary:not(:disabled):hover { background: #172b20; }
  .action--secondary:not(:disabled):hover { background: #edf1ec; border-color: var(--action-bg); }
}
.action:not(:disabled):active { transform: translateY(1px); }
@media (prefers-reduced-motion: reduce) { .action { transition: none; } .action:active { transform: none; } }
```

Replace these colors with the site's semantic tokens and check contrast against the actual surface. Text inside a primary button should not inherit a muted body color. A loading action should keep its width, expose `aria-busy`, prevent duplicate submission and resolve to success or an actionable error; do not simulate success with a timer when a network mutation failed.

## 2. Mobile navigation with native modal behavior

This complete small React navigation uses real links. Native `showModal()` provides modal focus/inert behavior; setting the `open` attribute alone is not equivalent. Escape and the visible close control work. A resize into desktop closes the dialog so it cannot leave the page blocked. Use the project's existing dialog component instead if one is established. [MDN `showModal`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal).

```jsx
import { useEffect, useId, useRef, useState } from "react";

export function ResponsiveNavigation({ items, brand, homeHref = "/" }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 760px)");
    const sync = () => { if (wide.matches) dialog.current?.close(); };
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);
  function show() {
    if (!dialog.current?.open) dialog.current?.showModal();
    setOpen(true);
  }
  function closed() {
    setOpen(false);
    if (!window.matchMedia("(min-width: 760px)").matches) trigger.current?.focus();
  }
  return <header className="nav-shell">
    <a className="nav-brand" href={homeHref}>{brand}</a>
    <nav className="nav-desktop" aria-label="Ana gezinme">
      {items.map(item => <a key={item.href} href={item.href}
        aria-current={item.current ? "page" : undefined}>{item.label}</a>)}
    </nav>
    <button ref={trigger} className="nav-toggle" type="button"
      aria-haspopup="dialog" aria-expanded={open} onClick={show}>Menü</button>
    <dialog ref={dialog} className="nav-dialog" aria-labelledby={titleId} onClose={closed}>
      <div className="nav-dialog-head">
        <h2 id={titleId}>Menü</h2>
        <button type="button" onClick={() => dialog.current?.close()}>Kapat</button>
      </div>
      <nav aria-label="Mobil gezinme">
        {items.map(item => <a key={item.href} href={item.href}
          aria-current={item.current ? "page" : undefined}
          onClick={() => dialog.current?.close()}>{item.label}</a>)}
      </nav>
    </dialog>
  </header>;
}
```

```css
.nav-shell { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem clamp(1rem, 4vw, 3rem); }
.nav-brand { font: 700 1.25rem/1.2 system-ui, sans-serif; color: inherit; text-decoration: none; }
.nav-desktop { display: flex; align-items: center; gap: 1.5rem; }
.nav-desktop a, .nav-dialog a { color: inherit; text-decoration: none; }
.nav-shell a[aria-current="page"] { text-decoration: underline; text-underline-offset: .3em; }
.nav-toggle { display: none; }
.nav-shell button { min-height: 2.75rem; padding: .6rem .8rem; font: inherit; cursor: pointer; }
.nav-dialog { box-sizing: border-box; margin: 0 0 0 auto; width: min(90vw, 24rem); max-width: 100%; height: 100dvh; max-height: 100dvh; border: 0; padding: 1.25rem; color: #20271f; background: #fafaf5; }
.nav-dialog::backdrop { background: rgb(12 21 15 / .5); }
.nav-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.nav-dialog-head h2 { font-size: 1.2rem; }
.nav-dialog nav { display: grid; gap: .5rem; margin-top: 2rem; }
.nav-dialog nav a { display: block; padding: .9rem .2rem; font-size: 1.4rem; }
.nav-shell :focus-visible { outline: 3px solid #8c6d29; outline-offset: 3px; }
html:has(.nav-dialog[open]) { overflow: hidden; }
@media (max-width: 759px) { .nav-desktop { display: none; } .nav-toggle { display: inline-flex; } }
```

Do not label ordinary site links as an ARIA `menu`/`menuitem` widget: that would imply different keyboard interactions. If adapting this into a form/filter dialog, give it a task-specific title, inline field errors and explicit apply/reset buttons. Avoid duplicate focus traps around a native dialog. Check Escape, Tab/Shift+Tab, return focus, resize and route navigation on the actual mobile browser target.

## 3. Image-loaded reveal with a visible failure state

An image should improve after loading, not hold the page hostage. Keep the text and layout present immediately. This original recipe adds a brief reveal only after the image is ready, handles cached loads and failures, and cancels stale callbacks on source changes. The wrapper keys the inner state by URL. `decode()` can reject, so it cannot be the only completion path. [MDN image decoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decode).

```jsx
import { useEffect, useRef, useState } from "react";

export function ImageReveal(props) { return <LoadedImage key={props.src} {...props} />; }
function LoadedImage({ src, alt, width, height, priority = false }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let disposed = false;
    const finish = async () => {
      try { await node.decode(); } catch { /* load/error state below remains authoritative */ }
      if (!disposed) { setReady(node.naturalWidth > 0); setFailed(node.naturalWidth === 0); }
    };
    const fail = () => { if (!disposed) setFailed(true); };
    node.addEventListener("load", finish);
    node.addEventListener("error", fail);
    if (node.complete) void finish();
    return () => { disposed = true; node.removeEventListener("load", finish); node.removeEventListener("error", fail); };
  }, [src]);
  return <figure className="loaded-media" style={{ aspectRatio: `${width} / ${height}` }}>
    {failed ? <div className="media-fallback"><span>{alt || "Görsel"}</span><small>Görsel yüklenemedi.</small></div>
      : <img ref={ref} src={src} alt={alt} width={width} height={height}
          loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"}
          data-ready={ready} />}
  </figure>;
}
```

```css
.loaded-media { margin: 0; overflow: hidden; background: #e8e8df; }
.loaded-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.loaded-media img[data-ready="true"] { animation: image-arrival 360ms ease-out both; }
.media-fallback { height: 100%; min-height: 8rem; display: grid; place-content: center; gap: .5rem; padding: 1rem; text-align: center; color: #4d5346; }
@keyframes image-arrival { from { opacity: .65; transform: scale(1.012); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .loaded-media img[data-ready="true"] { animation: none; } }
```

Use a regular eager image instead when a reveal would compromise an important first-content impression. Do not apply reveal wrappers to hundreds of thumbnails by default. Validate aspect ratio and alt text from actual assets, and make decorative art's alt empty. Server-rendered text remains usable if JavaScript is delayed.

## 4. Search, category and sort as real derived state

This local-list recipe has working input, selected category, sort, count, reset and empty state. It expects `items` shaped as `{id,title,category,href,priceMinor}`. Links must lead to actual detail routes. For a large remote catalogue, use server filters/pagination with loading/error states and request cancellation rather than downloading everything to imitate search.

```jsx
import { useId, useMemo, useState } from "react";

export function SearchableList({ items, locale = "tr-TR" }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const categories = [...new Set(items.map(item => item.category))];
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    return items.filter(item => (!category || item.category === category)
      && item.title.toLocaleLowerCase(locale).includes(needle))
      .sort((a, b) => sort === "price" ? a.priceMinor - b.priceMinor : collator.compare(a.title, b.title));
  }, [items, query, category, sort, locale]);
  function reset() { setQuery(""); setCategory(""); setSort("name"); }
  return <section aria-label="Katalog">
    <form className="filter-controls" onSubmit={event => event.preventDefault()}>
      <div className="filter-field"><label htmlFor={`${id}-q`}>Ürün ara</label>
        <input id={`${id}-q`} type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      <div className="filter-field"><label htmlFor={`${id}-category`}>Kategori</label>
        <select id={`${id}-category`} value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">Tümü</option>{categories.map(value => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="filter-field"><label htmlFor={`${id}-sort`}>Sırala</label>
        <select id={`${id}-sort`} value={sort} onChange={event => setSort(event.target.value)}>
          <option value="name">Ada göre</option><option value="price">Fiyat: artan</option>
        </select>
      </div>
      <button type="button" onClick={reset}>Sıfırla</button>
    </form>
    <p role="status">{results.length} sonuç</p>
    {results.length ? <ul>{results.map(item => <li key={item.id}><a href={item.href}>{item.title}</a></li>)}</ul>
      : <div><h2>Eşleşen ürün bulunamadı.</h2><p>Aramanı kısaltabilir veya filtreleri sıfırlayabilirsin.</p><button type="button" onClick={reset}>Filtreleri sıfırla</button></div>}
  </section>;
}
```

```css
.filter-controls { display: flex; flex-wrap: wrap; align-items: end; gap: .8rem; }
.filter-field { display: grid; gap: .4rem; font-size: .875rem; }
.filter-field:first-child { flex: 1 1 15rem; }
.filter-controls input, .filter-controls select, .filter-controls button { box-sizing: border-box; min-height: 2.8rem; max-width: 100%; padding: .6rem .75rem; border: 1px solid #bcc5bc; border-radius: .4rem; background: #fff; color: #233226; font: inherit; }
.filter-controls :focus-visible { outline: 3px solid #8c6d29; outline-offset: 2px; }
@media (max-width: 520px) { .filter-field { flex: 1 1 8rem; } .filter-field:first-child { flex-basis: 100%; } }
```

Do not hard-code a “24 products” label beside a result set that changes. Do not destroy input focus when rendering results. For shareable search, derive state from the existing router's search parameters and ensure browser Back restores it; a component-only recipe should not silently introduce a second navigation system.

## 5. Purposeful Motion usage

Use CSS for simple visual feedback. If the installed dependency is modern `motion`, import React APIs from `motion/react`; if an existing app uses `framer-motion`, follow its installed version instead of mixing both. The official current getting-started documentation uses `motion/react`; some older examples elsewhere still show the previous package. [Motion React guide](https://motion.dev/docs/react).

This small notice animates a real message change. It does not invent success or delay it. `useReducedMotion` selects an immediate presentation when reduction is requested or not yet determined. Prefer similarly small transitions for selection feedback before reaching for parallax or full-page entrance choreography. [Reduced-motion hook](https://motion.dev/docs/react-use-reduced-motion).

```jsx
import { motion, useReducedMotion } from "motion/react";

export function ActionNotice({ message }) {
  const reduce = useReducedMotion() !== false;
  return <div role="status" aria-live="polite" className="action-notice">
    {message && <motion.p key={message}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : .18 }}>
      {message}
    </motion.p>}
  </div>;
}
```

Give `.action-notice` enough minimum height for its expected content to avoid a button jumping after submission. For a broader Motion app, `MotionConfig reducedMotion="user"` can establish a shared policy; opacity/color animations may still run, so explicitly remove those as needed. [Motion accessibility](https://motion.dev/docs/react-accessibility). Keep critical content present on initial render; avoid making every section opacity zero until a scroll observer fires. A decorative cursor, endless marquee or stagger on every list item needs a real brief-driven purpose.

## 6. Carousel only when sequential browsing helps

A carousel is useful for alternate product angles or a secondary media rail. It is poor default navigation for essential pricing, forms or comparison data. Prefer a grid when seeing all choices matters. A basic rail can be CSS-only: `display:flex; overflow-x:auto; scroll-snap-type:x proximity`, with children `flex:0 0 min(75vw,20rem); scroll-snap-align:start`; preserve a scrollbar or a visible continuation cue.

**Version check:** on the source check dated 2026-09-22, Embla's default documentation was **v9.0.0-rc03**, while its stable branch was v8. The methods differ: v8 uses `scrollPrev`/`scrollNext`, whereas that v9 documentation uses `goToPrev`/`goToNext`. Do not paste a prerelease API into an installed v8 app or automatically upgrade it. [Stable v8 React setup](https://www.embla-carousel.com/docs/v8/get-started/react), [current documentation and version notice](https://www.embla-carousel.com/docs/get-started/react).

The following original recipe targets **Embla React v8**, if already chosen for the project. `slides` is an array of `{id,content}` with rendered image/text content. Give each rail a unique descriptive `label`. Explicit controls stay outside the drag surface; there is no autoplay. [v8 methods](https://www.embla-carousel.com/docs/v8/api/methods).

```jsx
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

export function ProductRail({ slides, label }) {
  const [viewport, api] = useEmblaCarousel({ align: "start", loop: false });
  const [enabled, setEnabled] = useState({ prev: false, next: false });
  useEffect(() => {
    if (!api) return;
    const update = () => setEnabled({ prev: api.canScrollPrev(), next: api.canScrollNext() });
    update(); api.on("select", update); api.on("reInit", update);
    return () => { api.off("select", update); api.off("reInit", update); };
  }, [api]);
  const jump = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return <section className="product-rail" aria-label={label} aria-roledescription="carousel">
    <div className="rail-viewport" ref={viewport}>
      <div className="rail-track">{slides.map((slide, index) =>
        <div className="rail-slide" key={slide.id} role="group" aria-roledescription="slide"
          aria-label={`${index + 1} / ${slides.length}`}>{slide.content}</div>)}</div>
    </div>
    <div className="rail-controls">
      <button type="button" disabled={!enabled.prev} onClick={() => api?.scrollPrev(jump())} aria-label={`${label}: önceki`}>←</button>
      <button type="button" disabled={!enabled.next} onClick={() => api?.scrollNext(jump())} aria-label={`${label}: sonraki`}>→</button>
    </div>
  </section>;
}
```

```css
.rail-viewport { overflow: hidden; }
.rail-track { display: flex; touch-action: pan-y pinch-zoom; gap: 1rem; }
.rail-slide { flex: 0 0 min(76vw, 20rem); min-width: 0; }
.rail-controls { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
.rail-controls button { width: 2.8rem; height: 2.8rem; border: 1px solid #9ba79e; border-radius: 50%; background: transparent; color: #263f32; cursor: pointer; }
.rail-controls button:disabled { opacity: .4; cursor: default; }
.rail-controls button:focus-visible { outline: 3px solid #8c6d29; outline-offset: 3px; }
```

This v8 recipe uses the documented `jump` boolean to make button navigation immediate for reduced motion. A static scrollable list is also a valid reduced-motion presentation. Ensure keyboard users can reach slide links and have their focused content brought into view. If autoplay is expressly wanted, provide pause/resume and stop on focus/interaction, respect reduced motion, and never rotate essential buying information. Do not claim “accessible carousel” merely because arrows have labels.

## Finish by exercising the behavior

Use the actual page, not only isolated snippet inspection: open/close navigation; tab both directions and press Escape; search with accented/localized text; select/reset filters; navigate Back; load an image from cache, simulate a failed asset and change its source; test the last carousel position and reduced motion. Check 360–390px phone, an intermediate/foldable width and desktop. Remove nonfunctional controls or implement them. If a screenshot looks polished but the interaction traps focus, forgets the selection or reports fake success, the work is unfinished.
