# BeefCare full UI first-pass design

Date: 02/11/2026

## Intent

Create one coherent first-pass interface for the entire BeefCare product before
feature-by-feature refinement. The pass covers the 122 screens in the latest SRS
for farm users, technicians, customer support, platform managers, system
administrators, and guests.

The first pass is UI-first, but it is not allowed to invent business meaning.
Screen content, role visibility, fields, states, conditional behavior, and
navigation come from the latest requirements, requirement decisions,
OpenAPI/backend contracts, and existing implemented flows. Figma is a wireframe
reference for placement, information order, and interaction intent only. It is
not the visual-quality target. When a wireframe is incomplete, looks like a
generic AI-generated template, or conflicts with the approved entry-screen
language, the interface is completed and visually redesigned using the system
described here rather than copied literally.

## User direction being preserved

- Match the clarity and density of the recently refined cattle-entry form.
- Keep the interface simple, calm, and easy to scan.
- Do not wrap every section in a bordered card.
- Do not use oversized corner radii.
- Do not split related information into many decorative groups.
- Use spacing, typography, dividers, columns, and table structure for hierarchy.
- Generate a complete visual pass first; refinement and feature integration can
  follow after the whole product can be reviewed consistently.
- Treat the refined herd-entry screen built collaboratively with the user as
  the primary visual and UX precedent for density, grouping, form layout,
  warnings, action placement, and overlay behavior.

## Sources and authority

1. `docs/REQUIREMENT_DECISIONS.md`.
2. `docs/requirements/SRS_2026-11-01_SEP490_G35_Report.txt`, extracted from the
   user-supplied 334-page PDF.
3. Relevant operations in `docs/api/openapi.json` and backend DTO/validation.
4. Existing backend rules and tests.
5. Figma page/frame evidence for wireframe, layout, and interactions.
6. The refined BeefCare herd-entry screen for visual and UX quality. When Figma
   looks overly generated, decorative, or incomplete, this precedent controls
   the visual treatment while the sources above continue to control logic.

When a documented screen has no backend operation yet, the first pass may use a
typed fixture for visual review. Such data must be visibly development-only and
must not be presented as persisted. Existing backend-connected screens keep
their real adapters; the UI pass must not replace them with mock storage.

## Scope

### Executable screen delivery matrix

`frontend/src/app/screenManifest.ts` is the executable delivery matrix for all 122 SRS screens. Each row records its `SCR-xx` identifier, feature owner, Vietnamese title, allowed roles, page/tab/dialog ownership, archetype, stable review or production route, backend/fixture/hybrid data mode, and optional parent screen. The manifest is completeness-tested and drives role navigation, route reachability, review controls, and the final delivery checklist; the 122 rows are intentionally not duplicated in this document.

The visual pass covers SCR-01 through SCR-122, including nested profile tabs,
dialogs, editors, status variants, loading states, empty states, field errors,
permission/read-only states, and the technician phone layout.

The screens are implemented through a small set of product-wide archetypes
rather than 122 unrelated page designs:

1. Public, authentication, onboarding, and account screens.
2. Farm operational lists and worklists.
3. Cattle profile and other record-detail workspaces.
4. Voucher and document editors.
5. Care and reproduction recording forms.
6. Dashboards, reports, timelines, and analytical views.
7. Catalogue, configuration, membership, and service administration.
8. Support, reconciliation, finance, and audit workbenches.
9. Technician phone home, scan, worklist, and read-only views.

## Non-goals of the first visual pass

- Completing missing backend endpoints or pretending missing data persists.
- Rewriting already-correct domain logic solely for visual uniformity.
- Pixel-copying Figma when it conflicts with the latest SRS, backend contract,
  accessibility, the refined herd-entry precedent, or the user-approved visual
  direction.
- Introducing a generic dashboard kit, a new component dependency, or a large
  design framework.
- Creating separate visual languages for each feature.

## Visual system

### Palette

