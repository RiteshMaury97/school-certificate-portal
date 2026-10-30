# Header, footer and theme update

## Header

- Uses the configured school logo and school name; the compact label is used below 480px.
- Desktop navigation uses active-route indicators.
- Mobile navigation opens a drawer containing the same navigation and icon utilities.
- Language, theme, contrast and administrator controls are icon-only, keyboard accessible and have labels/tooltips.

## Footer

- School, quick links, support and legal sections are separated into conditional columns.
- Contact, affiliation, social and last-updated lines are omitted when their values are absent.
- The cookie notice is rendered only when the application indicates that essential security/session cookies are in use.

## Theme

- CSS semantic tokens cover light, dark and high-contrast palettes.
- Theme mode cycles system → light → dark → system and persists safely in localStorage.
- The root layout applies theme and color-scheme before the first paint.
- Inputs, autofill, disabled controls, placeholders, banners, surfaces, charts, skeletons and print mode use semantic colors.
- Print mode forces a light palette.

## Dependencies and verification

`lucide-react` and `react-helmet-async` are declared in `package.json`. The package lockfile was not regenerated in this environment. Run `npm install` once to synchronize `package-lock.json`, then run `npm run typecheck`, `npm run lint`, and `npm test`.

Browser viewport checks at 320, 360, 390, 768, 1024, 1280 and 1536 pixels have not been executed in this environment. The header/drawer layout is built mobile-first, but should be confirmed with the project's browser test suite before release.
