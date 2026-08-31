# Luxora Design Guidelines

This document is the visual and interaction reference for Luxora’s marketing site and customer, provider, and admin portals. It reflects the current interface implementation and should guide every new screen, component, and state.

## 1. Design direction

Luxora should feel like a modern premium concierge service: quiet, confident, refined, and easy to operate. Use a restrained dark foundation, warm gold only for emphasis, and clear operational states.

- Keep one clear primary action per view.
- Let content, spacing, and typography create hierarchy before adding decoration.
- Use warm gold for value, selection, and conversion—not as a general-purpose background.
- Keep dashboards practical: readable data, unambiguous status, and deliberate role differences.
- Prefer reusable CSS variables and existing shared components over one-off visual treatments.

## 2. Typography

### Font families

| Use | Font | Weights |
| --- | --- | --- |
| Interface, navigation, form controls, body copy | `Inter`, system-ui, sans-serif | 300, 400, 500, 600, 700, 800 |
| Editorial marketing headings and selected portal headings | `Playfair Display`, Georgia, serif | 400, 700 |
| Codes, PINs, reference IDs | monospace | system default |

The font files are loaded in `frontend/index.html`. Do not introduce another display or UI font unless the whole system is deliberately revised.

### Type hierarchy

| Element | Recommended treatment |
| --- | --- |
| Marketing hero / major statement | Playfair Display, regular weight, `clamp(2rem, 4vw, 3.4rem)`, tight line-height (`1.05`), slight negative tracking |
| Portal hero | Inter, 800 weight, approximately 42–78px responsive; use Playfair only where a more editorial emphasis is intended |
| Panel title | 23–26px, compact line-height, strong contrast |
| Body text | 13–16px Inter, regular weight, comfortable line-height |
| Label, eyebrow, status | 9–11px Inter, 700–800 weight, uppercase, `.10em`–`.16em` letter spacing |
| Table / dense metadata | 10–13px Inter, use muted colour for secondary values |

Avoid long all-caps sentences, very light text for essential information, and more than two type styles in one component.

## 3. Colour system

### Core tokens

| Purpose | Token / value | Use |
| --- | --- | --- |
| Gold accent | `--gold: #C9A84C` | Main calls to action, selected states, highlights |
| Bright gold | `--gold-light: #E8C96B` | Hover highlights and light-on-dark accent text |
| Button gold | `--gold-btn: #D4A843` | Primary marketing button fill |
| Main dark | `--dark: #0F0F0F` | Marketing page foundation |
| Secondary dark | `--dark-secondary: #1A1A1A` | Layered sections |
| Card dark | `--dark-card: #1C1C1C` | Marketing cards |
| Border dark | `--dark-border: #2A2A2A` | Visible boundaries |
| White / off-white | `#FFFFFF` / `--off-white: #F5F5F0` | Primary text and light areas |
| Muted / light text | `--text-muted: #888`, `--text-light: #CCC` | Supporting text only |
| Success | `--success: #5FBD8B` | Completed, active, approved, available |
| Danger | `--danger: #DF7A78` | Rejected, cancelled, expired, destructive actions |

### Portal tokens

Portals use a softer near-black system. Use the portal variables within portal UI instead of marketing tokens.

| Purpose | Value |
| --- | --- |
| Background | `--p-bg: #101110` |
| Surface | `--p-surface: #181A19` |
| Raised surface | `--p-surface-2: #202321` |
| Divider | `--p-line: #343633` |
| Primary text | `--p-text: #F2EFE8` |
| Muted text | `--p-muted: #A3A39B` |
| Default accent | `--p-accent: #C3AD78` |
| Provider accent | `#91B8A1` |
| Admin accent | `#B9A572` |
| Portal success / error | `#77AE8A` / `#CE807A` |

### Colour rules

- Pair status colour with a text label and/or icon; colour alone must never carry the meaning.
- Use `--p-green` only for positive state, not for ordinary buttons.
- Reserve red for destructive or failed states. A delete button and its confirmation must remain visually distinct from a normal secondary action.
- Keep most content on neutral dark surfaces. Use gradients and coloured tints sparingly, mostly for introductory areas and important workspaces.
- Maintain clear text contrast against all image overlays and tinted cards.

## 4. Layout and spacing

### Marketing pages

- Use `.luxora-shell` for shared page width: maximum `1280px` with responsive horizontal padding.
- Preserve generous vertical space between major sections; use roughly 48–112px depending on viewport and importance.
- Use full-width background bands only to separate meaningful sections.
- Keep card grids responsive; do not force narrow cards to keep a desktop column count.

### Portals

| Area | Desktop | Mobile |
| --- | --- | --- |
| Left navigation rail | Fixed, 248px wide | Slide-in drawer |
| Top bar | 78px high | 67px high |
| Portal content padding | `clamp(24px, 4vw, 54px)` | 18px / 14px on small screens |
| Portal panel radius | 10–16px | 8–15px as space requires |
| Customer portal content | Wide, centered workspaces | Stacked single-column content |

Use an 8px rhythm where practical: 8, 16, 24, 32, 48, and 64px are preferred gaps and padding values. Dense administrative data can use 10–16px internal spacing, but retain enough room to scan rows and tap actions.

## 5. Components

### Buttons

- **Primary:** gold/accent fill, dark text, used for the single next step or primary conversion.
- **Secondary:** transparent or dark surface with a visible border, used for safe alternatives.
- **Danger:** muted red treatment, used only for removal, rejection, cancellation, or another irreversible action.
- **Text action:** no strong container; use for low-priority navigation and inline actions.
- Buttons must show hover, active, disabled, and keyboard-focus states. Keep labels action-oriented: “Save package”, “Confirm removal”, “View booking”.

