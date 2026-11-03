# applepiece/portfolio

Personal portfolio of Porncheera (Ple) Chusorn, Ph.D.

- Static site: `index.html`, `styles.css`, `assets/`. No build step, no framework.
- Hosting: GitHub Pages from `main` at the repository root, served at `https://applepiece.github.io/portfolio/`.
- `.nojekyll` keeps Pages from running Jekyll.
- Language: one language on screen at a time. Every piece of copy sits in a pair of `data-l="th"` / `data-l="en"` elements; attributes and `<title>` use `data-i18n-attr` with `data-th` / `data-en`. Default Thai, `?lang=en` or `?lang=th` overrides, the choice is kept in localStorage (`ple-lang`).
- Hero character: a 3D clay (plasticine, claymation) portrait of Ple, made with GPT Image from private reference photos as one 3x3 sheet (nine look directions), sliced into `assets/ple/look-*.webp` (PNG fallbacks) plus a blink frame on a flat lavender background (#E5D6F7, the face card uses the same colour). `main.js` picks the frame from the pointer angle around her face, cross-fades by opacity and tilts the card by transform only. Touch: last tap, then a slow idle look-around. Static centre frame under `prefers-reduced-motion`.
- Clay props (`assets/props/prop-*.webp`, transparent): six objects from one GPT Image sheet, floating in the page margins with gentle pointer parallax, idle bob and a small scroll offset; all static under `prefers-reduced-motion`.
- Source sheets, slicing and blink scripts live outside the repo in the Dropbox portfolio `art/` folder; the reference photos are never committed.
- Icons are Remixicon 4.9.1 SVG paths inlined in the HTML. Fonts: Kanit and IBM Plex Sans Thai from Google Fonts.
