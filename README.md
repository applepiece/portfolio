# applepiece/portfolio

Personal portfolio of Porncheera (Ple) Chusorn, Ph.D.

- Static site: `index.html`, `styles.css`, `assets/`. No build step, no framework.
- Hosting: GitHub Pages from `main` at the repository root, served at `https://applepiece.github.io/portfolio/`.
- `.nojekyll` keeps Pages from running Jekyll.
- Language: one language on screen at a time. Every piece of copy sits in a pair of `data-l="th"` / `data-l="en"` elements; attributes and `<title>` use `data-i18n-attr` with `data-th` / `data-en`. Default Thai, `?lang=en` or `?lang=th` overrides, the choice is kept in localStorage (`ple-lang`).
- Hero illustration: layered inline SVG (`.w-hair-back`, `.w-body`, `.w-head` > `.w-face`, `.w-hair-front`) animated by `main.js` with requestAnimationFrame, lerp and springs. Static under `prefers-reduced-motion`.
- Icons are Remixicon 4.9.1 SVG paths inlined in the HTML. Fonts: Kanit and IBM Plex Sans Thai from Google Fonts.
