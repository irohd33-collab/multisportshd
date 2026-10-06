---
name: web-ui-editorial-corporate
description: Design editorial, corporate, service, SaaS marketing and portfolio sites with distinct composition and credible content.
---
# Editorial, corporate and portfolio interfaces

Use with `web-ui-design`. These sites share typography/content craft but not one page template. Choose the branch matching the visitor's intent. Operational application screens belong to `web-ui-admin`; selling products belongs to `web-ui-storefront`; poster-led entertainment catalogs belong to `web-ui-media`.

## Select the right structure

| Intent | Useful page spine | Visual direction |
|---|---|---|
| Read an independent publication | Masthead → lead story → deliberately edited secondary stories → topic feed → subscription if real | Distinct display/body roles, intentional columns, restrained rules, strong photography/illustration |
| Understand a company/service | Clear promise → evidence of capability → service/process → relevant case study → contact | Brand-specific type/color, credible imagery, useful detail instead of adjective-heavy claims |
| Evaluate a SaaS product | Concrete use case → real product view → useful workflow → proof/integration details → supported CTA | Product-led composition; actual UI examples instead of decorative dashboard-shaped rectangles |
| Hire a person/studio | Name/point of view → selected work → contribution/process → direct contact | Art direction belongs to the work; varied image scale and clear authorship, not a badge cloud |

Don't automatically add testimonials, customer logos, pricing, a newsletter, team portraits or a contact form just because templates have them. Include them when requested and supported. The page should answer who it is for, what is offered, why it is credible and what to do next.

## Editorial craft

A magazine needs editorial judgment: one lead story, meaningful secondary choices, a clear reading order and differences in visual weight. A grid where every card has the same size, border, badge and stock icon feels like a component catalog.

Choose a type pairing from available/licensed fonts or reliable fallbacks. A characterful serif display plus restrained sans metadata is one viable direction; a bold sans publication is another. Limit families and weights. Longform body often works at 18–21px with 1.6–1.8 leading and a 58–72ch measure. Larger size alone does not fix excessive line length. Keep paragraphs, subheads, pull quotes and figures on a deliberate rhythm.

Use category, date and author when real. Do not fabricate author identities or imply a draft was published. Separate editorial labels from navigation. An article title should be an actual descriptive headline, not “Discover a world of possibilities.” Keep the site language coherent and format dates locally.

### Original light editorial recipe with working topic filtering

The following React + CSS example takes content from the host app. It has one lead article, a secondary desk list and a topic-filtered feed. It is intentionally unlike an entertainment hero or admin dashboard. Supply genuine article routes/images and valid ISO dates. Empty topic arrays are allowed. Import the CSS normally.

