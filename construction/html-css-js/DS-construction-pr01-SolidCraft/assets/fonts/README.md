# Font licensing and provenance

This directory contains the third-party typefaces that SolidCraft self-hosts.
Both families are licensed under the **SIL Open Font License, Version 1.1**.
The full, unmodified license text is stored beside the binaries in
[`OFL-1.1.txt`](OFL-1.1.txt).

These fonts are **not** covered by the project's proprietary license. The
KP_CODE Proprietary Project License in [`LICENSE`](../../LICENSE) applies only
to material owned by the rights holder; it neither replaces nor relicenses the
font software described here, which remains under the OFL 1.1 terms of its
respective copyright holders.

## Montserrat

Six files, weights 400/600/700, each split into the `latin` and `latin-ext`
subsets.

| File                                     | Weight | Subset      |
| ---------------------------------------- | ------ | ----------- |
| `montserrat-v31-latin-regular.woff2`     | 400    | `latin`     |
| `montserrat-v31-latin-ext-regular.woff2` | 400    | `latin-ext` |
| `montserrat-v31-latin-600.woff2`         | 600    | `latin`     |
| `montserrat-v31-latin-ext-600.woff2`     | 600    | `latin-ext` |
| `montserrat-v31-latin-700.woff2`         | 700    | `latin`     |
| `montserrat-v31-latin-ext-700.woff2`     | 700    | `latin-ext` |

Evidence read directly from the `name`, `head`, and `OS/2` tables of the
distributed files:

- Copyright: `Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat)`
- Version string: `Version 9.000` (`head.fontRevision` 9.0)
- License URL: <https://openfontlicense.org>
- Vendor ID `ULA`; `fsType` 0 (installable embedding)

Upstream project: <https://github.com/JulietaUla/Montserrat>, which distributes
Montserrat under the OFL 1.1.

## Poppins

Six files, weights 400/500/600, each split into the `latin` and `latin-ext`
subsets.

| File                                  | Weight | Subset      |
| ------------------------------------- | ------ | ----------- |
| `poppins-v24-latin-regular.woff2`     | 400    | `latin`     |
| `poppins-v24-latin-ext-regular.woff2` | 400    | `latin-ext` |
| `poppins-v24-latin-500.woff2`         | 500    | `latin`     |
| `poppins-v24-latin-ext-500.woff2`     | 500    | `latin-ext` |
| `poppins-v24-latin-600.woff2`         | 600    | `latin`     |
| `poppins-v24-latin-ext-600.woff2`     | 600    | `latin-ext` |

Evidence read directly from the `name`, `head`, and `OS/2` tables of the
distributed files:

- Copyright: `Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins)`
- Version string: `4.004` (unique ID `ITFO; Poppins <style>; 4.004b8`)
- License URL: <https://scripts.sil.org/OFL>
- Vendor ID `ITFO`; `fsType` 0 (installable embedding)

Upstream project: <https://github.com/itfoundry/Poppins>, which distributes
Poppins under the OFL 1.1.

## Provenance notes

The following is recorded to keep this file honest about the limits of what the
repository can prove.

- The subset boundaries used by the `unicode-range` declarations in
  `css/modules/tokens.css` match the current Google Fonts `latin` and
  `latin-ext` definitions exactly, and the `v31`/`v24` filename segments match
  the directory versions Google Fonts currently serves for these families.
  Those segments are Google Fonts API directory versions, not the fonts' own
  version numbers, which are recorded above from the binaries themselves.
- The exact download channel, tool, and date used to obtain these files are not
  recorded in the repository and are therefore not claimed here. The files are
  static per-weight instances and are not byte-identical to what the Google
  Fonts API serves for these families today, so no specific upstream release,
  commit, or package origin is asserted.
- The Montserrat binaries carry the copyright string quoted above, which differs
  from the one currently published upstream. The string embedded in the
  distributed files is the one reproduced in `OFL-1.1.txt`.
- The Montserrat `name` table reports family names of the form
  `Montserrat Thin ...`, an instance-naming artifact of the static builds. The
  authoritative weight for each file is the `OS/2.usWeightClass` value listed in
  the table above, which is what the `@font-face` rules declare.
- No binary in this directory embeds a full license text, which is why the
  human-readable `OFL-1.1.txt` is distributed alongside them, as OFL 1.1
  condition 2 contemplates.
