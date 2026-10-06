---
name: web-ui-storefront
description: Design product-led stores, catalogues and product detail pages with coherent imagery, responsive commerce hierarchy and functioning variant/cart states.
---

# Storefronts that help people choose

Use for shopping/catalogue experiences. Start with `../web-ui-design/SKILL.md` when available for the shared visual brief and verification approach. Read `../web-ui-interaction-recipes/SKILL.md` only when a drawer, filter, carousel or motion behavior needs implementation. A corporate service site belongs in `../web-ui-editorial-corporate/SKILL.md`; an inventory back office belongs in `../web-ui-admin/SKILL.md`. These sibling paths exist only when that pack is installed; this file's commerce recipe works independently.

Preserve the user's brand, stack and scope. A beautiful product page does not authorize adding checkout providers, publishing a store, placing orders or inventing stock. Treat a requested storefront prototype as a working browse/selection/bag experience; connect payment only when the task includes it.

## Choose a retail composition before choosing components

| Store type | Visual structure | Shopping hierarchy | Avoid |
|---|---|---|---|
| Premium/editorial collection | Generous gutters, distinctive display face, quiet product labels, one deliberate campaign image, paced full-width story/detail sections | Collection identity → material/use → product → option/price → bag | Turning every product into a raised dashboard card; oversized hero with no merchandise visible |
| Dense marketplace | Compact masthead, useful search, explicit category navigation, consistent comparison cards, restrained promotional area | Search/category → filters/count/sort → comparable offers → availability/delivery → details | Huge fashion-style whitespace, six competing sale banners, truncating the attribute people need to compare |
| Small specialist shop | Material/process photography, compact assortment, meaningful product differences, useful care/specification content | Need → differences → fit/options → purchase terms | Filling a small catalogue with duplicated goods, arbitrary rating stars or fake bestseller badges |

Choose two or three brand characteristics that affect actual decisions: e.g. “warm mineral palette, oversized editorial serif, matte close-up photography” or “precise technical catalogue, neutral sans, sharp white studio photography.” Do not apply the same cream/serif aesthetic to every store. Let the products carry visual interest; decorative blobs and generic icon grids rarely explain merchandise.

On a collection page, make the first actual products visible within a purposeful opening composition. On a detail page, put identity, price, option selection and the primary action together. A shipping claim is useful only if supported by supplied business rules. Show currency, unit/pack quantity and selected variant price clearly. Use sale prices and struck-out prices only when genuine.

## Product image art direction

Prepare an asset list before multiplying cards: stable product ID, actual file/URL, purpose (front, detail, scale, in-use), aspect ratio, crop anchor and descriptive alt text. Use user assets or authorized image sources; generated imagery can establish a prototype mood but must not fabricate real product characteristics.

- A collection should look like one shoot: compatible light temperature, background family, subject scale, shadows and camera height. Alternating unrelated stock-photo treatments makes the catalogue feel untrustworthy.
- Use `object-fit: contain` for a technical object whose full silhouette matters; use `cover` for a deliberate lifestyle crop. One ratio per comparable row creates rhythm; it does not mean every site needs the same ratio.
- Detail pages need more than cloned thumbnails: complete product, material/finish, relevant scale and genuine alternate angle. If only one asset exists, use one honest image rather than five copies with different crops labelled different views.
- Reserve image dimensions. Prioritize the main above-fold image, lazy-load lower catalogue rows, provide responsive image sizes when the source pipeline supports them. Text should not wait for all product photography to download.
- Never generate stars, review counts, “verified buyer,” scarcity counts, certifications, brand-client logos or delivery promises as decoration. Omit unsupported proof. Clearly distinguish sample catalogue data from real business information during prototyping.

## Hierarchy and responsive transformation

An editorial collection can use a 56–104px fluid lead title, 28–44px section headings and 15–18px supporting copy. A dense marketplace generally needs a quieter 28–40px page title, compact 14–16px labels and stronger price hierarchy. These are starting ranges, not required constants. Keep descriptions readable, prices tabular where compared, and metadata visibly subordinate.

Use one filled primary action in the purchase block; the gallery thumbnails, quantity control, size guide and save action should not all resemble competing CTAs. Borders may organize controls, but do not outline every line of copy. A tactile selection state needs more than a tiny change in grey: use clear checked/pressed treatment and a text label.