```tsx
import { useId, useState } from "react";

export type Article = {
  id: string; title: string; excerpt: string; topic: string;
  href: string; image: string; imageAlt: string; publishedAt: string;
};
const dateLabel = (value: string) => new Intl.DateTimeFormat("tr-TR", {
  day: "numeric", month: "long", year: "numeric"
}).format(new Date(value));

export function EditorialIndex({ lead, articles }: { lead: Article; articles: Article[] }) {
  const feedId = useId();
  const [topic, setTopic] = useState<string | null>(null);
  const topics = [...new Set(articles.map(article => article.topic))];
  const visible = topic === null ? articles : articles.filter(article => article.topic === topic);
  return <div className="editorial">
    <header className="editorial__intro">
      <p className="editorial__kicker">Fikirler, hikâyeler, yeni bakışlar</p>
      <h1>Biraz dur.<br /><em>Başka türlü bak.</em></h1>
      <p>Gündelik hayatın içinden, üzerinde düşünmeye değer hikâyeler.</p>
    </header>
    <div className="editorial__front">
      <article className="editorial__lead">
        <a href={lead.href} aria-labelledby={`lead-${feedId}`}>
          <img src={lead.image} alt={lead.imageAlt} width={1200} height={800} fetchPriority="high" />
          <span className="editorial__kicker">{lead.topic}</span>
          <h2 id={`lead-${feedId}`}>{lead.title}</h2>
        </a>
        <p>{lead.excerpt}</p>
        <time dateTime={lead.publishedAt}>{dateLabel(lead.publishedAt)}</time>
      </article>
      <aside className="editorial__desk" aria-label="Editörün seçtikleri">
        <h2>Okuma masası</h2>
        {articles.slice(0, 3).map((article, index) => <article key={article.id}>
          <span className="editorial__number" aria-hidden="true">0{index + 1}</span>
          <div><p className="editorial__kicker">{article.topic}</p>
            <h3><a href={article.href}>{article.title}</a></h3>
          </div>
        </article>)}
      </aside>
    </div>
    <section className="editorial__feed" aria-labelledby={feedId}>
      <div className="editorial__feed-heading"><h2 id={feedId}>Hikâyelerin arasında</h2>
        <p role="status">{visible.length} yazı</p>
      </div>
      <div className="editorial__topics" role="group" aria-label="Konuya göre filtrele">
        <button type="button" aria-pressed={topic === null} onClick={() => setTopic(null)}>Tümü</button>
        {topics.map(value => <button key={value} type="button" aria-pressed={topic === value}
          onClick={() => setTopic(value)}>{value}</button>)}
      </div>
      {visible.length ? <div className="editorial__grid">
        {visible.map(article => <article key={article.id}>
          <a href={article.href} aria-labelledby={`article-${feedId}-${article.id}`}>
            <img src={article.image} alt={article.imageAlt} width={720} height={480} loading="lazy" />
            <p className="editorial__kicker">{article.topic}</p>
            <h3 id={`article-${feedId}-${article.id}`}>{article.title}</h3>
          </a>
          <time dateTime={article.publishedAt}>{dateLabel(article.publishedAt)}</time>
        </article>)}
      </div> : <p className="editorial__empty">Bu bölümde henüz yazı yok. Diğer konulara göz atabilirsin.</p>}
    </section>
  </div>;
}
```

