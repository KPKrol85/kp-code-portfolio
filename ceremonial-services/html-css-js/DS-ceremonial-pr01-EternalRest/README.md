# Eternal Rest — multi-page website

Profesjonalny, wielostronicowy serwis dla domu pogrzebowego Eternal Rest. Projekt jest oparty o HTML, CSS i Vanilla JS, z naciskiem na dostępność, czytelne informacje oraz motyw jasny/ciemny.

## Podgląd
- `index.html` — strona główna
- `o-nas.html` — o firmie
- `uslugi.html` — opis usług
- `cennik.html` — pakiety cenowe
- `formularz.html` — kontakt i formularz
- `poradnik.html` — poradnik i FAQ

## Struktura folderów
```
ceremonial-services/pr-01-eternal-rest/
├── assets/
│   ├── icons/
│   └── illustrations/
├── css/
│   ├── pages/
│   ├── base.css
│   ├── components.css
│   ├── layout.css
│   ├── main.css
│   ├── tokens.css
│   └── utilities.css
├── js/
│   └── main.js
├── scripts/
│   └── convert-images.js
├── cennik.html
├── formularz.html
├── index.html
├── o-nas.html
├── poradnik.html
├── uslugi.html
├── package.json
└── postcss.config.cjs
```

## Uruchomienie lokalne
1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Start serwera developerskiego:
   ```bash
   npm run dev
   ```

## Build produkcyjny
```bash
npm run build
```
Wygenerowane pliki pojawią się w katalogu `dist/`.

## Podgląd wersji produkcyjnej
```bash
npm run preview
```

## Pipeline obrazów
W projekcie nie ma binarnych obrazów. Gdy pojawią się nowe zdjęcia, umieść pliki źródłowe w `assets/src-images/` (PNG/JPG/JPEG) i uruchom:
```bash
npm run images:convert
```
Skrypt zapisze wersje `.webp` i `.avif` w `assets/images/`.

## Dostępność
- Strony używają semantycznych landmarków (`header`, `nav`, `main`, `footer`).
- Menu mobilne obsługuje fokus, klawisz ESC i blokadę przewijania.
- Formularz ma walidację po stronie klienta, komunikaty błędów i komunikat sukcesu.
- Motyw jasny/ciemny respektuje preferencje systemowe i `prefers-reduced-motion`.

