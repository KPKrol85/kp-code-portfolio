# Atelier No.02 — UX Improvements

**Analysis date:** 2026-09-25
**Project type:** Static multi-page demonstration website (HTML, CSS, vanilla JavaScript)
**Analysis mode:** Evidence-based UX improvement review
**Focus:** Project-wide UX

> **Closure note (2026-09-26):** All five UX improvements (IMP-UX-01 to IMP-UX-05) are recorded as COMPLETED, and this report is archived. The analysis date and original selection rationale are preserved; this note adds no new verification result.

## Improvement overview

The site supports browsing a sample menu, exploring grouped gallery images, and sending a project-related message through a Netlify Forms-prepared contact form. Category navigation, menu result announcements, field errors, gallery controls, and fallback pages already provide usable paths. The opportunities below focus on explaining the next action or reducing steps within those existing paths.

## Proposed improvements

### IMP-UX-01 — Offer a one-step reset when menu filters find no dishes

- **Affected journey:** Searching and filtering the full menu.
- **Evidence:** `menu.html:651-666`; `js/features/menu.js:269-270`, `289-325`, `340-356`.
- **Previous experience:** Search text and the selected tag were combined. When no card matched, the page reported “Brak pozycji spełniających kryteria.” Returning to the full menu required clearing the search field and selecting “Wszystko” separately when both criteria were active.
- **Implemented improvement:** A “Wyczyść filtry” button appears beside the no-results message when active criteria find no dishes. It clears pending search input, resets both criteria, restores all cards, updates the existing result announcement, and returns focus to search.
- **Expected user value:** Visitors can recover from an empty result set without working out which active criterion removed the dishes.
- **Implementation scope:** Change the canonical `menu.html` filter area and `js/features/menu.js` filter state; use the existing button styles and result announcement. Keep the current search, tag combination, static menu cards, and no-JavaScript content available.
- **Acceptance criteria:** With a search term and non-default tag producing zero matches, the reset action is visible. Activating it empties the search field, selects “Wszystko” visually and through `aria-pressed`, restores every menu card, updates the result announcement, and hides the reset action. It is absent before filtering and when results are present.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — Added a one-step reset for empty menu filter results, clearing pending search input and both active criteria, restoring all 18 dishes, updating the result announcement, and returning keyboard focus to the search field.

### IMP-UX-02 — State the contact form's length requirements before entry

- **Affected journey:** Completing the contact form.
- **Evidence:** `contact.html:135-136`, `175-189`, `211-214`; `js/features/form.js:34-44`, `96-105`.
- **Previous experience:** The form explained which three fields to supply, but the two-character name and ten-character message thresholds appeared only in JavaScript validation messages after interaction. The labels and field area did not state those thresholds in advance.
- **Implemented improvement:** Persistent Polish hints state the existing two-character name and ten-character message requirements before entry, including without JavaScript. Each field references its hint and existing validation error through `aria-describedby`; errors remain separate and clear after correction without removing the hint.
- **Expected user value:** Visitors can compose valid input on the first attempt and understand a length error in context.
- **Implementation scope:** Update only the canonical contact-form markup and its existing form styles as needed. Preserve native required and email constraints, current JavaScript validation, Netlify form fields and POST action, and the no-JavaScript submission path.
- **Acceptance criteria:** The name and message requirements are visible before typing and are programmatically associated with their fields. On invalid input, each error remains available alongside its hint; correcting the value clears the error without removing the hint. The form's submission and fallback paths remain unchanged.
- **Impact:** Medium
- **Effort:** Small
- **Status:** COMPLETED — Added persistent, accessible length hints to the name and message fields while retaining their existing validation errors and submission behavior.

### IMP-UX-03 — Identify the gallery group inside the lightbox