```css
.editorial {
  --paper: #f4f0e7; --ink: #282821; --secondary: #615e54; --rule: #ccc6b8; --editorial-accent: #9e3e26;
  background: var(--paper); color: var(--ink); padding: clamp(1.25rem, 5vw, 4rem);
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.editorial * { box-sizing: border-box; }
.editorial a { color: inherit; text-decoration: none; }
.editorial a:hover h2, .editorial a:hover h3, .editorial h3 a:hover { text-decoration: underline;
  text-decoration-thickness: 1px; text-underline-offset: .2em; }
.editorial :focus-visible { outline: 3px solid var(--editorial-accent); outline-offset: 5px; }
.editorial__intro, .editorial__front, .editorial__feed { max-width: 76rem; margin-inline: auto; }
.editorial__intro { padding-block: 1rem 3rem; border-bottom: 1px solid var(--ink); }
.editorial__kicker { display: block; margin: 0 0 .8rem; color: var(--editorial-accent);
  font-size: .75rem; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; }
.editorial__intro h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 400;
  font-size: clamp(2.8rem, 7vw, 6.25rem); line-height: 1.02; letter-spacing: -.045em; margin: 1rem 0 1.5rem; }
.editorial__intro h1 em { color: var(--editorial-accent); }
.editorial__intro > p:last-child { max-width: 42ch; color: var(--secondary); line-height: 1.7; }
.editorial__front { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(15rem, 1fr);
  gap: clamp(1.5rem, 4vw, 4rem); padding-block: 2.5rem 3.5rem; }
.editorial__lead img { display: block; width: 100%; height: auto; aspect-ratio: 3 / 2;
  object-fit: cover; margin-bottom: 1.4rem; }
.editorial__lead h2 { font-family: Georgia, "Times New Roman", serif; font-weight: 400;
  font-size: clamp(1.8rem, 3vw, 3rem); line-height: 1.15; letter-spacing: -.025em; margin: 0; text-wrap: balance; }
.editorial__lead > p { max-width: 56ch; color: var(--secondary); line-height: 1.7; }
.editorial time { color: var(--secondary); font-size: .8rem; }
.editorial__desk { border-left: 1px solid var(--rule); padding-left: clamp(1.25rem, 3vw, 2.5rem); }
.editorial__desk > h2 { font-size: .85rem; margin: 0 0 1.5rem; }
.editorial__desk article { display: grid; grid-template-columns: 2rem minmax(0, 1fr);
  gap: .75rem; border-top: 1px solid var(--rule); padding-block: 1.4rem; }
.editorial__number { font-family: Georgia, serif; color: var(--editorial-accent); font-size: 1.1rem; }
.editorial__desk h3 { font-family: Georgia, serif; font-size: 1.35rem; font-weight: 400;
  line-height: 1.3; margin: 0; overflow-wrap: anywhere; }
.editorial__feed { border-top: 1px solid var(--ink); padding-top: 1.5rem; }
.editorial__feed-heading { display: flex; align-items: baseline; justify-content: space-between;
  flex-wrap: wrap; gap: .75rem; }
.editorial__feed-heading h2 { margin: 0; font-size: 1.5rem; letter-spacing: -.035em; }
.editorial__feed-heading p { margin: 0; color: var(--secondary); font-size: .85rem; }
.editorial__topics { display: flex; gap: .5rem; flex-wrap: wrap; margin-block: 1.5rem 2rem; }
.editorial__topics button { border: 1px solid #918c7e; border-radius: 999px; padding: .65rem 1rem;
  min-height: 2.75rem; font: inherit; font-size: .85rem; background: transparent; color: var(--ink); cursor: pointer; }
.editorial__topics button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.editorial__topics button:hover { box-shadow: inset 0 0 0 1px currentColor; }
.editorial__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2rem 1.5rem; }
.editorial__grid img { width: 100%; height: auto; aspect-ratio: 3 / 2; object-fit: cover;
  display: block; margin-bottom: 1rem; }
.editorial__grid h3 { margin: 0 0 1rem; font-size: 1.2rem; line-height: 1.4; letter-spacing: -.02em; }
.editorial__empty { padding-block: 2rem; color: var(--secondary); }
@media (max-width: 48rem) {
  .editorial__front { grid-template-columns: 1fr; }
  .editorial__desk { border-left: 0; border-top: 1px solid var(--rule); padding: 1.5rem 0 0; }
  .editorial__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 30rem) {
  .editorial__intro { padding-bottom: 2rem; }
  .editorial__grid { grid-template-columns: 1fr; gap: 2rem; }
}
```

Replace the sample publication voice with the actual brief. The visual contrast comes from typography, image scale, column proportions and quiet rules, not a card shadow on every story. On mobile the reading order is lead → desk → filtered feed, not three shrunken newspaper columns. If the project has very few articles, remove the redundant desk rather than repeating the same content everywhere.

## Corporate and SaaS: evidence before decoration

Write the opening around a concrete customer/use case and outcome the business can support. A small eyebrow may identify the audience; the heading explains the offer; a short paragraph adds specificity. Pair it with an authentic product view, actual project photograph or useful process illustration. Do not invent a generic gradient orb when a real screenshot would explain the product.

Use a case study to show capability: context → work performed → supported result. Outcomes can be qualitative when numbers aren't available. Avoid invented percentage uplifts and unnamed “trusted by thousands” claims. A useful process diagram can be built in HTML/SVG; it need not be a fake analytics chart.

### Original service/case-study component

This is a different composition from the editorial recipe: a direct proposition, quiet contact link, then a large real project image beside concise evidence. Props supply all claims and destinations. Contact must go to an actual page/address; don't add a submit button with no delivery mechanism.