Transform, do not shrink:

- Wide detail page: large gallery beside a narrower purchase column. Sticky purchase content is optional; disable it when the viewport height would hide options or the button.
- Phone: gallery → name/price → options → primary action → details. Use compact image selectors or scroll-snap with a visible next-image clue. A fixed buy bar requires reserved bottom space and must reflect the actual selected option/price; omit it if it crowds the interface.
- Wide catalogue: filter rail plus product grid when there are enough useful facets. Phone: result count/sort plus a filter dialog with active filter count, reset and apply behavior. Keep two product columns only while titles, prices and targets remain comfortable; one column is appropriate for detailed comparison cards.
- Intermediate/foldable: re-evaluate gallery split and filter rail together. A 768px screen is not automatically a desktop; a permanent rail can leave the merchandise too narrow.

## Working selection and bag recipe

This original React recipe demonstrates gallery selection, variant-dependent price, stock-bounded additions, bag quantities, removal and a derived subtotal. It is a **detail + bag slice**, not a complete storefront template or payment implementation. Pass real catalogue records shaped as described below. Mount a new keyed detail component when navigation changes the product. Use the project's existing router for actual product URLs and back/forward navigation.

`product` shape: `{ id, name, description, images: [{src, alt, width, height}], variants: [{id, label, priceMinor, stock}] }`. IDs are stable; `priceMinor` is integer minor currency units; stock is a nonnegative integer. The example uses a two-decimal currency. For zero/three-decimal currencies, use the configured currency exponent consistently, including server calculations.

```jsx
import { useId, useState } from "react";

export function ProductWithBag({ product, locale = "tr-TR", currency = "TRY" }) {
  // Parent usage: <ProductWithBag key={product.id} product={product} />
  const titleId = useId();
  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [bag, setBag] = useState({}); // variant ID -> quantity, for this product
  const [notice, setNotice] = useState("");
  const money = value => new Intl.NumberFormat(locale, {
    style: "currency", currency
  }).format(value / 100);
  const variant = product.variants.find(item => item.id === variantId);
  const image = product.images[imageIndex] ?? product.images[0];
  const lines = product.variants.flatMap(item => {
    const quantity = Math.min(bag[item.id] ?? 0, item.stock);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
  const subtotal = lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const remaining = variant ? Math.max(0, variant.stock - (bag[variant.id] ?? 0)) : 0;

  function changeQuantity(item, delta) {
    setBag(previous => ({
      ...previous,
      [item.id]: Math.max(0, Math.min(item.stock, Math.min(previous[item.id] ?? 0, item.stock) + delta))
    }));
  }
  function add() {
    if (!variant || remaining === 0) return;
    changeQuantity(variant, 1);
    setNotice(`${product.name}, ${variant.label}: sepete eklendi.`);
  }
  return <section className="shop-product" aria-labelledby={titleId}>
    <div className="shop-gallery">
      <div className="shop-main-image">
        {image ? <img src={image.src} alt={image.alt}
          width={image.width} height={image.height} /> : <p>Ürün görseli henüz eklenmemiş.</p>}
      </div>
      {product.images.length > 1 && <div className="shop-thumbs" aria-label="Ürün görselleri">
        {product.images.map((item, index) => <button type="button" key={item.src}
          aria-label={`Görsel ${index + 1}: ${item.alt}`}
          aria-pressed={imageIndex === index} onClick={() => setImageIndex(index)}>
          <img src={item.src} alt="" width="80" height="80" loading="lazy" />
        </button>)}
      </div>}
    </div>
    <div className="shop-purchase">
      <p className="shop-kicker">Koleksiyon</p>
      <h1 id={titleId}>{product.name}</h1>
      <p className="shop-price">{variant ? money(variant.priceMinor) : "Seçenek bulunamadı"}</p>
      <p className="shop-description">{product.description}</p>
      <fieldset className="shop-options">
        <legend>Seçenek</legend>
        {product.variants.map(item => <label key={item.id}>
          <input type="radio" name={titleId} value={item.id}
            checked={variantId === item.id} onChange={() => setVariantId(item.id)} />
          <span>{item.label}{item.stock === 0 ? " — Tükendi" : ""}</span>
        </label>)}
      </fieldset>
      <button className="shop-add" type="button" disabled={remaining === 0} onClick={add}>
        {!variant ? "Seçenek yok" : variant.stock === 0 ? "Tükendi" : remaining === 0 ? "Stok kadar eklendi" : "Sepete ekle"}
      </button>
      <p className="shop-feedback" role="status">{notice}</p>
      <section className="shop-bag" aria-label="Sepet">
        <h2>Sepet <span>({count})</span></h2>
        {lines.length === 0 ? <p>Sepetin henüz boş.</p> : <ul>
          {lines.map(line => <li key={line.id}>
            <div><strong>{line.label}</strong><br /><span>{money(line.priceMinor)} / adet</span></div>
            <div className="shop-quantity">
              <button type="button" aria-label={`${line.label}: bir azalt`}
                onClick={() => changeQuantity(line, -1)}>−</button>
              <span aria-label={`${line.quantity} adet`}>{line.quantity}</span>
              <button type="button" aria-label={`${line.label}: bir artır`}
                disabled={line.quantity >= line.stock} onClick={() => changeQuantity(line, 1)}>+</button>
            </div>
            <button className="shop-remove" type="button"
              aria-label={`${line.label}: sepetten kaldır`}
              onClick={() => setBag(previous => ({ ...previous, [line.id]: 0 }))}>Kaldır</button>
          </li>)}
        </ul>}
        <p className="shop-total"><span>Ara toplam</span><strong>{money(subtotal)}</strong></p>
      </section>
    </div>
  </section>;
}
```

