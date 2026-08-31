# Wei.G OpenWrt Firmware Customizer — Design Contract

This document defines the visual and interaction contract for `site/wrt`. It is
the project-owned implementation guide for the Precision Control Deck style.
It describes roles and invariants; the CSS token values in
`site/wrt/styles/00-tokens.css` are the runtime authority for exact values.

## 1. Visual theme and atmosphere

The page is a calm, precise engineering console. It should feel substantial
and dimensional without becoming decorative or difficult to scan.

- Use a neutral page surface, a single blue action accent, and semantic status
  colors for success, warning, and failure.
- Build depth with surface contrast, a one-pixel edge highlight, and several
  soft elevation levels.
- A sparse CSS star field may live on the outer page canvas. It is a static,
  low-contrast atmosphere layer only; work surfaces remain calm and readable.
- Keep motion short and purposeful: a raised control may lift by one pixel;
  no large rotations, flashing effects, or continuous ambient animation.
- Light and dark themes use the same semantic roles and preserve readable
  contrast.

## 2. Color palette and roles

The legacy aliases (`--bg`, `--card`, `--card2`, `--text`, `--text2`,
`--text3`, `--accent`, and related names) remain supported because lazy-loaded
modules use them. New rules should prefer the semantic roles below.

| Role | Token | Use |
| --- | --- | --- |
| Page surface | `--surface-page` | Body and the main canvas |
| Raised surface | `--surface-raised` | Cards, bars, dialogs |
| Inset surface | `--surface-inset` | Nested panels and fields |
| Strong content | `--content-strong` | Headings and primary values |
| Muted content | `--content-muted` | Descriptions and secondary values |
| Subtle content | `--content-subtle` | Metadata and helper text |
| Action accent | `--accent` / `--accent-strong` | Links, focus, selected state |
| Accent surface | `--accent-surface` | Selected and informative surfaces |
| Field surface | `--field-*` | Recessed text/select/textarea controls |
| Status | `--ok`, `--warn`, `--danger` | Semantic feedback only |

Raised page regions use `--surface-frame-*`, plugin category headers use
`--surface-category-*`, and menus/dialogs use `--surface-overlay-*`. These are
shared roles: a category must not receive a one-off color or shadow.

Do not introduce a second primary accent or use status colors for decoration.

## 3. Typography rules

Typography uses a compact desktop baseline so the wider work surface can show
more configuration context without making the controls feel dense.

- Desktop (at least 1024px): page title 27px, section title 20px, item title
  17px, emphasis/body 15px, description 14px, metadata 13px, badge 12px.
- The Aa control defaults to the compact 15px body baseline. A saved user
  value remains an explicit user preference.
- Narrow screens keep body text at 16px or above. Compact metadata may use the
  badge role when space is genuinely constrained.
- Use `--font-family-sans` for prose and `--font-family-mono` for commits,
  symbols, paths, and diagnostics.
- Fit long labels by wrapping or ellipsis within their component boundary;
  never reduce the whole page with `zoom`.

## 4. Component styling

Components are organized in layers: primitives, composites, then overlays.

- Buttons and action controls use the shared raised-control template. Text,
  search, password, numeric, URL, telephone, email, select, textarea, and
  dynamically-rendered menuconfig scalar fields use the shared recessed
  `--field-*` template: an inset shadow, stable border geometry, filled/hover/
  focus/disabled/read-only states, and visible focus in both themes. Choice
  inputs (checkbox, radio, and file) and buttons keep their own contracts.
- Plugin group headers use the same blue-gray category surface. Their default,
  expanded, hover, and keyboard-focus states are distinguished by the shared
  surface tokens; counts are compact capsules and do not rely on a decorative
  side stripe.
- Cards and plugin rows use the selectable-card tokens. Selected, disabled,
  built-in, forced, and removable states remain visually distinct.
- Every actionable control has a target close to 44px in both dimensions;
  dense Kconfig state strips may remain compact when their containing row
  provides an accessible label and keyboard path.