```tsx
export function ServiceCase({ audience, headline, summary, contactHref, project }: {
  audience: string; headline: string; summary: string; contactHref: string;
  project: { name: string; category: string; image: string; imageAlt: string;
    href: string; facts: { label: string; value: string }[] };
}) {
  return <div className="service-site">
    <header className="service-intro">
      <p className="service-eyebrow">{audience}</p>
      <h1>{headline}</h1>
      <div className="service-intro__bottom"><p>{summary}</p>
        <a className="service-cta" href={contactHref}>Birlikte çalışalım <span aria-hidden="true">↗</span></a>
      </div>
    </header>
    <section className="service-case" aria-label="Seçili çalışma">
      <a className="service-case__image" href={project.href} aria-label={`${project.name} çalışmasını incele`}>
        <img src={project.image} alt={project.imageAlt} width={1400} height={1000} />
      </a>
      <div className="service-case__notes"><p className="service-eyebrow">{project.category}</p>
        <h2><a href={project.href}>{project.name}</a></h2>
        <dl>{project.facts.map(fact => <div key={fact.label}>
          <dt>{fact.label}</dt><dd>{fact.value}</dd>
        </div>)}</dl>
        <a className="service-text-link" href={project.href}>Çalışmayı incele <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  </div>;
}
```

```css
.service-site { --service-ink: #18272a; --service-muted: #526365; --service-line: #ced9d7;
  --service-accent: #155f55; color: var(--service-ink); background: #f8fbf9;
  padding: clamp(1.25rem, 5vw, 4rem); font-family: ui-sans-serif, system-ui, sans-serif; }
.service-site * { box-sizing: border-box; }
.service-intro, .service-case { width: min(100%, 78rem); margin-inline: auto; }
.service-eyebrow { color: var(--service-accent); font-size: .78rem; font-weight: 650; letter-spacing: .1em; }
.service-intro { padding-block: 1rem 4rem; }
.service-intro h1 { max-width: 17ch; margin: 1.5rem 0 2rem; font-size: clamp(2.5rem, 6vw, 5.75rem);
  font-weight: 600; line-height: 1.05; letter-spacing: -.055em; text-wrap: balance; overflow-wrap: anywhere; }
.service-intro__bottom { display: flex; gap: 2rem; justify-content: space-between; align-items: flex-end; }
.service-intro__bottom p { margin: 0; max-width: 47ch; color: var(--service-muted); line-height: 1.7; }
.service-cta { display: inline-flex; align-items: center; justify-content: space-between; gap: 2rem;
  min-height: 3.25rem; padding: 1rem 1.25rem; color: #fff; background: var(--service-accent);
  text-decoration: none; border-radius: .35rem; white-space: nowrap; }
.service-cta:hover { background: #10493f; }
.service-case { display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(14rem, 1fr);
  gap: clamp(1.5rem, 4vw, 3.5rem); border-top: 1px solid var(--service-line); padding-block: 2rem; }
.service-case__image img { display: block; width: 100%; height: auto; aspect-ratio: 7 / 5;
  object-fit: cover; background: #e1eae5; }
.service-case h2 { font-size: clamp(1.7rem, 2.5vw, 2.5rem); letter-spacing: -.035em;
  line-height: 1.15; margin: 1rem 0 1.5rem; }
.service-case h2 a { color: inherit; text-decoration: none; }
.service-case dl { margin: 0 0 2rem; }
.service-case dl > div { border-top: 1px solid var(--service-line); padding-block: .9rem; }
.service-case dt { color: var(--service-muted); font-size: .8rem; margin-bottom: .4rem; }
.service-case dd { margin: 0; line-height: 1.5; }
.service-text-link { color: var(--service-accent); text-underline-offset: .3em; display: inline-block;
  min-height: 2.75rem; padding-block: .75rem; }
.service-site :focus-visible { outline: 3px solid var(--service-accent); outline-offset: 5px; }
@media (max-width: 48rem) {
  .service-intro__bottom { flex-direction: column; align-items: flex-start; }
  .service-case { grid-template-columns: 1fr; }
  .service-intro { padding-bottom: 2.5rem; }
}
```

