# Third-Party Notices — Axiom

This file is the third-party attribution index for the Axiom project. It records the
third-party materials redistributed in this repository, their upstream sources, and the
licenses they are covered by.

These materials are **not** covered by the proprietary KP_Code project license in
[LICENSE](LICENSE). Rights to them remain with their respective authors, and they remain
subject to their own upstream license terms, as stated in section 8 of [LICENSE](LICENSE).
This file records attribution only; it does not replace, restrict, or extend the upstream
license terms. The binding text for each item is the license file linked in its entry.

Licenses of the development dependencies are listed separately in section 8 of
[LICENSE](LICENSE).

**Zakres (PL):** niniejszy plik jest indeksem atrybucji materiałów podmiotów trzecich
w projekcie Axiom. Wymienione poniżej materiały nie są objęte własnościową licencją
KP_Code z pliku [LICENSE](LICENSE) i pozostają objęte własnymi licencjami swoich autorów.
Plik ten nie zastępuje tych licencji — wiążąca jest treść wskazanych plików licencyjnych.

## Fonts

The project self-hosts two font families as WOFF2 files. Both are licensed under the
SIL Open Font License, Version 1.1. Condition 2 of that license requires each redistributed
copy of the font software to contain the copyright notice and the license, which is why the
upstream `OFL.txt` is stored next to the font files of each family.

Each family keeps its own copy of `OFL.txt` because the upstream copyright notices differ.
The license text itself is identical in both files.

### Lato

- **Files in this repository:**
  - [assets/fonts/lato-v25-latin/lato-v25-latin-regular.woff2](assets/fonts/lato-v25-latin/lato-v25-latin-regular.woff2)
  - [assets/fonts/lato-v25-latin/lato-v25-latin-700.woff2](assets/fonts/lato-v25-latin/lato-v25-latin-700.woff2)
- **Upstream source:** the `ofl/lato` family directory of the Google Fonts repository
  (<https://github.com/google/fonts/tree/main/ofl/lato>), whose `METADATA.pb` declares the
  family source repository <https://github.com/googlefonts/LatoGFVersion>
- **Designer (upstream `METADATA.pb`):** Łukasz Dziedzic
- **License:** SIL Open Font License, Version 1.1
- **Copyright notice (upstream `OFL.txt`):** Copyright (c) 2010-2014 by tyPoland Lukasz
  Dziedzic (team@latofonts.com) with Reserved Font Name "Lato"
- **Copyright notice embedded in the redistributed files:** Copyright (c) 2010-2011 by
  tyPoland Lukasz Dziedzic with Reserved Font Name "Lato". Licensed under the SIL Open Font
  License, Version 1.1.
- **License text in this repository:** [assets/fonts/lato-v25-latin/OFL.txt](assets/fonts/lato-v25-latin/OFL.txt)

### Montserrat

- **Files in this repository:**
  - [assets/fonts/montserrat-v31-latin/montserrat-v31-latin-regular.woff2](assets/fonts/montserrat-v31-latin/montserrat-v31-latin-regular.woff2)
  - [assets/fonts/montserrat-v31-latin/montserrat-v31-latin-600.woff2](assets/fonts/montserrat-v31-latin/montserrat-v31-latin-600.woff2)
- **Upstream source:** the `ofl/montserrat` family directory of the Google Fonts repository
  (<https://github.com/google/fonts/tree/main/ofl/montserrat>), whose `METADATA.pb` declares
  the family source repository <https://github.com/JulietaUla/Montserrat>
- **Designers (upstream `METADATA.pb`):** Julieta Ulanovsky, Sol Matas, Juan Pablo del Peral,
  Jacques Le Bailly
- **License:** SIL Open Font License, Version 1.1
- **Copyright notice (upstream `OFL.txt`, identical in both upstream repositories):**
  Copyright 2024 The Montserrat.Git Project Authors
  (https://github.com/JulietaUla/Montserrat.git)
- **Copyright notice embedded in the redistributed files:** Copyright 2011 The Montserrat
  Project Authors (https://github.com/JulietaUla/Montserrat)
- **License text in this repository:** [assets/fonts/montserrat-v31-latin/OFL.txt](assets/fonts/montserrat-v31-latin/OFL.txt)

## Icons

### Font Awesome Free

- **Material in this repository:** the GitHub, Facebook, Instagram and X brand glyphs, kept
  as the `viewBox` and `path` data of the icon registry in
  [js/components/icons.js](js/components/icons.js). Only the geometry of each glyph is
  redistributed; no Font Awesome font file, stylesheet, or package is bundled, and nothing
  is loaded from a CDN.
- **Upstream source:** Font Awesome Free v7.3.1 (<https://fontawesome.com>), brands set
- **Author:** Fonticons, Inc.
- **License:** the icons of Font Awesome Free are licensed under CC BY 4.0
  (<https://creativecommons.org/licenses/by/4.0/>), as stated by the project's combined
  license page
- **License text:** <https://fontawesome.com/license/free>
- **Attribution:** icons by Font Awesome — Fonticons, Inc., used under CC BY 4.0.