- `Farm green` `#08734E`: primary actions, selected controls, positive progress.
- `Deep leaf` `#183528`: headings and strong text.
- `Canvas` `#F7FAF7`: application background.
- `Surface` `#FFFFFF`: forms, tables, dialogs, and focused work areas.
- `Field edge` `#DCE6DE`: inputs and quiet separators.
- `Muted leaf` `#67766C`: secondary information.
- Existing semantic error, warning, and success colors remain, with tinted
  backgrounds reserved for messages rather than decoration.

The brand green is spent on actions and state, not on large decorative fills.

### Anti-template rule

The design must not reproduce the common AI-dashboard look: repeated rounded
cards, equal visual weight for unrelated blocks, decorative stat tiles,
oversized radii, excessive shadows, gradients without meaning, or many small
containers used only to make the page feel "designed". Each boundary must
represent an actual interaction, data ownership, or persistent context.

The refined herd-entry page is the baseline: broad aligned columns, compact
controls, clear headings, tables for repeated records, a single summary rail
where needed, and warnings/actions kept close to the decision they affect.

### Typography

Use `Be Vietnam Pro` throughout. The hierarchy is compact:

- Page title: 24-28px, 700.
- Section title: 17-20px, 650-700.
- Field and table label: 13-14px, 600.
- Body and table content: 13-14px, 400-500.
- Supporting text: 12-13px with high enough contrast to remain readable.

Avoid all-caps except the existing sidebar group labels. Keep labels and action
text in sentence case.

### Spacing and shape

- Base spacing: 4, 8, 12, 16, 24, 32px.
- Standard field height: 42-44px.
- Standard controls: 6-8px radius.
- Large dialogs and major work surfaces: at most 10-12px radius.
- Buttons: 6-8px radius; pill styling only for status or a true segmented
  choice.
- Shadows are used only for overlays or a floating layer. Ordinary sections use
  whitespace or a single divider.

### Hierarchy rule

Use a card only when the boundary changes interaction or meaning: a selectable
record, an independent status summary, a dialog, or a persistent side summary.
Do not use a card merely because a section has a heading.

## Application shells

### Farm desktop and tablet

The existing sidebar and top bar remain recognizable. The main content uses a
single broad work canvas with a restrained maximum reading width only on simple
forms. List and report pages use the available width.

```text
┌──────── sidebar ────────┬──────── top bar: title · farm · search · user ───┐
│ grouped navigation      ├──────────────────────────────────────────────────┤
│                         │ page heading              primary action         │
│                         │ filters / summary / tabs                          │
│                         │                                                  │
│                         │ flat work area: table, form, timeline, report    │
└─────────────────────────┴──────────────────────────────────────────────────┘
```

### Technician phone

Use a compact top bar and bottom navigation. Primary actions remain reachable
with one hand; tables become stacked rows only where columns cannot stay
legible. This is a responsive web layout, not a native-app imitation.

### Platform console

Use the same typography, fields, table density, and semantic colors as the farm
workspace, with navigation and information architecture adapted to CS, PM, and
SA workbenches. Do not create a visually unrelated admin template.

## Page archetypes

### Lists and worklists

- Heading and primary action share one row.
- Search and filters form one quiet toolbar, not separate cards.
- Summary values are inline or in one compact strip.
- Desktop data uses a flat table with a subtle header and row dividers.
- Row actions are visible and named; destructive actions stay secondary.
- Empty and error states occupy the table body and explain the next action.

### Record details and cattle profile

- Identity and current status appear in a compact header.
- Tabs remain directly below the header.
- The active tab uses a two-column reading layout where useful, with only one
  persistent side summary.
- Timelines and histories use rules and dates instead of nested cards.

### Forms and voucher editors

- Related fields are aligned in a grid without putting each group in a box.
- Section boundaries use headings and 24px vertical rhythm.
- Conditional fields appear beside the control that activates them.
- Requiredness is explicit; errors are field-specific and appear after a save
  attempt unless immediate feedback prevents invalid selection.
- Long workflows use one sticky, compact footer containing warnings on the left
  and actions on the right.
- The semantic Back action returns to the owning list or detail route, not a
  stale browser-history state.

### Modal, drawer, and focused editor

- Use a modal for a short decision or a bounded row editor.
- Use a side drawer or full page for a long form that needs context.
- Dialog bodies own their scroll; the footer stays compact and visible.
- Do not let a growing list expand the overlay beyond the viewport.

