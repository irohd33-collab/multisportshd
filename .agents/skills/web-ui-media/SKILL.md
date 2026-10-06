---
name: web-ui-media
description: Design film, anime, music and media discovery interfaces with art direction, readable imagery and usable catalogs.
---
# Media interfaces: make the content worth exploring

Use with `web-ui-design` for public entertainment/catalog pages, media details, libraries and discovery. Use `web-ui-admin` for their management screens. This pack does not authorize scraping protected content, inventing catalog data or offering playback that the product does not provide.

## Choose a composition that belongs to this product

| Product character | Strong starting composition | Avoid |
|---|---|---|
| Cinema / immersive discovery | One wide feature, protected copy region, expressive title, curated rails below | Busy image behind long copy and five equal outlined actions |
| Anime community / personal library | Distinctive masthead, spotlight or editorial pick, compact watch progress, expressive but readable accents | Every section becoming the same poster grid; fake user/activity counts |
| Film archive / serious catalog | Light or neutral editorial introduction, filters/search, orderly poster grid, meaningful metadata | A giant entertainment hero hiding the catalog people came to search |
| Music / artist publication | Strong portrait or album composition, track/artist typography, meaningful listening action | A movie poster template with labels changed |

The default is not dark purple. Choose color, type and density from the brief and imagery. Examples below use a warm amber accent on deep olive; a cream-and-red archive or bright illustrated community can be equally intentional.

### Why a weak hero remains weak after adding effects

A large image alone is not art direction. If a poster repeats the background, the title is barely larger than the description, a paragraph crosses faces, and “detail / watching / watched / later / favorite” all have the same white outline, nothing guides the eye. Fix the composition first:

- Choose one media asset for the feature: landscape art, a deliberate still, or an intentional poster composition. Do not stretch a narrow cover into a blurry background.
- Reserve a calm text region. Either put copy on a solid adjacent surface or use a gradient that becomes sufficiently opaque **behind the entire copy**, including buttons. A uniform translucent black wash often leaves the image noisy and the copy weak.
- Let the title be expressive: on desktop 48–80px is a useful starting range; on phone 32–48px. Evaluate long and short titles. Strong scale need not mean uppercase.
- Keep the summary brief and in the UI's language. Metadata supports a decision: format/year/age/duration or subtitle/episode details, whichever is genuinely available.
- One primary discovery/play/resume action; one quiet list/save action. Move fine-grained watch-state choices into the detail screen or a clearly named menu.
- Show the next section deliberately. Do not stretch a 16:9 billboard to fill every desktop height unless that experience is requested.

If playback is unavailable, “Animeyi keşfet” or “Detayları gör” is truthful. “Hemen izle” is not an acceptable placeholder for an unrelated detail dialog.

## Original working feature recipe

This React + plain CSS component contains actual selection and local list-toggle behavior. It needs no carousel library or icon dependency. Import the CSS in the host app. Supply genuine image URLs and working detail routes from the app's data. The list state below is in memory; connect it to the product's persistence/account model when persistent lists are required. Never claim it is synchronized across devices from this sample alone.

