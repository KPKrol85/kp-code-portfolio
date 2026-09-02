# Pakiety i dostęp do materiałów

## Kanoniczne pakiety

`js/data/packages.js` jest jedynym źródłem publicznych danych pakietów. Stabilne klucze to:

- `start`
- `regular`
- `intensive`

Każdy rekord zawiera publiczną etykietę, anchor strony pakietów, opis rytmu, listę korzyści, grupę docelową, opcjonalne wyróżnienie oraz CTA kontaktowe. `priceLabel: null` oznacza, że repozytorium nie zawiera zatwierdzonej ceny publicznej i renderery nie pokazują ceny.

Homepage i `pakiety.html` korzystają z tych samych rekordów przez build-time renderery w `scripts/content-renderers.mjs`.

## Dostęp do materiałów

`js/data/materials.js` pozostaje jedynym źródłem metadanych materiałów. Materiał premium musi wskazywać jeden z obsługiwanych `packageKey`. Pole `action` określa intencję działania:

- `package` – link do pakietu wyliczony z `packageKey`
- `link` – bezpośredni, działający URL materiału
- `contact` – działająca ścieżka kontaktowa
- `unavailable` – nieinteraktywny komunikat dostępności

`js/data/materialAccess.js` centralnie rozwiązuje etykietę, URL i stan interaktywny. Brakujący lub hash-only URL nigdy nie jest prezentowany jako działająca akcja.

## Weryfikacja i generowanie

```powershell
npm run check:data
npm run build:html
npm run check:html
```

`check:data` weryfikuje klucze pakietów, unikalność materiałów, powiązania premium, stany CTA oraz filtry kategorii, poziomu, formatu i dostępu.
