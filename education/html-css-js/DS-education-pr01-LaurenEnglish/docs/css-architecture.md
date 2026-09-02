# CSS Architecture (token-first)

## Warstwy i odpowiedzialności

- **tokens/** – design tokens (CSS variables), bez selektorów komponentów.
- **base/** – reset, globalne style elementów, bazowa typografia.
- **utilities/** – krótkie klasy pomocnicze `.u-*` bez kontekstu.
- **components/** – komponenty wielokrotnego użytku (np. `btn`, `card`, `form`, `tabs`).
- **sections/** – sekcje strony (np. `hero`, `services`, `materials`, `footer`).
- **pages/** – wyjątki specyficzne dla pojedynczej podstrony (tylko gdy potrzebne).

## Kolejność importów w entry

`tokens → base → utilities → components → sections → pages`

## Naming conventions

- **BEM dla komponentów:** `.component__part`, `.component--variant`.
- **Stany:** `.is-active`, `.is-open`, `.is-disabled`.
- **Utilities:** prefiks `.u-` (np. `.u-flow`).
- **Zakaz:** głębokiego zagnieżdżania typu `.header .nav .btn` (utrzymuj niską specyficzność).

## Variant rules

- Warianty tylko przez modyfikatory `--variant` lub data-attr (jeśli istnieje wzorzec).
- Nie duplikuj komponentów jako osobnych klas typu `buttonPrimary2`.

## Minimal rules for future changes

- **Nowe sekcje →** `sections/`.
- **Nowe UI reużywalne →** `components/`.
- **Krótkie helpery →** `utilities/`.
- **Nowe tokeny →** `tokens/` (z krótkim uzasadnieniem w opisie zmiany).

## Responsive layout baseline

- Wspólne miary kontenera, szerokiego headera i czytelnej treści są tokenami `--layout-*` oraz `--content-measure*`.
- Pełna, ośmioelementowa nawigacja desktopowa włącza się od `1280px`; poniżej tej szerokości działa dostępny drawer, aby etykiety i akcje headera nie były ściskane ani zawijane.
- Siatki używają `minmax(0, 1fr)`, a komponenty o szerokiej treści wewnętrznej muszą ograniczać własny rozmiar zamiast rozszerzać dokument.

## Notatki praktyczne

- Projekt posiada już klasę `.container` (utilities) – traktuj ją jako aktualny helper layoutu, bez duplikowania `.u-container`.
- Utilities i komponenty powinny korzystać z tokenów (`var(--...)`) zamiast twardych wartości.
- Kanoniczne klasy dostępności to `.sr-only` i `.skip-link`; nie twórz równoległych aliasów utilities.
- `base/typography.css` pozostaje udokumentowanym punktem rozszerzenia skali typograficznej, a `components/tabs.css` opisuje współdzielenie wzorców `.filters` i `.pill--filter`.

## Semantyczne role motywu

Tokeny obejmują powierzchnie hero i overlay, półprzezroczysty header, tekst na kolorze głównym, granice kontrolek, powierzchnie interaktywne i wyłączone, status sukcesu, dostęp premium oraz dwukolorowy focus ring. Każda z tych ról ma jawną wartość light i dark w `tokens/tokens.css`.

Kolory surowe poza warstwą tokenów nie są obecnie potrzebne. Lokalnymi wyjątkami liczbowymi pozostają wyłącznie wartości zależne od geometrii konkretnego komponentu, między innymi maksymalne szerokości kontenera, hero i tabeli postępów, szerokość drawer oraz wymiary drobnych ikon.

Użycia `!important` są ograniczone do wymuszenia atrybutu `[hidden]` oraz globalnego wyłączenia ruchu w `prefers-reduced-motion`; te przypadki celowo wygrywają z regułami komponentów.

Weryfikacja:

```powershell
npm run check:css
```