```tsx
import { useId, useState } from "react";

export type FeaturedTitle = {
  id: string;
  title: string;
  summary: string;
  image: string;
  imagePosition?: string;
  href: string;
  metadata: string[];
};

export function MediaFeature({ titles }: { titles: FeaturedTitle[] }) {
  const headingId = useId();
  const [selected, setSelected] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  if (!titles.length) return <section className="media-empty">
    <h2>Yeni hikâyeler yolda</h2>
    <p>Seçki yayınlandığında burada keşfedebilirsin.</p>
  </section>;
  const active = titles[Math.min(selected, titles.length - 1)]!;
  const isSaved = saved.has(active.id);
  const toggleSaved = () => {
    setSaved(previous => {
      const next = new Set(previous);
      if (next.has(active.id)) next.delete(active.id); else next.add(active.id);
      return next;
    });
    setNotice(`${active.title} ${isSaved ? "listenden çıkarıldı" : "listene eklendi"}.`);
  };
  return <section className="media-feature" aria-labelledby={headingId}>
    <div className="media-feature__stage">
      <div className="media-feature__art" aria-hidden="true">
        <img key={active.image} src={active.image} alt="" width={1600} height={900}
          fetchPriority="high" style={{ objectPosition: active.imagePosition ?? "65% center" }} />
      </div>
      <div className="media-feature__copy">
        <p className="media-feature__eyebrow">Bu haftanın seçkisi</p>
        <h1 id={headingId}>{active.title}</h1>
        <ul className="media-feature__meta" aria-label="Yapım bilgileri">
          {active.metadata.map(value => <li key={value}>{value}</li>)}
        </ul>
        <p className="media-feature__summary">{active.summary}</p>
        <div className="media-feature__actions">
          <a className="media-action media-action--primary" href={active.href}>
            Yapımı keşfet <span aria-hidden="true">↗</span>
          </a>
          <button className="media-action media-action--quiet" type="button"
            aria-pressed={isSaved} onClick={toggleSaved}>
            <span aria-hidden="true">{isSaved ? "✓" : "+"}</span>
            {isSaved ? "Listemde" : "Listeme ekle"}
          </button>
        </div>
        <span className="media-sr-only" role="status">{notice}</span>
      </div>
    </div>
    {titles.length > 1 && <div className="media-feature__selector"
      role="group" aria-label="Öne çıkan yapımı seç">
      {titles.map((title, index) => <button key={title.id} type="button"
        aria-pressed={active.id === title.id} onClick={() => setSelected(index)}>
        <span className="media-feature__number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>{title.title}</span>
      </button>)}
    </div>}
  </section>;
}
```

```css
.media-feature {
  --media-bg: #111a16; --media-text: #f7f5ed; --media-muted: #c1c7bf;
  --media-accent: #f3c875; --media-accent-text: #241a09; --media-line: #405047;
  color: var(--media-text); background: var(--media-bg); font-family: ui-sans-serif, system-ui, sans-serif;
  border-radius: 1.5rem; overflow: clip;
}
.media-feature *, .media-empty * { box-sizing: border-box; }
.media-feature__stage { position: relative; isolation: isolate; min-height: 32rem; }
.media-feature__art { position: absolute; inset: 0 0 0 34%; z-index: -1; }
.media-feature__art img { width: 100%; height: 100%; display: block; object-fit: cover; }
.media-feature__art::after { content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, #111a16 0%, #111a16ed 16%, #111a167a 42%, #111a1600 72%),
    linear-gradient(0deg, #111a16c9, #111a1600 40%); }
.media-feature__copy { position: relative; width: min(60%, 43rem); padding: clamp(2rem, 4.5vw, 4.5rem); }
.media-feature__eyebrow { margin: 0 0 2rem; color: var(--media-accent);
  font-size: .75rem; font-weight: 650; letter-spacing: .16em; text-transform: uppercase; }
.media-feature h1 { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(2.75rem, 5.2vw, 5rem); font-weight: 750; letter-spacing: -.045em;
  line-height: 1.04; text-wrap: balance; overflow-wrap: anywhere; }
.media-feature__meta { display: flex; flex-wrap: wrap; gap: .5rem 1rem;
  list-style: none; padding: 0; margin: 1.5rem 0 0; color: var(--media-muted); font-size: .85rem; }
.media-feature__summary { max-width: 42ch; margin: 1.5rem 0 2rem;
  color: var(--media-muted); font-size: 1rem; line-height: 1.75; }
.media-feature__actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.media-action { display: inline-flex; justify-content: center; align-items: center; gap: .75rem;
  padding: .9rem 1.15rem; min-height: 3rem; border: 1px solid transparent; border-radius: .65rem;
  font: inherit; font-weight: 650; text-decoration: none; cursor: pointer;
  transition: background-color 160ms, color 160ms; }
.media-action--primary { background: var(--media-accent); color: var(--media-accent-text); }
.media-action--primary:hover { background: #ffdb96; }
.media-action--quiet { background: #111a16e6; color: var(--media-text); border-color: #748178; }
.media-action--quiet:hover { background: #29382f; }
.media-feature__selector { display: flex; overflow-x: auto; padding: 0 2rem;
  gap: 1.5rem; border-top: 1px solid var(--media-line); scrollbar-width: thin; }
.media-feature__selector button { position: relative; display: flex; align-items: center;
  gap: .65rem; flex: 1 0 9rem; padding: 1.1rem .25rem; text-align: left;
  min-height: 3.5rem; color: var(--media-muted); background: transparent;
  border: 0; font: inherit; font-size: .8rem; cursor: pointer; }
.media-feature__selector button[aria-pressed="true"] { color: var(--media-text); }
.media-feature__selector button[aria-pressed="true"]::before { content: ""; position: absolute;
  height: 3px; top: 0; left: 0; right: 0; background: var(--media-accent); }
.media-feature__number { color: var(--media-accent); font-variant-numeric: tabular-nums; }
.media-feature :focus-visible { outline: 3px solid var(--media-accent); outline-offset: -4px; }
.media-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.media-empty { padding: 3rem 1.5rem; border: 1px dashed currentColor; border-radius: 1rem; }
@media (max-width: 52rem) {
  .media-feature__stage { min-height: 0; display: flex; flex-direction: column; }
  .media-feature__art { position: relative; inset: auto; aspect-ratio: 16 / 10; z-index: 0; }
  .media-feature__art::after { background: linear-gradient(0deg, #111a16, #111a1600 55%); }
  .media-feature__copy { width: 100%; max-width: none; padding: .25rem 1.5rem 1.75rem; }
  .media-feature__eyebrow { margin-bottom: 1rem; }
  .media-feature h1 { font-size: clamp(2rem, 7vw, 3.25rem); }
  .media-feature__summary { max-width: 52ch; margin-block: 1rem 1.5rem; }
  .media-feature__selector { padding-inline: 1.25rem; gap: 1rem; }
}
@media (max-width: 25rem) {
  .media-feature__actions { flex-direction: column; }
  .media-action { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .media-action { transition: none; } }
```