- **Affected journey:** Moving between enlarged gallery images.
- **Evidence:** `gallery.html:131-153`, `gallery.html:161`, `208`, `255`, `313`, `359`, `405`, `463`, `509`, `555`, `613`, `659`, `705`; `js/features/lightbox.js:127-143`, `200-208`, `224-230`.
- **Previous experience:** The gallery presents four named categories, and lightbox navigation stays within the clicked image's `data-lightbox` group. Inside the overlay, the counter said only the position (for example, `1/3`), so the active category was not stated there.
- **Implemented improvement:** The lightbox resolves the activated link's category from its enclosing section's `aria-labelledby` heading, then keeps that label beside the changing position and in navigation announcements. If no suitable heading is available, it retains the position-only behavior.
- **Expected user value:** Visitors can tell which collection they are browsing, especially after using previous and next controls several times.
- **Implementation scope:** Use category labels already present in canonical `gallery.html` and update the counter and announcement in `js/features/lightbox.js`. Keep the current group boundaries, wrapping, captions, image recovery, and keyboard and touch controls.
- **Acceptance criteria:** Opening an image in each of the four categories displays and announces the matching category with its position. Previous and next keep the category label stable while updating the position; closing and reopening in another category updates it. Gallery links still open the image directly when JavaScript is unavailable.
- **Impact:** Low
- **Effort:** Small
- **Status:** COMPLETED — The lightbox counter and live announcements now identify the active canonical gallery category alongside the image position.

### IMP-UX-04 — Put the 404 page's recovery links in its main content

- **Affected journey:** Recovering from an unavailable page.
- **Evidence:** `404.html:58-74`; `partials/header.html` (shared navigation links to home, menu and gallery).
- **Previous experience:** The 404 message suggested returning home or visiting Menu or Galeria, but its main content contained no links for those actions. Visitors had to use the shared header navigation.
- **Implemented improvement:** The existing recovery list now links directly to the home, full menu and gallery pages using root-relative URLs, while retaining the suggestion to use the shared navigation.
- **Expected user value:** A visitor reaching a missing address has an immediate next step at the point where the error is explained.
- **Implementation scope:** Update the canonical `404.html` content, reusing existing link or button styles. Keep the shared header, 404 status routing, and destination pages unchanged.
- **Acceptance criteria:** The main 404 message offers keyboard-accessible links to `index.html`, `menu.html`, and `gallery.html`, with labels that match their destinations. The existing header navigation and 404 route behavior remain intact.
- **Impact:** Low
- **Effort:** Small
- **Status:** COMPLETED — Added direct recovery links to the home, menu and gallery pages within the existing 404 content.

### IMP-UX-05 — Add a direct onward path after contact submission

- **Affected journey:** Continuing after the contact-form success page.
- **Evidence:** `contact.html:158-167`; `thank-you.html:59-78`.
- **Previous experience:** The form targeted `thank-you.html`. That page gave a confirmation and contact alternatives, but its only in-content navigation returned to the form, which the visitor had just completed; other destinations required the shared navigation.
- **Implemented improvement:** The success content offers “Wróć na stronę główną” linking to `index.html` as the primary action, followed by “Wróć do formularza” linking to `contact.html` in the ghost style. Both native links work without JavaScript and share a consistently spaced, page-specific action layout.
- **Expected user value:** Visitors who have finished their message have an obvious way to continue browsing without returning to the completed task.
- **Implementation scope:** Change only the canonical `thank-you.html` call to action area, using existing link styles. Do not change the form action, success wording, or submission handling.
- **Acceptance criteria:** The success content offers distinct, keyboard-accessible links to `index.html` and `contact.html`; both labels describe their destinations. The current confirmation and contact alternatives remain present.
- **Impact:** Low
- **Effort:** Small
- **Status:** COMPLETED — Added a direct home-page link alongside the existing return-to-form option after contact submission.

## Original selection summary (2026-09-25)

The menu and form items reduce friction in active tasks; the gallery and system-page items clarify orientation and next steps. Each proposal can be implemented independently in canonical source files, with no new service or dependency. All five have narrow implementation boundaries and are candidates for focused development work, subject to review and separate approval.

## Analysis limitations

This review used current canonical source and project documentation. No browser usability session, form delivery, live deployment, or offline cache behavior was verified. Expected benefits are reasoned opportunities, not measured outcomes.