### Dashboards and reports

- Start with the question the page answers, not a decorative statistic wall.
- Use a single summary band and then the main chart/table.
- Charts use the existing green family plus accessible semantic colors.
- Every chart has a table or textual equivalent.

## Interaction and state rules

- Every screen has loading, empty, error, disabled, read-only, and success
  behavior where applicable.
- Errors say the exact field or rule that failed and the corrective action.
- Role restrictions hide impossible actions and keep useful read-only data.
- Confirmation is reserved for destructive or irreversible actions.
- Status is shown with concise labels; color is never the only signal.
- Tables and dialogs remain keyboard accessible, with visible focus and no
  horizontal page overflow at the agreed viewports.
- Desktop target: 1440x900. Tablet target: 1180x820. Technician phone receives
  dedicated responsive checks.

## Full-pass implementation strategy

The build is organized by shared UI layer, not feature ownership:

1. Consolidate tokens, primitives, shell, navigation, page header, toolbar,
   table, form, message, overlay, footer, and responsive behavior.
2. Create the complete role-aware route and screen registry for SCR-01 to
   SCR-122, mapping nested tabs and dialogs to their owning screens.
3. Render every screen using the appropriate archetype and real Vietnamese
   labels/content from the SRS.
4. Preserve real API adapters on existing cattle, pen, herd-entry, and
   herd-exit screens; use typed development fixtures only where no endpoint is
   available.
5. Compare each archetype against the refined herd-entry reference and remove
   unnecessary borders, cards, radii, grouping, decorative labels, and empty
   space before calling the first pass ready.
6. Run a visual consistency pass across all screens, then begin the user's
   follow-up correction cycle.

This order gives the user a complete product surface to review while preventing
each feature from drifting into its own component style.

## Acceptance criteria for the first pass

- Every SCR-01 to SCR-122 screen has a reachable visual state or is represented
  by an explicitly owned tab/dialog within its parent route.
- Navigation changes correctly by role and viewport.
- No page uses excessive bordered cards or oversized radii.
- Forms, tables, overlays, actions, and errors use the same primitives.
- Existing backend-connected cattle, pen, entry, and exit flows remain
  connected and are not replaced with local-storage demos.
- Missing backend coverage is clearly marked as development fixture data.
- Pages do not overflow horizontally at 1440x900 or 1180x820; overlays keep
  actions visible and scroll internally.
- The technician flow is usable at a phone viewport.
- Frontend typecheck and production build pass.
- Runtime review distinguishes manual visual evidence from automated tests.

## Known risks

- The latest SRS increases the product to 122 screens, while the current router
  implements only cattle, pen, herd entry, and herd exit; the first pass is a
  large UI surface and should be reviewed in checkpoints even though it uses
  one visual system.
- Several screens may lack backend operations. Visual completeness cannot be
  claimed as functional completeness.
- Figma evidence is incomplete for some frames. Intentional completion beyond
  the wireframe must remain traceable to this design and the SRS.
- Existing dirty changes in backend herd-exit files belong to prior work and
  must remain untouched by the UI pass.

## Runtime evidence — 02/11/2026

- SCR-77 Tổng quan trang trại: checked manually at 1440x900 and 1180x820; no horizontal overflow. At 1180px the page is 18px taller than the viewport and scrolls normally.
- SCR-55 Mở ca bệnh: checked manually at 1440x900; required labels, compact action footer, and no horizontal overflow.
- SCR-91 Thanh toán và đối soát: checked manually as PM at 1180x820; platform shell, summary strip, filters, and table remain in the BeefCare visual language; no horizontal overflow.
- SCR-104 Trang chủ kỹ thuật viên: checked manually at 390x844; bottom navigation is present, tasks stack vertically, and no horizontal overflow.
- Development review URLs (`/ui/scr-xx`) bypass authentication and the API-backed store only in Vite development mode. Production builds and real backend routes retain the existing authentication and store providers.
- Runtime console has no application errors on the reviewed fixture routes. The only warnings are React Router v7 future flags; the local development server also requests a missing favicon.