### Cards and panels

- Marketing cards use `--dark-card`, a subtle border, and typically an 18px radius.
- Portal panels use the portal surface, a 1px `--p-line` border, and a 10–16px radius.
- Use a card for a grouped decision, an isolated summary, or a distinct unit of work. Do not wrap every paragraph in a card.
- Use subtle elevation, not heavy shadows. The gold ambient shadow is appropriate only for highlighted premium content.

### Forms

- Always use visible labels; placeholders are supporting examples, not labels.
- Group related fields under short descriptive headings.
- Show validation close to the affected field in plain language.
- Preserve entered values after a validation or request error.
- Use a clear loading state while saving and prevent accidental duplicate submissions.

### Statuses, empty states, and loading

- Render status as a compact pill with a dot and uppercase label.
- Map approved/active/completed/available to green, and cancelled/rejected/expired to red.
- Empty states need an icon, a short title, a helpful sentence, and an available next action.
- Use skeletons or restrained shimmer for initial loading; do not imply success before data arrives.

### Tables and operational lists

- Make the most important item in each row easy to scan first.
- Keep dates, amounts, status, and row actions consistently aligned.
- On mobile, allow the layout to stack or change to cards rather than compressing text until it is unreadable.
- Use a details modal for dense information; include a close control and retain the originating context.

### Modals and confirmations

- The standard overlay is a dark translucent layer with blur; modal widths are up to 540px for focused tasks and up to 880px for wide details.
- Use modal dialogs for focused review, edit, or confirmation—not routine navigation.
- Destructive actions require an explicit confirmation such as “Are you sure you want to remove this package?” and distinct Cancel / Remove actions.
- Return focus to the invoking control when a modal closes, and allow Escape to close non-destructive dialogs.

## 6. Interaction and motion

- Standard transitions are 150–260ms; larger entrance/reveal moments may use up to 520ms.
- Use the existing easing: `cubic-bezier(.22, 1, .36, 1)` for expressive portal motion and `cubic-bezier(.4, 0, .2, 1)` for general UI transitions.
- Suitable motion: a card raises by 1–4px, a navigation icon shifts 2px, a panel fades upward on entry, or a button compresses slightly on press.
- Do not animate layout repeatedly, use large bouncing motion, or delay essential content behind animation.
- Honour `prefers-reduced-motion`; disable non-essential animation, parallax, and smooth scrolling when it is requested.

## 7. Imagery and visual treatments

- Use dark, architectural, premium imagery with a controlled focal point and enough negative space for text.
- Apply dark gradient overlays to photography so white/off-white copy remains readable.
- Use gold radial light and soft gradients as quiet atmosphere, not as decoration on every section.
- Icons should be simple, consistent in visual weight, and paired with a label when the action is unfamiliar.
- Every meaningful image needs accurate alt text. Decorative images should not create redundant announcements.

## 8. Responsive and accessible implementation

- Design desktop and mobile intentionally. At 900px, portals switch from the fixed rail to a drawer and bottom navigation; customer/admin grids must collapse before cards become cramped.
- Keep interactive targets comfortably tappable (aim for at least 40–44px high/wide).
- Never create horizontal page overflow. Test at narrow mobile widths as well as a standard desktop viewport.
- Support keyboard navigation in menus, forms, cards that behave as controls, and dialogs. Maintain visible focus styling.
- Use semantic HTML first: buttons for actions, links for navigation, labels for inputs, headings in order, and table semantics for tabular data.
- Do not rely on hover to expose a required action; touch devices must have an equivalent path.

## 9. Implementation conventions

- Start with shared tokens in `frontend/src/index.css` and portal tokens in `frontend/src/components/PortalShell.css`.
- Reuse shared UI styling in `frontend/src/components/ui.css` for overlays, modals, form fields, controls, and responsive behaviour.
- Keep role-specific changes scoped through portal modifiers such as `.portal-app--customer`, `.portal-app--provider`, and `.portal-app--admin`.
- Keep component markup, loading, error, empty, and disabled states aligned. A polished normal state without these states is incomplete.
- Use the existing `PortalMotion.css` and reduced-motion rules; do not add animation that bypasses them.
- For a new theme value, add a named token before repeating a literal colour across multiple files.

## 10. Pre-release checklist

- [ ] Uses Inter for UI and Playfair Display only where editorial display emphasis is intended.
- [ ] Uses existing tokens and role accents instead of new arbitrary colours.
- [ ] Has desktop, mobile, loading, empty, error, disabled, and keyboard-focus states.
- [ ] Uses the correct semantic status colour and text label.
- [ ] Has one clearly identifiable primary action.
- [ ] Destructive actions include confirmation and a visually distinct danger action.
- [ ] Meets reduced-motion, touch-target, contrast, and no-horizontal-overflow requirements.
- [ ] Matches existing portal rail, top bar, panel, modal, and button patterns where applicable.

## Reference files

- `frontend/index.html` — font loading and document metadata
- `frontend/src/index.css` — global type, colour, base layout, and marketing tokens
- `frontend/src/components/ui.css` — shared modal, overlay, form, and responsive patterns
- `frontend/src/components/PortalShell.css` — portal foundation and navigation shell
- `frontend/src/components/PortalMotion.css` — motion timings and reduced-motion behaviour
- `frontend/src/components/PortalSpatial.css` — role-specific portal layouts
