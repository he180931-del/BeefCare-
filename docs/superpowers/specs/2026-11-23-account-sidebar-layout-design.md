# Account Sidebar Layout Design

## Intent

Make the shared account area feel less empty and less compressed by moving its two destinations into a desktop sidebar and giving the profile form more horizontal and vertical breathing room.

## Scope

- Keep one shared `AccountShell` for `/tai-khoan` and `/quyen-theo-vai-tro`.
- On desktop, show the title **Tài khoản của tôi** above **Hồ sơ** and **Quyền theo vai trò** in a 220 px left sidebar. The area below the 73 px header is locked to the viewport: the left sidebar stays fixed in its column and only the right content column scrolls vertically.
- Below the desktop breakpoint, keep the navigation horizontal so the content remains usable on narrow screens.
- Widen the profile card and increase spacing between identity, fields, and password action.
- Preserve routes, account data, submit behavior, password behavior, and the shared account menu.

## Approaches

1. **Shared responsive sidebar in `AccountShell` — selected.** Both account pages receive the same navigation and responsive behavior without duplicating layout code.
2. Add a sidebar independently to each page. Rejected because it duplicates navigation and can drift between Profile and Permissions.
3. Keep the top tabs and only widen the card. Rejected because it does not address the empty left side requested by the user.

## Layout

```text
Desktop
┌────────────────┬────────────────────────────────────┐
│ Hồ sơ          │ Page heading            Page action│
│ Quyền theo     │                                    │
│ vai trò        │ Main account content               │
└────────────────┴────────────────────────────────────┘

Narrow viewport
┌─────────────────────────────────────────────────────┐
│ Hồ sơ │ Quyền theo vai trò                          │
├─────────────────────────────────────────────────────┤
│ Main account content                                │
└─────────────────────────────────────────────────────┘
```

The existing BeefCare palette, typography, rounded panels, and focus behavior remain unchanged. The sidebar uses the same dark-green tokens as the operational sidebar. Its top padding is 8 px (about 30% less than the 12 px side and bottom padding). The right scroll container begins immediately below the navbar, while 48 px top and bottom padding remain inside that container; therefore the initial content position is unchanged and the last content is not clipped at the viewport bottom. On narrow screens the document keeps normal page scrolling instead of creating nested scroll areas.

## Verification

- Component test proves the account navigation uses a full-height desktop column, the viewport region does not scroll, and only the right content column has vertical overflow.
- Component test proves the profile card is no longer capped at 760 px and its major sections have increased spacing.
- Run account-focused unit tests, frontend typecheck, build, and manual browser checks at 1180×820 and 1440×900 when the local authenticated route is available.