This is a starting composition, not a mandate to copy every label/shape. The feature's image, title, summary and actions all update together. Only the homepage feature is an `h1`; adapt the level if this component appears beneath an existing page heading. The selector is a group of ordinary buttons with a pressed state, so it does not pretend to implement the extra keyboard semantics of ARIA tabs.

### Adapt the recipe, don't patch around mismatched assets

At 1440px inspect whether the image's important subject survives the crop and the right half has a focal point. On tablet, if copy gets narrow or covers the subject, switch to the stacked composition sooner. On phone the artwork and copy become distinct regions; don't shrink the desktop paragraph over the same image. Adjust `imagePosition` per asset when needed. If the artwork is uniformly detailed with no quiet region, choose the solid split layout instead of making a stronger and stronger overlay.

A second direction can be a **light archive**: ivory page, near-black display type, red or blue accent, modest side-by-side feature, strong search/filter toolbar, orderly grid. In that variant the feature's text belongs on a light surface; do not merely invert the dark recipe's colors while keeping its opaque gradients.

## Catalog and poster anatomy

Use a limited hierarchy on each card: image → title → one quiet metadata row. A 2:3 poster ratio is a useful convention for film/anime; use square art for albums or creators, 16:9 for scenes/episodes. Respect the content type. Avoid thick bright borders around every cover. Give hover/focus a restrained lift, image scale or accent; reserve icons/badges for useful meaning.

Poster titles need predictable wrapping. Two lines followed by metadata is usually calmer than arbitrary truncation mid-first-line. Full title remains available through the accessible link name and detail page, not only a hover tooltip. Put a separate favorite button alongside the link, not inside another button/link.

Original catalog layout recipe (use in the matching markup; no plugin required):

