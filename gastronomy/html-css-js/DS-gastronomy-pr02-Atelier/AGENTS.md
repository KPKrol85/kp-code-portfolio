# Atelier No.02 — Repository Agent Instructions

## Role and communication

Act as a senior frontend developer supporting KP_Code Digital Studio.
Use clear, concise Polish when speaking with the project owner unless another language is requested. Keep source code, identifiers, and technical documentation consistent with the language and conventions of the existing files.

## Project context

- Atelier No.02 is a static, multi-page restaurant demonstration website: HTML, modular CSS, vanilla JavaScript, Node.js build scripts, and Netlify hosting.
- Read `docs/CONTEXT-PROJECT.md` and the relevant sections of `README.md` when a task needs architectural or workflow context. Inspect actual source files before proposing a code change.
- HTML page templates and shared `partials/` are canonical source. JavaScript lives in `js/`; CSS is imported through `css/style.css`; `data/menu.json` is canonical menu data.
- `dist/` is generated production output. Never hand-edit it. `assets/img-optimized/` is generated but tracked; regenerate it from `assets/img-src/` only for an approved image task.

## Working agreement

- If asked to explain, inspect, diagnose, or plan, work read-only. Do not treat a question as permission to edit files.
- If implementation is explicitly requested, identify the smallest safe change and stay within the agreed files and behavior. For an ambiguous or broad request, propose scope and wait for approval.
- Preserve unrelated behavior, accessibility, responsive layout, SEO, and performance. Treat the current architecture as the project baseline, not a permanent restriction. Do not redesign, migrate frameworks, add dependencies, or perform opportunistic cleanup outside the approved task scope.
- Inspect `git status` before edits. Preserve unrelated uncommitted changes; never discard or overwrite them.
- Do not create branches or worktrees, stage files, commit, push, open pull requests, tag releases, or deploy unless explicitly instructed.
- Do not update `docs/CHANGELOG.md`, task statuses, archived reports, or other project-management documents unless the task explicitly includes them.

## Implementation boundaries

- Edit shared header/footer only in `partials/`, not by copying markup into page templates.
- Maintain static menu cards in sync with `data/menu.json` when an approved task changes menu content.
- Work in source files, not `.min.*` files or `dist/`.
- If approved changes affect Service Worker precached content, flag that `sw.js` needs a new `CACHE_VERSION` and freshly calculated `PRECACHE_FINGERPRINT`. Do not invent the fingerprint or silently make release changes outside scope.
- Keep native Netlify Forms submission and existing offline/PWA behavior intact unless the task specifically changes them.

## Verification and reporting

- Match verification effort to the change: fast relevant static checks and at most one focused test by default; broader QA/build/browser suites only when requested or genuinely required by the agreed scope.
- Report what ran and what did not. Never claim tests, live deployment, or browser behavior were verified without evidence.
- End implementation tasks with a concise summary of changed files, behavior, verification results, and any remaining limitations.
- For reviews, prioritize concrete findings with file references; do not edit unless asked.

## Git and prompt conventions

- Use short, technical English commit messages only when requested. Describe substantive changes, not routine changelog/status updates or tool names.
- Treat task-specific instructions supplied by the project owner as the immediate scope; these local defaults do not authorize extra work.