For a **SaaS** variant, the case image can be a real product screen within a restrained browser/device frame; its adjacent facts should describe meaningful workflow capabilities. Keep the screenshot legible at the rendered size. Don't shrink a complicated dashboard until it becomes visual texture and call it product proof.

For a **portfolio**, make the selected work the identity: large project imagery, concise role/scope, intentional ordering, a distinct project detail story and direct contact. Vary scale only when it communicates priority. A carousel hiding most work is rarely a substitute for curation. Respect the user's actual contributions and ownership; don't claim all pictured work as theirs without source material.

## Content and interaction details

- Use actual destinations and keyboard-operable navigation. In an article, contents links target real section IDs with suitable scroll margin beneath a sticky header.
- On article detail use semantic `<article>`, logical headings, real author/date when known, meaningful figure captions and responsive media. Keep share/copy actions honest and provide visible success/failure feedback.
- Topic filters and search must change results and indicate active/empty state. For deep-linkable archives preserve the query in the existing router/URL, including browser back behavior.
- A contact form needs labels, accessible validation, sending/sent/error states and the actual agreed submission path. Frontend-only demos may validate locally but must not announce “Mesajınız gönderildi” without a completed send.
- A pricing table should reflect provided product terms; don't manufacture billing integration. A demo button should open a real demo or explicit scheduling/contact flow.
- Avoid distracting entrance sequences in reading content. A subtle state change or image reveal can fit a brand, but keep content immediately available and honor reduced motion.

## Implementation and assets

These recipes require only React and ordinary CSS. Do not replace an existing framework/router/font system just to follow them. For a static content project, native HTML/CSS may be the better fit. Use existing layout/components and load only the libraries needed for a specific behavior.

If using Tailwind v4 in Vite, follow its [official plugin setup](https://tailwindcss.com/docs/installation/using-vite) and [theme variables](https://tailwindcss.com/docs/theme); do not apply v3 configuration snippets to a v4 project. If using a component library for a dialog/contact form, use the installed primitive family. [shadcn Vite](https://ui.shadcn.com/docs/installation/vite) and [Radix primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) provide implementation foundations, not a substitute for art direction. For richer motion use the matching [Motion React guide](https://motion.dev/docs/react) and [reduced-motion guidance](https://motion.dev/docs/react-accessibility). Checked 2026-09-22; inspect the installed major before adding code.

Prefer supplied photographs, project screenshots and brand assets. Crop for each composition, preserve dimensions, provide appropriate alt text, load the lead promptly and defer below-fold media. A bookish serif and warm paper don't require fake grain textures or unreadable pale text. A corporate site doesn't require generic handshake photos. If suitable assets are unavailable, an intentional typographic layout with truthful content is stronger than invented evidence.

## Review questions with observable outcomes

Use the platform preview and focused Cloud `browser_test` calls, or the native session's available browser tools, on desktop and phone; add tablet where columns change. Follow `web-ui-design` and `web-design-guidelines` for implementation checks. Test both the first impression and a real reading/contact/filter journey. Load sibling skills through `activate_skill` when available; otherwise use their Cloud materialized files. Keep native skill bodies private.

- **Editorial:** is one story clearly leading, do typography and image scale establish a reading order, are excerpts readable, do the feed filters produce correct results, does the article maintain a comfortable measure?
- **Corporate/SaaS:** can a new visitor identify the audience, offer and real next action without interpreting slogans; does the product/case image explain something; are claims supported; does contact actually work?
- **Portfolio:** does the work dominate, is the creator's contribution clear, can the visitor move between real projects and contact, does mobile preserve the project's focal imagery?
- **All:** do long titles and localized dates fit, are image crops intentional, is there no page-level sideways overflow, and do keyboard focus/contrast/error states work?

Record the top three visible defects and change the composition/code that causes them. Re-test the affected screen. Do not “fix” every site into the same hero + three cards + testimonial pattern; the final page should reflect its own content and purpose.
