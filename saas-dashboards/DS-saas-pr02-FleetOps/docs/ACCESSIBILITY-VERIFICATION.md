# FleetOps accessibility verification

**Verification date:** 2026-08-11

**Scope:** representative rendered contrast, keyboard operation, focus management, and browser-observable accessibility semantics, plus a limited manual NVDA smoke check

**Automated environment:** Windows; Node.js 22.14.0; npm 10.9.2; Playwright 1.60.0 `Desktop Chrome` using the bundled Chromium headless shell (revision 1223)

**Themes:** light and dark

## Assurance boundary

This record is evidence for the representative checks described below. It is not a declaration of formal WCAG conformance, an accessibility certification, or proof of behavior in every browser and component state.

The browser checks inspect rendered styles, keyboard behavior, focus, roles, accessible names, ARIA states and relationships, and live-region DOM updates. No real screen reader or other external assistive technology was executed during that automated/browser pass itself.

A separate manual screen-reader smoke check has since been performed by the project owner with NVDA on Windows 11 in Google Chrome; its confirmed environment, scope, and observations are recorded in [Manual assistive-technology verification](#manual-assistive-technology-verification). That check was a limited sanity pass, not a comprehensive assistive-technology audit, so it does not establish announcement behavior for every component or scenario, for every screen reader, or for every browser.

## Method

- Contrast was calculated from Playwright-observed computed foreground and effective background colors using the standard sRGB relative-luminance formula.
- Gradient controls were evaluated against every computed gradient stop; the table records the lowest ratio.
- Large-text status was derived from the rendered font size and weight. The tested representative text was normal-size text, so `4.5:1` was the applicable text threshold.
- A `3:1` reference threshold was used for the active form-control boundary and the visible focus indicator.
- Inactive native controls were verified as disabled but were not presented as contrast passes because WCAG contrast requirements exempt inactive controls.
- Both themes were selected through the application's persisted theme contract and measured in the built production artifact.

## Representative contrast evidence

### Light theme

| Page / component | State | Foreground | Background | Ratio | Threshold | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| Home feature card heading | default | `#0f172a` | `#ffffff` | `17.85:1` | `4.5:1` | Pass |
| Home feature card body | muted text | `#4b5563` | `#ffffff` | `7.56:1` | `4.5:1` | Pass |
| Section tag | accent text | `#1d4ed8` | `#e2e9f9` | `5.51:1` | `4.5:1` | Pass |
| Primary action | default gradient, lowest stop | `#ffffff` | `#3863dd` | `5.25:1` | `4.5:1` | Pass |
| Primary action | hover gradient, lowest stop | `#ffffff` | `#2b59da` | `5.94:1` | `4.5:1` | Pass |
| Secondary action | default gradient, lowest stop | `#1c4aca` | `#e2e9f9` | `6.02:1` | `4.5:1` | Pass |
| Primary action | keyboard focus outline | `#1d4ed8` | `#f7f8fb` | `6.31:1` | `3:1` | Pass |
| App navigation | current route | `#0f172a` | `#eff4fe` | `16.20:1` | `4.5:1` | Pass |
| User menu avatar | accent text | `#1d4ed8` | `#e9effd` | `5.83:1` | `4.5:1` | Pass |
| Orders table header | muted text | `#4b5563` | `#eef1f6` | `6.68:1` | `4.5:1` | Pass |
| Status badges | in progress / delayed / delivered / pending | `#0b0d10` | `#bae6fd` / `#fecdd3` / `#bbf7d0` / `#fde68a` | `14.66:1` / `13.79:1` / `16.06:1` / `15.62:1` | `4.5:1` | Pass |
| Modal input | entered text | `#0f172a` | `#f2f5fb` | `16.35:1` | `4.5:1` | Pass |
| Modal input | active control boundary | `#858b95` | `#ffffff` | `3.42:1` | `3:1` | Pass |
| Modal validation | error text | `#dc2626` | `#ffffff` | `4.83:1` | `4.5:1` | Pass |
| Modal validation | invalid boundary | `#dc2626` | `#ffffff` | `4.83:1` | `3:1` | Pass |
| Record drawer | detail label | `#4b5563` | `#f2f5fb` | `6.92:1` | `4.5:1` | Pass |

### Dark theme

| Page / component | State | Foreground | Background | Ratio | Threshold | Result |
| --- | --- | --- | --- | ---: | ---: | --- |
| Home feature card heading | default | `#e9edf5` | `#10141a` | `15.74:1` | `4.5:1` | Pass |
| Home feature card body | muted text | `#9ba7b9` | `#10141a` | `7.58:1` | `4.5:1` | Pass |
| Section tag | accent text | `#7dd3fc` | `#0e252b` | `9.58:1` | `4.5:1` | Pass |
| Primary action | default gradient, lowest stop | `#07111f` | `#3dd8f0` | `11.10:1` | `4.5:1` | Pass |
| Primary action | hover gradient, lowest stop | `#07111f` | `#34d7ef` | `10.88:1` | `4.5:1` | Pass |
| Secondary action | default gradient, lowest stop | `#86d5fb` | `#0e2329` | `10.01:1` | `4.5:1` | Pass |
| Primary action | keyboard focus outline | `#7dd3fc` | `#0b0d10` | `11.67:1` | `3:1` | Pass |
| App navigation | current route | `#e9edf5` | `#11252c` | `13.55:1` | `4.5:1` | Pass |
| User menu avatar | accent text | `#7dd3fc` | `#132b33` | `8.87:1` | `4.5:1` | Pass |
| Orders table header | muted text | `#9ba7b9` | `#171b22` | `7.09:1` | `4.5:1` | Pass |
| Status badges | in progress / delayed / delivered / pending | `#0b0d10` | `#bae6fd` / `#fecdd3` / `#bbf7d0` / `#fde68a` | `14.66:1` / `13.79:1` / `16.06:1` / `15.62:1` | `4.5:1` | Pass |
| Modal input | entered text | `#e9edf5` | `#161b23` | `14.73:1` | `4.5:1` | Pass |
| Modal input | active control boundary | `#6f7886` | `#10141a` | `4.13:1` | `3:1` | Pass |
| Modal validation | error text | `#f87171` | `#10141a` | `6.68:1` | `4.5:1` | Pass |
| Modal validation | invalid boundary | `#f87171` | `#10141a` | `6.68:1` | `3:1` | Pass |
| Record drawer | detail label | `#9ba7b9` | `#161b23` | `7.10:1` | `4.5:1` | Pass |

The maintained contrast test covers 48 rendered evidence rows. Set `FLEETOPS_ACCESSIBILITY_EVIDENCE=1` when running `tests/accessibility.spec.js` to print the complete machine-readable evidence array.

## Keyboard and browser accessibility verification

- **Skip link:** `Tab` exposes and focuses the link; `Enter` moves focus to the public or application `main#main-content` target.
- **Public mobile navigation:** `Enter` opens the drawer and focuses its first link; `Shift+Tab` and `Tab` wrap inside the intentional trap; `Escape` closes it and returns focus to the trigger. Overlay `role`, `aria-modal`, `aria-hidden`, and `aria-expanded` remain synchronized.
- **Accordion:** `Space` and `Enter` toggle the disclosure; `aria-expanded`, `aria-controls`, visibility, and `hidden` stay synchronized.
- **Login and routes:** the demo login works from the keyboard; route changes update the polite `#fleetops-route-status` region (`Widok: Przegląd`, `Widok: Zlecenia`) and the current route exposes `aria-current="page"`.
- **Modal:** opening by `Enter` moves focus into the named dialog; `Tab` and `Shift+Tab` remain contained; `Escape` closes it and restores focus to the opener.
- **Application drawer and record drawer:** existing browser coverage verifies viewport-conditional dialog semantics, containment, `Escape`, backdrop close, and focus return.
- **Dropdown:** existing browser coverage verifies disclosure state, `aria-controls`, `Escape`, closure, and focus return without introducing menu roles for ordinary button/link collections.
- **Form errors:** fields are connected to stable error IDs through `aria-describedby`; invalid fields receive `aria-invalid="true"`; error text and invalid boundaries meet the recorded contrast thresholds.
- **Toasts:** stable polite `role="status"` and assertive `role="alert"` regions expose `aria-live` and `aria-atomic`; representative success and permission-denial updates reach the correct region.
- **Focus visibility:** the representative primary action retained a solid 2 px computed outline; its light/dark contrast is recorded above.

These observations establish browser/DOM behavior only. They do not prove that a particular screen reader announces the content with specific wording or timing. Separately observed real screen-reader output is recorded below and is kept distinct from this automated evidence.

## Manual assistive-technology verification

**Type:** manual NVDA smoke check (limited scope), performed by the project owner

**Environment:** Windows 11; NVDA (version not recorded); Google Chrome

**Result:** Pass for the exercised smoke-check scope only.

Observed during the session:

- NVDA read FleetOps page content; general page reading worked throughout the check.
- Application route announcements were audibly exposed by NVDA; the confirmed examples were `Widok: Zlecenia` and `Widok: Flota`.
- Speech could sometimes continue finishing previously started content when moving quickly to another element, producing a short perceived delay. This was observed as normal screen-reader speech-queue behavior during the session and was not confirmed as a FleetOps defect.
- No blocking accessibility failure was observed during this check.

Scope actually exercised: general page reading and application route announcements. This was a sanity/smoke check rather than a systematic audit — it did not systematically cover all toast variants, form error announcements, modal or drawer entry and exit announcements, accordion state wording, skip-link announcements, or every interactive component. The result covers NVDA with Google Chrome on Windows 11 only, and because the NVDA version was not recorded it is not tied to a specific NVDA release.

## Confirmed corrections

| Confirmed defect | Baseline evidence | Source correction | Reverification |
| --- | --- | --- | --- |
| Light accent text on an accent-tinted background | section tag `4.25:1` | strengthened the canonical light `--accent`/`--accent-strong` pair after tracing all consumers | tag `5.51:1`; avatar `5.83:1`; focus remained `6.31:1` |
| Light primary gradient action | lowest stop `4.18:1` | same canonical light accent correction | default `5.25:1`; hover `5.94:1` |
| Active form-control boundary in both themes | light `1.24:1`; dark `1.22:1` | form controls now derive a theme-aware boundary from muted text and the owning surface | light `3.42:1`; dark `4.13:1` |
| Light error text | `2.77:1` | light `--danger` is `#dc2626`; dark keeps the already-passing `#f87171` | light `4.83:1`; dark `6.68:1` |
| Public skip-link target did not receive focus | fragment navigation left `main#main-content` inactive | public shell makes the existing main target programmatically focusable with `tabindex="-1"` | keyboard test passes and focus reaches the landmark |

No confirmed accessibility defect is intentionally left unresolved by this pass.

## Checks executed

- Baseline `npm run test:smoke`: 36/36 passed before the corrections.
- Focused `npx playwright test tests/accessibility.spec.js`: 3/3 passed after the corrections.
- JavaScript syntax checks for the changed runtime and test files: passed.
- Final `npm run build`: passed; Vite 7.3.6 transformed 41 modules.
- Final `npm run qa:css-vars`: passed; 973 usages, 77 definitions, 11 source files.
- Final `npm run test:smoke`: 41/41 passed against a fresh production build, re-executed on 2026-08-12 after the hero regression test was corrected to the intrinsic width the maintained hero assets now ship.
- Final `git diff --check`: passed.

## Additional assurance opportunities

Basic real assistive-technology verification is no longer outstanding: the manual NVDA smoke check recorded above passed for the scope it exercised, and no confirmed accessibility defect follows from it. The items below are optional ways to widen assistive-technology assurance, not unresolved defects.

- Extend the same NVDA/Chrome pass across the remaining representative flows — polite and assertive toasts, field errors, modal and drawer entry and exit, accordion state, and skip-link navigation — and record the observed output for each.
- Record the NVDA version used, so a future result can be tied to a specific release.
- Repeat a comparable manual pass with other screen reader, browser, and operating-system combinations, which the current evidence does not cover.
