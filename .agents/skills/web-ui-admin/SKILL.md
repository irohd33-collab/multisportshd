---
name: web-ui-admin
description: Design admin panels, operational tables and analytics workspaces with clear hierarchy, useful density and working data states.
---

# Admin interfaces that help people make decisions

Use this pack for administration, internal tools, reporting, monitoring and work queues. First identify the user's recurring decision: what needs attention, what changed, or which record needs an action? Give that decision the strongest visual position. A public landing page, store or film catalog needs a different composition.

This is a self-contained recipe pack. Adapt its examples to the existing stack and product language. Do not copy its colors, sidebar or ticket domain into every application. Do not install its optional libraries as a bundle.

## Choose the page type before choosing components

| Job | Useful first viewport | What to de-emphasize |
| --- | --- | --- |
| Daily operational queue | Page title and scope, one primary action if relevant, queue/status counts, filters, actionable rows | Large decorative hero, unrelated revenue chart, four invented KPI cards |
| Analytics/reporting | Metric definition and date range, one dominant trend/comparison, supporting breakdown, drill-down records | Tiny charts in equal cards with no units or shared time context |
| CRUD administration | Resource title/count, search/filter, create action, readable table, real detail/edit path | Dashboard summary repeated above every list |
| Monitoring/incidents | Current system state and freshness, severity-ranked incidents, affected resources, activity timeline | Success-green decoration over stale data or missing telemetry |
| Settings/permissions | Grouped settings with explanation, current values, explicit save feedback, audit context where relevant | Tables for every form field or a chart with no decision value |

For example, a support queue can use a quiet light canvas and dense rows; a monitoring console may need a compact dark timeline; an executive report can have a spacious canvas with one large comparison. All are valid. Product context determines emphasis.

Draft a short composition before implementation: main question, dominant content, secondary content, primary action, and the smallest screen transformation. Build that representative viewport with realistic content before adding more pages.

## Hierarchy, density and visual rhythm

- **Page identity:** one clear heading, one sentence of useful scope, and a real action if one exists. A 24–32px heading often suits an admin workspace; use the surrounding type scale rather than a universal number.
- **Controls:** put search and common filters immediately above the records they affect. Keep advanced filters behind a labeled panel with an active count. A toolbar should not become three mostly empty rows on a phone.
- **Metrics:** show only measurements that explain a decision. A KPI needs a value, unit, time window and meaningful comparison. Say “8 overdue · of 41 open” rather than a floating “+24%”. Derive all cards from the same filtered dataset or clearly label their different scope.
- **Content weight:** make the subject/name primary, its identifier/company secondary, and status compact. Align numeric columns to the end with tabular figures. Use a consistent date format/time zone. Long identifiers may truncate with an accessible full value; task descriptions should wrap when necessary.
- **Surface hierarchy:** page canvas → main working surface → selected/hovered row. Thin separators and spacing can structure a dense table without a border around every cell. Reserve a strong fill for the principal action and a distinct selected state.
- **Status:** pair color with text or an icon. Red means an issue, amber means attention, and the brand accent means an action/selection; avoid making every status purple.
- **Density:** 44–56px rows with 14px text are a useful starting point for an operational desktop table; longer summaries and touch use require more room. Do not gain density by shrinking every label to 10px or by removing keyboard focus.
- **Icons:** use one coherent family. Add an icon when it improves recognition, not as a square badge above every number. Icon-only controls need an accessible name and an adequate hit area.
- **Scope:** label whether a total reflects all records, the filter, or the current page. If the API exposes 10 of 500 records, do not compute global totals from those 10.

A sidebar is navigation, not a second dashboard. Use a few meaningful groups, a visible active destination and restrained account/workspace controls. Do not add collapsed icon rails if labels are needed to understand unfamiliar sections.

## Pick libraries by need and installed version

Inspect package.json, the lockfile, existing component source and the router first. Match the package manager and framework already in use. Plain React/native controls/CSS can handle a small queue; adding a table library is useful for reusable column logic, complex selection, visibility, grouping or server-backed state.