```css
.shop-product {
  --shop-ink: #252820; --shop-muted: #606454; --shop-paper: #f5f3eb;
  --shop-line: #d6d6c9; --shop-action: #304737;
  display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(18rem, .8fr);
  gap: clamp(1.5rem, 5vw, 5rem); max-width: 78rem; margin: auto;
  padding: clamp(1rem, 4vw, 3.5rem); color: var(--shop-ink);
}
.shop-product * { box-sizing: border-box; }
.shop-main-image { aspect-ratio: 4 / 5; background: var(--shop-paper); display: grid; place-items: center; }
.shop-main-image img { width: 100%; height: 100%; object-fit: contain; min-width: 0; }
.shop-thumbs { display: flex; gap: .65rem; margin-top: .8rem; overflow-x: auto; padding: .2rem; }
.shop-thumbs button { flex: 0 0 4.5rem; padding: .2rem; background: transparent; border: 1px solid transparent; cursor: pointer; }
.shop-thumbs button[aria-pressed="true"] { border-color: var(--shop-action); }
.shop-thumbs img { display: block; width: 100%; height: 4rem; object-fit: cover; }
.shop-kicker { text-transform: uppercase; font-size: .72rem; letter-spacing: .14em; color: var(--shop-muted); }
.shop-purchase h1 { font-family: Georgia, serif; font-size: clamp(2.25rem, 4vw, 4rem); font-weight: 400; line-height: 1.05; margin: .6rem 0 1rem; }
.shop-price { font-size: 1.35rem; font-variant-numeric: tabular-nums; }
.shop-description { line-height: 1.65; max-width: 45ch; color: var(--shop-muted); }
.shop-options { padding: 0; margin: 1.6rem 0; border: 0; display: flex; flex-wrap: wrap; gap: .5rem; }
.shop-options legend { padding: 0; margin-bottom: .65rem; font-size: .875rem; }
.shop-options label { cursor: pointer; display: inline-flex; align-items: center; gap: .45rem; padding: .65rem .8rem; border: 1px solid var(--shop-line); border-radius: .3rem; }
.shop-options label:has(input:checked) { border-color: var(--shop-action); background: #e8ede4; }
.shop-options input { accent-color: var(--shop-action); }
.shop-add { width: 100%; min-height: 3.1rem; background: var(--shop-action); color: white; border: 0; border-radius: .3rem; font: inherit; cursor: pointer; }
.shop-product button:disabled { opacity: .5; cursor: not-allowed; }
.shop-product :focus-visible { outline: 3px solid #846936; outline-offset: 3px; }
.shop-feedback { min-height: 2.5em; font-size: .85rem; color: var(--shop-muted); }
.shop-bag { border-top: 1px solid var(--shop-line); padding-top: 1rem; }
.shop-bag h2 { font-size: 1.05rem; }
.shop-bag h2 span { font-weight: 400; color: var(--shop-muted); }
.shop-bag ul { padding: 0; list-style: none; }
.shop-bag li { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; padding: .75rem 0; }
.shop-bag li > div:first-child { flex: 1 1 8rem; }
.shop-bag li span { font-size: .85rem; }
.shop-quantity { display: flex; align-items: center; gap: .5rem; }
.shop-quantity button { width: 2.5rem; height: 2.5rem; border: 1px solid var(--shop-line); background: transparent; border-radius: .25rem; }
.shop-remove { background: transparent; border: 0; padding: .7rem 0; text-decoration: underline; color: var(--shop-muted); }
.shop-total { display: flex; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--shop-line); padding-top: 1rem; }
@media (max-width: 760px) {
  .shop-product { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
  .shop-main-image { aspect-ratio: 1; }
  .shop-purchase h1 { max-width: 16ch; }
}
```