- Existing IDs, `data-*` hooks, ARIA relationships, and lazy style modules are
  public contracts. Styling must not require a business-logic rename.

## 5. Layout principles

- The page is a centered, fluid work surface up to `--content-max` (1440px)
  with safe-area-aware gutters.
- Each major step is a raised panel. Nested workspaces use an inset surface so
  hierarchy is visible without excessive borders.
- Grids use `minmax(0, 1fr)` and may wrap. Long Source, Branch, Target, Profile,
  package, and diagnostic values must not create horizontal page overflow.
- The document is a column flex shell: `body` fills the dynamic viewport,
  `main#app` absorbs short-page space, and the footer remains a normal-sized
  final item. The sticky action bar owns its own clearance through
  `--actionbar-height`.
  Floating controls use `--overlay-clearance` and never cover the primary
  submit action.
- A page section may scroll internally only when it has a visible boundary and
  a keyboard-accessible focus path.

## 6. Depth and elevation

`--elevation-1`, `--elevation-2`, and `--elevation-3` plus the shared surface
families define the project’s three-dimensional hierarchy:

1. Elevation 1: step panels, plugin groups, and ordinary cards.
2. Elevation 2: raised controls, menus, the floating dock, and tooltips.
3. Elevation 3: Build Information and modal surfaces.

Use a highlight plus shadow, not a heavy border or a perspective transform.
Top/bottom bars, step panels, plugin groups, category headers, menus, and
dialogs must choose one of the shared surface families so same-type controls
remain visually consistent.
The unified layer order is `--z-content`, `--z-sticky`, `--z-dropdown`,
`--z-dock`, `--z-floating`, `--z-toast`, `--z-modal`, and `--z-tooltip`.

## 7. Do and don’t

Do:

- reuse tokens and existing component selectors;
- keep copy, search, import, status, and recovery actions visible;
- wrap long translations and diagnostics inside their surfaces;
- test the same state in light, dark, keyboard, and reduced-motion modes.

Don’t:

- hide a feature to make a screenshot cleaner;
- add a one-off floating-positioning algorithm or a second toast/modal style;
- use a branded external palette, font, icon, or decorative asset;
- rely on `100vh` alone, page zoom, hover-only actions, or color alone to
  communicate state.

## 8. Responsive and accessibility behavior

The layout must remain usable at 320×568, 360×640, 390×844, 430×932,
768×1024, 1024×600, 1366×768, and 1920×1080, including landscape and 200%
browser zoom.

- Prefer `dvh` with a `vh` fallback for viewport-bound surfaces.
- Respect `env(safe-area-inset-*)` on every fixed or sticky edge.
- A modal, tooltip, Build Information card, font panel, catalog menu, and
  floating dock must have a bounded height and an internal scroll path when
  content exceeds the dynamic viewport. The dock itself remains overflow-safe;
  only its expanded item list may scroll on a short viewport.
- The wide filter preset may use up to 760px and 78dvh on desktop, then falls
  back to a single-column, viewport-width panel on narrow screens.
- Use `:focus-visible`, keyboard Escape handling supplied by the runtime,
  focus restoration, readable labels, and reduced-motion behavior.
- Maintain readable contrast in both themes and under increased contrast mode.

## 9. Implementation contract

The stylesheet is assembled in this fixed order by
`tools/gen-site-css.mjs`:

1. `00-tokens.css` — semantic roles and compatibility aliases;
2. `10-foundation.css` — reset, document defaults, and accessibility basics;
3. `20-layout.css` — page regions and configuration workspaces;
4. `30-components.css` — fields, cards, plugin rows, and state controls;
5. `40-overlays.css` — action bar, modal, tooltip, Build Information, and dock;
6. `50-responsive.css` — breakpoints, safe-area guards, and viewport overrides.

`site/wrt/app.css` is generated output and must not be edited directly. The
page still loads that one file; lazy modules keep their existing CSS contracts.
Run `node tools/gen-site-css.mjs --check` to verify freshness. A design change
is complete only when all existing page actions remain reachable and the
floating surfaces remain inside the dynamic viewport at the sizes above.
