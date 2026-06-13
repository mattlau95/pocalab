# MAT-294 — SEO Spike + Monetization Recommendations

## SEO Audit

### What's missing right now

| Issue | Severity |
|---|---|
| No `<meta name="description">` | High — Google shows the URL as snippet instead |
| No Open Graph tags | High — link previews on Discord/Twitter/KakaoTalk show nothing |
| No Twitter card tags | Medium |
| No canonical `<link>` tag | Medium |
| No `robots.txt` | Low (defaults to allow-all, but should be explicit) |
| No `sitemap.xml` | Low (single-page app, but still good practice) |
| No `manifest.json` / PWA meta | Low |
| Page title is generic: "Photocard Generator" | Medium |
| All content is JS-rendered — Googlebot sees an empty `<div id="root">` | High |

### Target keywords

Primary (high intent, low competition):
- `kpop photocard generator`
- `free photocard maker`
- `print kpop photocards`
- `photocard template printable`

Secondary:
- `kpop card maker online`
- `photocard pdf template`
- `kpop photocard print at home`

### Recommended fixes (ordered by effort)

**1. Add meta tags to `index.html`** — 15 min, high impact

```html
<title>Free Kpop Photocard Generator — Print-Ready PDF</title>
<meta name="description" content="Make print-ready kpop photocards in minutes. Upload your photos, crop to the standard 55×85mm size, and download a press-ready PDF for home printing." />
<meta property="og:title" content="Free Kpop Photocard Generator" />
<meta property="og:description" content="Upload, crop, and print kpop photocards at home. Free, no account needed." />
<meta property="og:type" content="website" />
<meta property="og:image" content="/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

**2. Add a static hero/description section** — 30 min, high impact

Googlebot can't execute JavaScript, so the current SPA is invisible to search. Add a brief `<section>` with keyword-rich copy beneath the upload zone on first load — something like: *"Upload two photos, crop to the standard 55×85mm photocard size, set copy counts, and download a print-ready PDF. Works for all standard home printers."* This gives crawlers real text to index.

**3. Add `robots.txt` and `sitemap.xml`** — 10 min, low urgency pre-launch

Drop both in `/public/`. Single-page app sitemap just needs the one URL.

**4. Create an OG image** — 30 min, medium impact

A 1200×630 PNG showing the app UI or a sample photocard. Needed for Discord/Twitter link previews, which are the primary sharing surfaces for the kpop fan community.

**5. Performance / Core Web Vitals** — audit after deploy

pdf-lib (~200kb gzip) loads eagerly. Consider lazy-importing it only when the user clicks "Download PDF" — this alone likely improves LCP by 300–500ms. Google Fonts is already using `preconnect` + `display=swap`, which is correct.

---

## Monetization Recommendations

### Options ranked by effort vs. impact

| Option | Effort | Revenue potential | Audience fit |
|---|---|---|---|
| Ko-fi donation button | 30 min | Low but immediate | High — fans support creators |
| Affiliate link to print service | 1 hour | Medium — passive | Very high — direct user intent |
| Google AdSense | 2 hours + approval | Medium — requires traffic | Medium — intrusive for a tool |
| Premium features (Stripe) | 1–2 weeks + backend | High ceiling | Medium — fans expect free tools |
| Patreon | 1 hour | Low | Medium |

### Recommendation: start with two things

**1. Ko-fi button in the header or footer** (do first)

The kpop fan community is deeply donation-comfortable — they fund lightstick projects, fan sites, and translations. A simple "Support this tool" Ko-fi link is frictionless and culturally familiar. Implementation is a single `<a>` tag.

**2. Affiliate link to a print service** (do second)

After the user downloads their PDF, show a callout: *"Ready to print? [Sticker Mule] / [Moo] / [PrintingForLess] print on matte card stock."* An affiliate relationship with any of these pays per click or per order. Sticker Mule has a referral program; Vistaprint has an affiliate program via CJ Affiliate. This is the highest-alignment monetization possible — users literally came here to print.

**Skip AdSense for now.** The tool UI is too minimal for banner ads without feeling cheap, and it requires AdSense approval + real traffic volume to earn anything meaningful.

**Consider later: A4 + premium paper sizes.** Charging for additional paper size presets (A4, A3) is a believable upsell once the free US Letter version has organic traction.