| Need | Suitable choice | Integration rule |
| --- | --- | --- |
| Simple list with several filters | Native table, React state and ordinary CSS | Derive filtered → sorted → paginated rows from one state model; see the recipe below |
| Rich reusable data grid | TanStack Table | It supplies data/state behavior, not art direction or HTML styling |
| Dialog, sheet, menu, combobox | Existing accessible component system; shadcn if the project uses it | Inspect the local primitive base and component API before composing triggers |
| Report charts | Existing chart system or Recharts for React | Give each chart a measurable container, explicit units and a nonvisual data alternative |
| Remote caching/refetch | Existing data layer, optionally TanStack Query | Query key includes filters/sort/page; table and network state must agree |
| Very large rendered collections | Existing virtualization system after measurement | Pagination is often simpler; windowing must preserve keyboard and screen-reader usability |

Version check verified 2026-09-22: current [TanStack Table React docs](https://tanstack.com/table/latest/docs/framework/react/quick-start) use v9's useTable, tableFeatures and table.FlexRender. Existing v8 projects use useReactTable, getCoreRowModel and version-specific row-model factories; use the [v8 pagination](https://tanstack.com/table/v8/docs/guide/pagination) and [v8 sorting](https://tanstack.com/table/v8/docs/guide/sorting) docs. Do not combine remembered v8 imports with a newly installed v9 package or migrate a functioning table merely to follow this recipe.

Current [shadcn data-table documentation](https://ui.shadcn.com/docs/components/base/data-table) also targets v9. Shadcn offers primitive variants including [Base UI](https://ui.shadcn.com/docs/components/base/dialog) and [Radix UI](https://ui.shadcn.com/docs/components/radix/dialog); inspect components.json and local component imports. A trigger pattern supported by one base is not automatically supported by another. Add only the component needed and adapt its tokens; a component library does not decide page hierarchy.

Current [shadcn chart docs](https://ui.shadcn.com/docs/components/base/chart) use Recharts v3. Existing v2 code should follow its installed version until an intentional migration. Do not copy an old chart tooltip signature into newer types without checking. No library is a requirement for every admin screen.

### Optional TanStack v9 starting point

This is a version-specific state scaffold, not the table's markup or visual design. Define columns against these features and render semantic headers/cells with the resulting table. If installed v9 exports differ, consult the installed package's matching documentation before changing imports.

~~~tsx
import {
  createSortedRowModel, rowSortingFeature, sortFns,
  tableFeatures, useTable,
  type ColumnDef,
} from "@tanstack/react-table";

const queueFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

type Account = { id: string; company: string; openTickets: number };
const accountColumns: ColumnDef<typeof queueFeatures, Account>[] = [
  { accessorKey: "company", header: "Şirket" },
  { accessorKey: "openTickets", header: "Açık talep" },
];

function useAccountTable(data: Account[]) {
  return useTable({ features: queueFeatures, columns: accountColumns, data });
}
~~~

Use stable data/column definitions. A sortable header is a real button, with aria-sort on its th, not a click listener on a bare div. For server pagination, sort and filter the entire result on the server; do not sort only the currently loaded page and present it as globally sorted. Reset the page when a filter changes and pass the returned total/has-next signal. Version-specific pagination/state wiring belongs in the [matching table state guide](https://tanstack.com/table/latest/docs/framework/react/guide/table-state).

## Original operational queue recipe

The following dependency-free React component demonstrates real client-side search, status filtering, two sorts, pagination, no-results and loading/error states. It assumes the complete, modest-size dataset is present. For remote datasets retain the UI contract but move the query to the server.

Supply actual records, a working detail URL for each record, and a retry callback connected to the data loader. Validate dates at the data boundary. If the project uses a router, use its link component in place of a. Example wording is Turkish; use the product's language consistently.

~~~tsx
import { useEffect, useId, useMemo, useState } from "react";

type Ticket = {
  id: string; subject: string; company: string;
  status: "open" | "review" | "closed";
  updatedAt: string; detailHref: string;
};
type QueueProps = {
  rows: Ticket[];
  loadState?: "loading" | "ready" | "error";
  onRetry: () => void;
};
const statusLabel = { open: "Açık", review: "İncelemede", closed: "Çözüldü" };
const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});
const pageSize = 8;

export function TicketQueue({ rows, loadState = "ready", onRetry }: QueueProps) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"newest" | "company">("newest");
  const [pageIndex, setPageIndex] = useState(0);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("tr-TR");
    return rows.filter(row =>
      (status === "all" || row.status === status) &&
      (row.subject + " " + row.company + " " + row.id)
        .toLocaleLowerCase("tr-TR").includes(term)
    ).sort((a, b) =>
      (sort === "newest"
        ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        : a.company.localeCompare(b.company, "tr")) ||
      a.id.localeCompare(b.id)
    );
  }, [rows, query, status, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  useEffect(() => {
    setPageIndex(old => Math.min(old, pageCount - 1));
  }, [pageCount]);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const clearFilters = () => { setQuery(""); setStatus("all"); setPageIndex(0); };
  const badge = (row: Ticket) =>
    <span className={"ops-status ops-status--" + row.status}>{statusLabel[row.status]}</span>;
  const countText = filtered.length
    ? (currentPage * pageSize + 1) + "–" +
      Math.min((currentPage + 1) * pageSize, filtered.length) +
      " / " + filtered.length + " talep"
    : "0 talep";

  return (
    <section className="ops-queue" aria-labelledby={uid + "-title"}>
      <header className="ops-heading">
        <div><h2 id={uid + "-title"}>Destek kuyruğu</h2>
          <p>Müşteri taleplerini bul, incele ve sıradaki işi seç.</p></div>
        {(rows.length > 0 || loadState === "ready") &&
          <span className="ops-total">{rows.length} toplam kayıt</span>}
      </header>
      <div className="ops-toolbar">
        <label className="ops-search" htmlFor={uid + "-search"}>
          <span>Talep ara</span>
          <input id={uid + "-search"} type="search" value={query}
            placeholder="Konu, şirket veya numara"
            onChange={event => { setQuery(event.target.value); setPageIndex(0); }} />
        </label>
        <label htmlFor={uid + "-status"}><span>Durum</span>
          <select id={uid + "-status"} value={status}
            onChange={event => { setStatus(event.target.value); setPageIndex(0); }}>
            <option value="all">Tüm durumlar</option>
            <option value="open">Açık</option><option value="review">İncelemede</option>
            <option value="closed">Çözüldü</option>
          </select>
        </label>
        <label htmlFor={uid + "-sort"}><span>Sıralama</span>
          <select id={uid + "-sort"} value={sort}
            onChange={event => {
              setSort(event.target.value as "newest" | "company"); setPageIndex(0);
            }}>
            <option value="newest">Son güncellenen</option>
            <option value="company">Şirket A–Z</option>
          </select>
        </label>
      </div>
      {loadState === "error" && <div className="ops-notice" role="alert">
        <p>Veriler yenilenemedi.{rows.length > 0 && " Son alınan kayıtlar gösteriliyor."}</p>
        <button type="button" onClick={onRetry}>Tekrar dene</button>
      </div>}
      {loadState === "loading" && <p className="ops-loading" role="status">
        {rows.length ? "Kayıtlar güncelleniyor…" : "Talepler yükleniyor…"}
      </p>}
      <div aria-busy={loadState === "loading"}>
        {visible.length > 0 ? <>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <caption className="ops-sr-only">Filtrelenmiş destek talepleri</caption>
              <thead><tr><th scope="col">Talep</th><th scope="col">Şirket</th>
                <th scope="col">Durum</th><th scope="col">Güncellendi</th></tr></thead>
              <tbody>{visible.map(row => <tr key={row.id}>
                <td><a className="ops-subject" href={row.detailHref}>{row.subject}</a>
                  <span className="ops-secondary">#{row.id}</span></td>
                <td>{row.company}</td><td>{badge(row)}</td>
                <td className="ops-date"><time dateTime={row.updatedAt}>
                  {dateFormat.format(new Date(row.updatedAt))}
                </time></td>
              </tr>)}</tbody>
            </table>
          </div>
          <ul className="ops-mobile-list" aria-label="Destek talepleri">
            {visible.map(row => <li key={row.id}>
              <div className="ops-card-top"><span className="ops-secondary">#{row.id}</span>
                {badge(row)}</div>
              <a className="ops-subject" href={row.detailHref}>{row.subject}</a>
              <p>{row.company}</p>
              <time dateTime={row.updatedAt}>{dateFormat.format(new Date(row.updatedAt))}</time>
            </li>)}
          </ul>
        </> : loadState === "ready" && <div className="ops-empty">
          <h3>{rows.length ? "Bu filtrelere uygun talep yok" : "Henüz talep yok"}</h3>
          <p>{rows.length ? "Aramayı veya durum filtresini değiştir."
            : "Yeni talepler geldiğinde burada görünecek."}</p>
          {(query || status !== "all") &&
            <button type="button" onClick={clearFilters}>Filtreleri temizle</button>}
        </div>}
      </div>
      <footer className="ops-pagination">
        <span role="status" aria-live="polite">
          {loadState !== "ready" && rows.length === 0 ? "Kayıt sayısı henüz alınamadı" : countText}
        </span>
        <div>
          <button type="button" disabled={currentPage === 0}
            onClick={() => setPageIndex(currentPage - 1)}>Önceki</button>
          <span>{currentPage + 1} / {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount - 1}
            onClick={() => setPageIndex(currentPage + 1)}>Sonraki</button>
        </div>
      </footer>
    </section>
  );
}
~~~

Pair it with this scoped CSS. The light palette is an example; translate semantic roles into the actual brand/theme. The table and mobile list share the same derived rows. CSS hides the inactive presentation so there are no two visible/accessibility copies at one breakpoint. For a matrix requiring cross-column comparisons, retain a labeled horizontal table scroller on phones instead of converting it to cards.

~~~css
.ops-queue {
  --ops-bg: #fff; --ops-canvas: #f4f6f8; --ops-ink: #182332;
  --ops-muted: #586577; --ops-line: #dbe1e8; --ops-accent: #2755bd;
  color: var(--ops-ink); background: var(--ops-bg);
  border: 1px solid var(--ops-line); border-radius: 14px; min-width: 0;
  font: 400 0.9375rem/1.5 system-ui, sans-serif;
}
.ops-queue *, .ops-queue *::before, .ops-queue *::after { box-sizing: border-box; }
.ops-heading { display: flex; align-items: start; justify-content: space-between;
  gap: 1rem; padding: 1.4rem 1.5rem 1rem; }
.ops-heading h2 { margin: 0; font-size: 1.3rem; line-height: 1.3; letter-spacing: -.02em; }
.ops-heading p { margin: .35rem 0 0; color: var(--ops-muted); max-width: 58ch; }
.ops-total { flex-shrink: 0; font-size: .8125rem; color: var(--ops-muted); }
.ops-toolbar { display: flex; align-items: end; gap: .75rem; flex-wrap: wrap;
  padding: 0 1.5rem 1.2rem; }
.ops-toolbar label { display: grid; gap: .3rem; min-width: 0;
  color: var(--ops-muted); font-size: .8125rem; }
.ops-search { flex: 1 1 15rem; }
.ops-queue input, .ops-queue select, .ops-queue button {
  font: inherit; color: var(--ops-ink); border: 1px solid var(--ops-line);
  background: var(--ops-bg); border-radius: 7px; min-height: 2.75rem; padding: .5rem .7rem;
}
.ops-queue input { width: 100%; min-width: 0; }
.ops-queue button { cursor: pointer; }
.ops-queue button:disabled { opacity: .5; cursor: default; }
.ops-queue :focus-visible { outline: 3px solid var(--ops-accent); outline-offset: 3px; }
.ops-table-wrap { overflow-x: auto; }
.ops-table { width: 100%; border-collapse: collapse; text-align: left; }
.ops-table th { background: var(--ops-canvas); color: var(--ops-muted);
  font-size: .75rem; font-weight: 600; white-space: nowrap; padding: .7rem 1.5rem; }
.ops-table td { padding: .85rem 1.5rem; border-bottom: 1px solid var(--ops-line); }
.ops-table tbody tr:hover { background: #f8faff; }
.ops-table td:first-child { width: 43%; min-width: 15rem; }
.ops-subject { display: block; color: var(--ops-ink); font-weight: 600;
  text-decoration-color: transparent; overflow-wrap: anywhere; }
.ops-subject:hover { color: var(--ops-accent); text-decoration-color: currentColor; }
.ops-secondary { display: block; color: var(--ops-muted); font-size: .8125rem; margin-top: .15rem; }
.ops-date { font-size: .8125rem; color: var(--ops-muted); font-variant-numeric: tabular-nums; }
.ops-status { display: inline-flex; white-space: nowrap; border-radius: 5px;
  padding: .2rem .5rem; font-size: .75rem; font-weight: 600; }
.ops-status--open { color: #7b4a00; background: #fff0cd; }
.ops-status--review { color: #274c9f; background: #eaf0ff; }
.ops-status--closed { color: #246347; background: #e5f3eb; }
.ops-notice { display: flex; flex-wrap: wrap; align-items: center; gap: .7rem;
  margin: 0 1.5rem 1rem; padding: .75rem; color: #8a2929; background: #fff0ef; border-radius: 8px; }
.ops-notice p { flex: 1 1 14rem; margin: 0; }
.ops-loading { padding: 0 1.5rem; color: var(--ops-muted); }
.ops-empty { padding: 3rem 1.5rem; text-align: center; }
.ops-empty h3 { margin: 0; font-size: 1rem; }
.ops-empty p { color: var(--ops-muted); }
.ops-pagination { display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: .75rem; padding: 1rem 1.5rem; font-size: .8125rem; }
.ops-pagination > div { display: flex; align-items: center; gap: .65rem; }
.ops-mobile-list { display: none; }
.ops-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 42rem) {
  .ops-heading { padding: 1rem; flex-direction: column; gap: .4rem; }
  .ops-toolbar { padding: 0 1rem 1rem; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .ops-search { grid-column: 1 / -1; }
  .ops-toolbar select { width: 100%; }
  .ops-queue input, .ops-queue select { font-size: 1rem; }
  .ops-table-wrap { display: none; }
  .ops-mobile-list { display: grid; padding: 0; margin: 0; list-style: none; }
  .ops-mobile-list li { padding: 1rem; border-top: 1px solid var(--ops-line); }
  .ops-card-top { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .65rem; }
  .ops-mobile-list p { margin: .3rem 0; color: var(--ops-muted); }
  .ops-mobile-list time { color: var(--ops-muted); font-size: .8125rem; }
  .ops-pagination { padding: 1rem; }
}
~~~

This example intentionally uses a native sort selector available on every screen. If the requested grid also sorts from column headers, make those controls update the same sort state and reflect that state with aria-sort. Do not have toolbar sorting and column sorting disagree.

### Extend state without introducing false behavior

- **Date/range:** make from/to actual inputs or a working picker. Specify the reporting time zone. For date-only backend APIs pass YYYY-MM-DD without accidental UTC conversion. Use an inclusive start and exclusive next-day boundary for timestamp queries; validate start ≤ end. Changing the range must change the chart, totals and rows, not just the visible button label.
- **Server data:** include search, status, date range, sort and page in the request/cache key. Cancel or ignore older responses so a slow prior query cannot overwrite the current filter. Preserve the last successful data on a background refresh error and label it as stale.
- **Selection:** use stable record IDs. State clearly whether “select all” means this page or all matching records. Keep bulk actions absent until a selection exists; show the selected count and a clear-selection control. Clear or reconcile selection when scope changes.
- **Editing:** open a real route or accessible sheet/dialog. Preserve the current filter/page when returning. Show field errors next to their fields and keep unsaved input on a failed save. Report success only when the persistence operation succeeds.
- **Export:** export the defined scope through a real implementation. Name the scope and file type. If export is outside the request or not implemented, omit the decorative export button.
- **Pagination:** reset on search/filter/sort changes, clamp after deletion, disable impossible navigation, and distinguish loading from zero results. A count must never say “1–0”.
- **Loading:** preserve approximate layout. Use static skeletons or a quiet progress status, not pulsing every card forever. Updating one record should not blank the whole page.

## Analytics recipe: make the comparison readable

Use a line for change over ordered time, bars for categorical comparison, and a table when exact values matter more than shape. Use donuts sparingly for a few genuine parts of a whole. Do not decorate a dashboard with arbitrary smooth waves.

A chart card should answer one question. Put its title, metric unit, date range and source/freshness near the plot. Keep related plots on comparable scales; avoid a dual axis that makes unrelated quantities appear correlated. Missing data is not zero. If an area is absent, leave a gap or explain it. For bars, a nonzero baseline can visually exaggerate differences; make any intentional exception explicit.

The optional React/Recharts example below has clear loading, error and empty states, a stable plot size, an accessible data table and no animation on data refresh. Its CSS color variables should resolve to the current admin theme. Points must be chronologically ordered, date-only ISO strings; null means a missing measurement. The parent supplies a working retry and selected range. This is a chart component, not a reason to add charts to a CRUD screen.

~~~tsx
import { useId } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

type DailyPoint = { day: string; count: number | null };
export function DailyVolume({ points, status, rangeLabel, onRetry }: {
  points: DailyPoint[]; status: "loading" | "ready" | "error";
  rangeLabel: string; onRetry: () => void;
}) {
  const uid = useId();
  const numbers = new Intl.NumberFormat("tr-TR");
  const known = points.filter(point => point.count !== null);
  return <section className="ops-chart" aria-labelledby={uid + "-title"}>
    <header><h2 id={uid + "-title"}>Günlük talep sayısı</h2><p>{rangeLabel} · adet</p></header>
    {status === "loading" ? <div className="ops-chart-state" role="status">Grafik yükleniyor…</div>
      : status === "error" ? <div className="ops-chart-state" role="alert">
        <p>Grafik alınamadı.</p><button type="button" onClick={onRetry}>Tekrar dene</button>
      </div>
      : known.length === 0 ? <div className="ops-chart-state">Bu dönemde ölçüm yok.</div>
      : <>
        <div className="ops-plot">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={points} accessibilityLayer margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--ops-line, #dbe1e8)" />
              <XAxis dataKey="day" tickFormatter={value => String(value).slice(5)}
                tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis allowDecimals={false} width={48} tickLine={false} axisLine={false} />
              <Tooltip formatter={value => [numbers.format(Number(value)), "Talep"]} />
              <Line dataKey="count" name="Talep" type="linear" connectNulls={false}
                stroke="var(--ops-accent, #2755bd)" strokeWidth={2}
                dot={known.length === 1} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <details><summary>Verileri tablo olarak göster</summary>
          <table><caption>{rangeLabel} — talep sayısı</caption>
            <thead><tr><th scope="col">Tarih</th><th scope="col">Talep</th></tr></thead>
            <tbody>{points.map(point => <tr key={point.day}>
              <th scope="row">{point.day}</th>
              <td>{point.count === null ? "Ölçüm yok" : numbers.format(point.count)}</td>
            </tr>)}</tbody>
          </table>
        </details>
      </>}
  </section>;
}
~~~

~~~css
.ops-chart { min-width: 0; padding: clamp(1rem, 2vw, 1.5rem);
  background: var(--ops-bg, #fff); border: 1px solid var(--ops-line, #dbe1e8);
  border-radius: 14px; color: var(--ops-ink, #182332); }
.ops-chart h2 { margin: 0; font-size: 1.125rem; }
.ops-chart header p { margin: .35rem 0 1rem; color: var(--ops-muted, #586577); }
.ops-plot, .ops-chart-state { height: 18rem; min-width: 0; }
.ops-chart-state { display: grid; align-content: center; justify-items: center; gap: .75rem; }
.ops-chart details { margin-top: 1rem; }
.ops-chart summary { cursor: pointer; min-height: 2.75rem; padding-block: .6rem; }
.ops-chart table { width: 100%; border-collapse: collapse; }
.ops-chart th, .ops-chart td { padding: .5rem; text-align: left; border-bottom: 1px solid var(--ops-line, #dbe1e8); }
.ops-chart td { text-align: right; font-variant-numeric: tabular-nums; }
@media (max-width: 42rem) { .ops-plot, .ops-chart-state { height: 15rem; } }
~~~

Recharts' [ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/) measures the container; a percentage height with no ancestor height produces an empty-looking chart. Its [LineChart API](https://recharts.github.io/en-US/api/LineChart/) exposes accessibilityLayer. Retain keyboard support and also provide a short written conclusion or data alternative; tooltip-only values are insufficient. Test the installed version's tooltip types and keyboard behavior.

## Responsive shell and foldable screens

A desktop shell often works with a 216–248px sidebar and a minmax(0, 1fr) content column. The minmax prevents the table/chart's intrinsic width from forcing the whole page wider. Put max-width on the reading/report canvas only when it improves scanning; dense operational tables may use the available width.

~~~css
.admin-shell { display: grid; grid-template-columns: 14rem minmax(0, 1fr); min-height: 100dvh; }
.admin-main { min-width: 0; padding: clamp(1rem, 2.5vw, 2rem); }
.admin-panels { display: grid; grid-template-columns: minmax(0, 2fr) minmax(15rem, 1fr); gap: 1.25rem; }
@media (max-width: 68rem) {
  .admin-shell { grid-template-columns: minmax(0, 1fr); }
  .admin-panels { grid-template-columns: minmax(0, 1fr); }
}
~~~

This CSS changes content layout only. Implement navigation at that breakpoint with the existing accessible drawer/sheet or an inline collapsible navigation: a labeled toggle, visible active location, keyboard behavior, Escape/close, focus return and appropriate scroll handling. Hiding the sidebar without a replacement makes sections unreachable. Do not create a second fixed navigation bar on every nested page.

Test intermediate widths as a distinct composition. A foldable around 768px may still need the compact navigation even though it is wider than a phone. Do not choose a persistent desktop sidebar solely because a conventional “tablet” breakpoint was crossed. On narrow screens prioritize subject, status and next action; move secondary fields into detail. Avoid a fixed-height nested scroll region unless the task requires it, and keep the main action/composer clear of any bottom navigation.

## Inspect the result, then refine the visible defects

Use actual preview screenshots at desktop, narrow phone and an intermediate/foldable width; exercise the page rather than reviewing JSX alone. For the first visual pass ask: “What is the primary task, and which three elements distract from it?” For the next ask: “Which labels, data or controls are crowded, clipped or visually indistinguishable?” Keep questions focused enough for the visual tool to answer.

Check these observable outcomes:

1. In a brief glance, the viewer can identify the page scope, the important state and the next useful action. A forest of equal cards is a hierarchy failure even when every border is aligned.
2. Search changes the actual rows; filter changes reset the page; sort changes order; next/previous cannot reach an empty invalid page; “clear filters” returns real results.
3. Date range changes affect the data being described. Totals and chart scopes agree. Missing, zero and unavailable are distinguishable.
4. Empty data, no matching filter, first load, background refresh, fetch error and save failure have different, truthful states.
5. Long names, large values, localized dates and at least one unusually long subject remain readable. Desktop whitespace supports scanning; mobile information is not merely shrunk.
6. Keyboard focus reaches every control in sensible order. Labels, status text, table headers, row action names and detail navigation are understandable without color/hover.
7. At narrow widths there is no page-wide horizontal overflow; table overflow, if chosen, is contained and apparent. The sidebar does not consume half a foldable screen.
8. The screenshot looks specific to this product: useful information, coherent type/surface rhythm and intentional prominence. Decorative charts, invented KPIs and generic equal-card scaffolding are revised before completion.

Do one concrete correction pass based on the observed defects and re-check the changed screens. Passing build/tests demonstrates code health; it does not demonstrate visual quality.