Adapt the token palette and typography to the brief; the sample's warm paper and serif are one specialist-shop direction. For multiple products, lift the bag to shared app state and key lines by product + variant ID. Keep totals derived from catalogue/quote data, never independently editable labels. The server must validate current prices, stock, currency, taxes and shipping before any actual order; this client state is not payment security. Do not display an enabled “Pay” button until its destination works. React's guidance on immutable collection updates is useful when expanding this reducer/state pattern: [Updating arrays in state](https://react.dev/learn/updating-arrays-in-state).

## Product grid recipe and density switch

Cards need an actual product link, an image, product identity, price and only the attributes that help the category. Keep save/quick-add buttons outside that link, not nested inside it. Products with required options should open details before adding. Selected filter/sort state belongs in the existing URL/router when sharing and returning to a result set matter.

```css
.catalog-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.25rem 1.25rem; }
.catalog-card { min-width: 0; }
.catalog-card a { color: inherit; text-decoration: none; }
.catalog-card .image { display: block; aspect-ratio: 4 / 5; overflow: hidden; background: #eeeee8; }
.catalog-card img { width: 100%; height: 100%; object-fit: cover; }
.catalog-card h3 { margin: .8rem 0 .3rem; font: 500 1rem/1.35 system-ui, sans-serif; }
.catalog-card .price { margin: 0; font-variant-numeric: tabular-nums; }
.catalog-grid[data-density="market"] { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.25rem .9rem; }
.catalog-grid[data-density="market"] .image { aspect-ratio: 1; }
@media (max-width: 960px) {
  .catalog-grid, .catalog-grid[data-density="market"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 359px) {
  .catalog-grid, .catalog-grid[data-density="market"] { grid-template-columns: minmax(0, 1fr); }
}
```

These breakpoints depend on the actual available content width. A filter rail changes that width; use a container query or move the breakpoint earlier instead of squeezing four cards into the remaining column. Render enough distinct real sample products to judge the repeated visual rhythm, but do not pad the catalogue with copies.

## Use libraries when the behavior earns them

Use the installed framework/router first. Native controls and CSS are enough for the recipe above. A project already using shadcn/Radix can reuse its dialog for filters/bag; keep its selected primitive base and styling tokens. Use Embla for an actual draggable gallery with controls, not to hide the primary buying information inside an auto-rotating banner. Use Motion for meaningful transitions between real states; the interaction pack gives version-aware examples. No shopping page needs all three by default.

## Check the visible and behavioral result

At desktop, phone and an intermediate width, verify: does the product dominate before decoration; can a shopper identify the selected option and final displayed price immediately; are photo scales consistent; does a thumbnail actually change the main image; does repeated add stop at stock; does decrease/removal update count and subtotal; do filters produce a useful empty state; do keyboard focus and back navigation remain understandable? Inspect image failures and long translated product names. Test the product with no images, an unavailable variant and the last item in stock.

If the storefront still looks generic, change the weak decision: a more coherent shoot, stronger title/product scale contrast, a deliberate grid rhythm or a clearer buying block. Adding more badges, cards, gradients and motion is not a substitute for these corrections.