```css
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
  gap: 1.75rem 1rem; list-style: none; margin: 0; padding: 0; }
.poster-card { min-width: 0; }
.poster-card > a { display: block; color: inherit; text-decoration: none; }
.poster-card img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover;
  display: block; border-radius: .65rem; background: #272f2a; }
.poster-card h3 { margin: .75rem 0 .3rem; font-size: .95rem; line-height: 1.4;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.poster-card p { margin: 0; color: var(--muted, #b4bcb5); font-size: .8rem; }
@media (max-width: 30rem) {
  .poster-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.25rem .75rem; }
}
```

For a short curated rail, CSS horizontal overflow/scroll-snap plus actual previous/next buttons can suffice. The horizontal region must be obvious and contained; the body must not overflow. For a richer carousel use an existing component or Embla through the project's established UI library. Don't put the entire catalog in a single endless horizontal rail or autoplay content by default. If autoplay is truly required, provide pause, stop while interacting/focused and honor reduced motion.

## Flows that make this a product

- **Discovery → detail:** title/image links open real content-specific routes. Detail has a clear title, appropriate synopsis, credits/facts and the supported primary action. Preserve back navigation and search/filter state.
- **Search and filters:** query changes results; genre/type/year controls work together; show result count and clear-all; empty results explain how to recover. Use the existing router/query state where available. Do not show filters that only change their own color.
- **Personal library:** watching/watched/later are coherent states, not unrelated buttons that can all be active. Save changes need pending/error/retry handling when remote. “Continue watching” requires actual progress; don't invent it to fill the layout.
- **Episodes/playback if requested:** visible selected season/episode, valid player state, loading/error/subtitles as applicable. A mock screen must not claim licensed playable media or a working player when absent.
- **Async data:** skeletons preserve poster proportions; failed assets have intentional fallback; API failure is distinct from an empty catalog. Don't remove all useful content while a minor filter refresh runs.

## Library choices and version boundaries

Inspect installed dependencies first. React/CSS above works without installing a design library. Use the application's existing router for details/search; changing routers to make this recipe fit is unnecessary.

For new React work, the [React Router declarative guide](https://reactrouter.com/start/declarative/installation) shows current setup. If the existing project uses a different major/package import, use its matching documentation rather than mixing examples. For carousels, [shadcn's current carousel](https://ui.shadcn.com/docs/components/base/carousel) composes Embla; use the matching primitive base already chosen by the app. A film site does not need a carousel dependency merely to draw a grid.

For intentional coordinated motion, follow [Motion React](https://motion.dev/docs/react) and [reduced-motion guidance](https://motion.dev/docs/react-accessibility). Keep content available immediately; avoid long intro animations, parallax that impairs reading, and a hidden page waiting for staggered card entrances. Native CSS transitions are enough for most card/CTA states. These references were checked 2026-09-22; verify APIs against the installed major before adding code.

## Visual and functional review

Do not ask only “Does it render?” A page with no exceptions can still fail this pack. Use focused Cloud `browser_test` passes, or the native session's available browser/preview tools, and inspect the actual screenshot:

1. Desktop feature: what draws attention first; is title/primary CTA unmistakable; can all copy be read on its real image; is the crop deliberate; are there too many competing controls?
2. Phone and tablet: is media/copy reorganized; does a long title fit; do buttons and nav have room; is horizontal scrolling limited to intended rails?
3. Catalog: consistent poster crop, rhythm, legible titles, localized metadata, loaded images; neither excessive borders nor arbitrary empty space.
4. Interactions: choose another feature and verify every associated field; toggle list; navigate to correct detail; search/filter to known and empty results; use keyboard focus.

Example question under the platform's size limit: “Evaluate this anime homepage's composition: title scale, quiet text region, image crop, primary versus secondary action and poster rhythm. List the three strongest visible defects with locations. Do not assume a working flow from a screenshot.”

Record concrete failures and revise them, then inspect again. Compare against the chosen brief, not an automatic dark/purple template. Report real evidence and any missing backend/media capability honestly.
