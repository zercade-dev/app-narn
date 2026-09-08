# Third-Party Notices

NARN redistributes third-party code in three forms, and this file covers all three:

1. **Vendored source** — third-party source copied into this repository and maintained
   here rather than installed. Two cases: the shadcn/ui interface primitives (see
   _Vendored source: shadcn/ui_), and the Copilot SDK type declarations in
   `modules/copilot/src/sdk.ts`, copied from that SDK's own `.d.ts` files so the package
   need not be imported statically — covered by the MIT licence reproduced under
   _GitHub Copilot_.
2. **Font binaries built into the frontend** — six typeface families whose `.woff2` and
   `.woff` binaries are redistributed by every production build. See _Fonts_.
3. **Declared dependencies** — packages named in `package.json` manifests and fetched
   from the public npm registry at install time, each under its own licence. GitHub's
   proprietary Copilot CLI used to be one of them; `@github/copilot-sdk` 1.0.13 dropped
   that dependency. See _GitHub Copilot_.

One of those attaches conditions that travel with anything NARN ships: the SIL Open Font
License on the fonts, which requires their copyright notices and licence to accompany the
font files. It is reproduced below in full. The permissive licences covering the rest
(MIT, Apache-2.0, ISC, BSD) attach conditions too,
chiefly that their copyright and permission notices be retained. Where NARN is distributed
as source, those notices travel inside the installed `node_modules` tree. The production
frontend bundle is built with all comments stripped, so they do not survive inside its
JavaScript and CSS; the build reproduces them alongside it instead, in `dist/LICENSES.txt`
— see _Notices and the built frontend_.

Third-party material that is not code is covered elsewhere in this repository and is not
duplicated here: the bundled global glossaries under
`packages/server/src/data/global-glossaries/` reference third-party game-franchise
terminology and carry their own `NOTICE.md` alongside this repository's `TRADEMARKS.md`;
and `packages/shared/src/ai-sdk-provider/pricing-data/provider-pricing.json` holds model
pricing figures compiled from each provider's public pricing pages, recording a
`sourceUrl` per provider.

## Vendored source: shadcn/ui

The frontend's user-interface primitives, chiefly under
`packages/frontend/src/components/ui/`, originate from the
[shadcn/ui](https://ui.shadcn.com) registry, whose distribution model is to copy source
into the consuming repository rather than install it. Two of those files say so in their
own opening comments — `ui/sidebar.tsx` ("Vendored shadcn sidebar block") and
`ui/combobox.tsx` ("Intentionally-complete vendored shadcn/Base UI Combobox primitive") —
and the directory holds the registry's standard primitives (button, card, dialog, sheet,
tabs, select, tooltip, popover, checkbox, table and siblings) alongside components written
for NARN. `packages/frontend/components.json` is the registry's own configuration file.

"Chiefly", because at least two small pieces sit outside that directory: the `cn()` helper
in `packages/frontend/src/lib/utils.ts` (alongside functions written for NARN), and the
registry's `use-mobile` hook, carried here as
`packages/frontend/src/hooks/use-mobile-viewport.ts`. Both are covered by the same licence
below. That pair was found by inspection, not by diffing this tree against the upstream
registry, so treat it as the known cases rather than a guaranteed-complete list.

The `shadcn` npm package (its CLI, used to scaffold and add these components) was itself a
development dependency until 2026-08-03, when it was removed: the package bundles
`@modelcontextprotocol/sdk` for an unused `shadcn mcp` feature, which pulled in vulnerable
transitive dependencies (`hono`, `@hono/node-server`) unrelated to anything this repo uses
it for. `packages/frontend/src/index.css` used to import that package's stylesheet
(`shadcn/tailwind.css`); its CSS was ejected — inlined verbatim via the package's own
`shadcn eject` command — into `index.css` directly as part of that removal, so it still
ships in the built frontend but is no longer resolvable as an installed package. The MIT
notice below now covers vendored source only, not a live dependency; it can no longer be
verified against an installed copy and is current as of `shadcn@4.16.1`, the version in use
at removal.

shadcn/ui is MIT-licensed. Its notice is reproduced in full:

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Base UI is a dependency, not vendored code

The vendored components above are built on **Base UI** primitives, which is why
`ui/combobox.tsx` describes itself as a "shadcn/Base UI" component. No Base UI source is
vendored into this repository: `@base-ui/react` is a declared dependency, imported from
the installed package like any other. It is MIT-licensed and ships its own `LICENSE` file
in the installed tree. That file is present wherever NARN is installed from source. The
production frontend bundle contains `@base-ui/react`'s minified code with its comments
stripped, and that same `LICENSE` file is reproduced verbatim in the `dist/LICENSES.txt`
the build emits beside it — see _Notices and the built frontend_.

## Fonts

The built frontend embeds six typeface families, all licensed under the **SIL Open Font
License, Version 1.1**:

| Family         | Package                           | Loaded by                                     |
| -------------- | --------------------------------- | --------------------------------------------- |
| Geist          | `@fontsource-variable/geist`      | `src/index.css` — the default interface font  |
| Geist Mono     | `@fontsource-variable/geist-mono` | `src/index.css` — monospace                   |
| Silkscreen     | `@fontsource/silkscreen`          | `src/themes/theme-registry.ts` — pixel theme  |
| Press Start 2P | `@fontsource/press-start-2p`      | `src/themes/theme-registry.ts` — pixel theme  |
| Chakra Petch   | `@fontsource/chakra-petch`        | `src/themes/theme-registry.ts` — techno theme |
| Orbitron       | `@fontsource/orbitron`            | `src/themes/theme-registry.ts` — techno theme |

All six are declared as **production** dependencies of `packages/frontend`. They are
consumed through the build rather than imported by server code, and they were declared as
development dependencies for that reason until the redistribution described below was
written down: because `pnpm licenses list --prod` excludes development dependencies,
`OFL-1.1` then appeared in none of the licence categories that command reports, and the fact
that NARN redistributes these font files was invisible to that tooling. Moving the six is
what fixed that; the build output is unchanged either way. A production build redistributes
**49 font binaries** across the six families, in two shapes:

- **40 emitted as static asset files** — 26 `.woff2` and 14 `.woff` under `dist/assets/`;
- **9 embedded directly in the built CSS** as `data:font/woff2;base64` and
  `data:font/woff;base64` URIs, because they fall under the bundler's inline-asset size
  threshold. These are invisible to a file listing of the build output, which is why the
  distinction is spelled out here: Silkscreen 400 and 700, Press Start 2P 400, and Chakra
  Petch 500 and 600 each ship at least one inlined binary.

Every deployment that serves the frontend serves all 49. The OFL requires that its
copyright notices and licence accompany the font files wherever they are redistributed,
which is what this section does.

### Copyright notices

Reproduced verbatim from the `LICENSE` file shipped inside each installed package. Note
the Reserved Font Name on Press Start 2P: under the OFL that name may not be used to
identify a modified version of the font.

`@fontsource-variable/geist`

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font) Geist-Italic[wght].ttf: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font)

`@fontsource-variable/geist-mono`

Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git) GeistMono-Italic[wght].ttf: Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font.git)

`@fontsource/chakra-petch`

Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-LightItalic.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-Regular.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-Italic.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-Medium.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-MediumItalic.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-SemiBold.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-SemiBoldItalic.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-Bold.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git) ChakraPetch-BoldItalic.ttf: Copyright 2018 The Chakra Petch Project Authors (https://github.com/m4rc1e/Chakra-Petch.git)

`@fontsource/orbitron`

Copyright 2018 The Orbitron Project Authors (https://github.com/theleagueof/orbitron)

`@fontsource/press-start-2p`

Copyright 2012 The Press Start 2P Project Authors (cody@zone38.net), with Reserved Font Name "Press Start 2P"

`@fontsource/silkscreen`

Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen) Silkscreen-Bold.ttf: Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen)

### SIL Open Font License, Version 1.1

The six packages' licence files carry byte-identical copies of the OFL text (verified by
comparing them), so it is reproduced once here and applies to all six families listed
above. It is shown in a code block so that no formatting tool rewrites the licence's own
clause numbering:

```text
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Notices and the built frontend

The two sections above reproduce notices for material this repository carries. This one
records something a reader cannot see from the repository alone: **the production frontend
build strips every comment from its output by design**, so the licence notices that
ordinarily ride along inside library source do not survive into it — and what the build
does instead, which is to reproduce them beside the bundle.

The stripping is unchanged and deliberate. `packages/frontend/vite.config.ts` runs a
`strip-comments` plugin over the emitted HTML, CSS and JS and then asserts that none
survive — its own comment names Tailwind's `/*! tailwindcss … */` banner as the motivating
case. Measured against a build: **zero** `@license` annotations, **zero** `/*!` banners and
**zero** occurrences of "copyright", case-insensitive, across all 223 JavaScript chunks and
all 11 stylesheets. That measurement still holds.

### `dist/LICENSES.txt`

The same build emits an aggregated licence file into its output directory, next to
`index.html` and `assets/`. `packages/frontend/build/licenses.mjs` is the plugin that
writes it. What it contains:

- **One entry per third-party package whose code, styles or font files are in that
  build** — 93 packages in the build measured on 2026-09-08, among them React, react-dom,
  `@base-ui/react`, zustand, lucide-react, sonner, react-markdown, i18next, clsx,
  `class-variance-authority`, tailwind-merge, `@tanstack/react-virtual`, all six font
  families, and the AI SDK packages the shared code pulls into the frontend.
- **Each package's own licence text, copied verbatim from a file in its installed
  directory** — its `LICENSE`, `LICENSE.md` or equivalent, with the copyright lines that
  file actually carries. No text is generated from an SPDX identifier or a template.
- **A closing section naming any bundled package that ships no licence file at all**,
  with the licence its manifest declares. In the measured build that is one package,
  `@ai-sdk/provider-utils`. A bundled package with neither a licence file nor a declared
  licence fails the build rather than being dropped silently.

The package list is derived from the build output itself — the modules the bundler placed
in the emitted chunks, the module graph behind them, and the source paths of every emitted
asset — rather than from a `package.json`. That is deliberate: a manifest-derived list
answers a different question, and `pnpm licenses list --prod` excluding development
dependencies is exactly how six font families went unattributed (see _Fonts_). One entry
is the exception and is marked `[stylesheet]` in the file: `tailwindcss` is
pulled in by `src/index.css` and resolved inside Tailwind's own plugin, so its CSS ships
without the package ever becoming a module the bundler reports. It is named
explicitly in `build/licenses.mjs`, and its licence text is read from the installed
package like every other; a name there that no longer resolves fails the build. That
guard runs in one direction only: a package **removed** from the stylesheet is caught, but
a **newly added** bare-specifier `@import` would go unattributed silently until someone
adds it to that list.

What `LICENSES.txt` does not cover: code the bundler generates or injects itself, which
belongs to no package directory — Vite's `modulepreload` polyfill is the case in this
build (see _What that command does not cover_). Nor does it cover NARN's own source or the
licence NARN is published under, which is `LICENSE` in this repository. It is also
frontend-only: it says nothing about the server's dependency tree, whose packages carry
their own licence files in the `node_modules` the container image does include.

The container image carries the file. `Dockerfile` copies the server's `pnpm deploy --prod`
tree and, separately, `packages/frontend/dist`. The frontend is not part of the server's
dependency graph, so **no frontend `node_modules` reaches the image** — that has not
changed. But `dist` is copied wholesale into `/app/frontend-dist`, so `LICENSES.txt` rides
along with the bundle it describes and lands at `/app/frontend-dist/LICENSES.txt`. Verified
by building an image with the same `COPY --from=builder … /app/frontend-dist` and listing
the result. The server serves that directory as static files, so a running instance also
answers for it at `/LICENSES.txt`.

This file still does not assert that the arrangement satisfies every one of those
libraries' licences, and it is not the place to decide the question. What changed is the
fact underneath it: the permissive licences involved (MIT, Apache-2.0, ISC, BSD) require
that their copyright and permission notices be retained in copies of the software, and
those notices now accompany the distributed bundle in `LICENSES.txt` instead of being
absent from it. Anyone redistributing a NARN frontend build, or an image containing one,
should keep that file with it.

## GitHub Copilot

NARN ships a GitHub Copilot translation provider in `modules/copilot`, one of nine
translation providers. It reaches Copilot through `@github/copilot-sdk`, which is
licensed MIT.

Up to and including SDK 1.0.11 it also depended on `@github/copilot` — GitHub's Copilot
CLI — which is **proprietary**, and this file reproduced that licence in full. SDK 1.0.13
dropped the dependency; no 1.0.12 was ever published, so those two releases are adjacent.
Neither the CLI nor its eight `@github/copilot-{linux,linuxmusl,darwin,win32}-{x64,arm64}`
platform packages is installed by NARN any more, at any version, so their licence is no
longer reproduced here.

The SDK now selects a platform binary at install time from its own eight sibling packages,
`@github/copilot-sdk-{linux,linuxmusl,darwin,win32}-{x64,arm64}`, declared under its
`optionalDependencies` and published in lockstep at the SDK's own version. The one
matching the host carries the Copilot runtime binary the provider talks to.

### What "optional" means here

`@github/copilot-sdk` is declared under `optionalDependencies` in
`modules/copilot/package.json`. **That does not exclude it from a normal install.** npm
and pnpm install optional dependencies by default, so a plain `pnpm install` fetches the
SDK and the platform binary matching the machine doing the install.

What the optional declaration buys is that opting out is _possible_:
`pnpm install --no-optional` skips both packages. NARN is written so that this degrades
rather than breaks. Nothing in the codebase imports `@github/copilot-sdk` statically —
the sole reference is a runtime `import()` of a variable deliberately typed as `string`,
so the compiler never resolves it — which means the Copilot provider still compiles,
loads and registers without the package present. Only an actual Copilot translation
resolves the SDK, and if it is missing that one call fails with an install hint instead of
taking the provider registry down at import time. A given NARN installation may therefore
carry the Copilot runtime or not, depending on how it was installed.

### Unmodified redistribution

NARN does not modify the Copilot SDK or its platform binary, rebuild them, patch them, or
copy any part of them into this repository. They are installed from GitHub's own published
packages, and the runtime binary is run as a separate process, spoken to over JSON-RPC on
stdio. Wherever a NARN installation or container image includes them, they are present
exactly as GitHub published them, with all copyright, trademark and attribution notices
intact.

### Availability in the hosted service

The Copilot provider is available for local and self-hosted use. It is disabled in the
hosted NARN service: `modules/copilot/manifest.json` sets `"cloudDisabled": true`.

### `@github/copilot-sdk` — MIT License

`@github/copilot-sdk` 1.0.13 declares `"license": "MIT"` and `"author": "GitHub"` in its
manifest, but its published tarball contains no licence file. The text below is the
`LICENSE` file of the source repository that same manifest names,
<https://github.com/github/copilot-sdk>.

The eight `@github/copilot-sdk-{linux,linuxmusl,darwin,win32}-{x64,arm64}` platform
packages are published at the SDK's own version. Only the one matching the host is
installed, so it is the only one this file can measure: its manifest declares
`"license": "MIT"` and names that same repository, and like the SDK it ships no licence
file of its own.

MIT License

Copyright GitHub, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## The full dependency licence list

Rather than enumerate several hundred packages here, in a list that would be stale the
week after it was written, read it off the installed tree:

```bash
pnpm install
pnpm licenses list --prod          # add --json for machine-readable output
```

Measured on 2026-09-08 on a linux-x64 host, that command reported **248** packages: 217
MIT (among them `@github/copilot-sdk` and `@base-ui/react`), 14 Apache-2.0, 8 ISC, 6
OFL-1.1 — the six font families, see _Fonts_ — 1 BSD-2-Clause, 1 BSD-3-Clause, and 1
`(AFL-2.1 OR BSD-3-Clause)`. Every package in that frame names an SPDX identifier. The two
entries pnpm previously reported as `Unknown` were `@github/copilot` and the platform
binary it pulled in, whose manifests pointed at a licence file instead; both left the tree
when SDK 1.0.13 dropped the CLI dependency. No copyleft licence appears among those 248.

The host matters to what that list names. At least three of the 248 are platform-specific
— `@github/copilot-sdk-linux-x64` (MIT), `@koromix/koffi-linux-x64` (MIT) and
`@typescript/typescript-linux-x64` (Apache-2.0) — so running the same command on macOS or
Windows substitutes different packages in more than one licence category.

### What that command does not cover

`--prod` excludes development dependencies, so the list above is not by itself a complete
picture of what NARN redistributes. Two things fall outside it, and both are handled
elsewhere in this file:

- **CSS from an MIT development dependency** bundled into the built stylesheet:
  `tailwindcss`. It ships its own licence file in the installed tree.
- **Vendored shadcn/ui CSS** (`shadcn/tailwind.css`, ejected into `src/index.css` — see
  _Vendored source: shadcn/ui_). It is no longer an installed dependency at all, so it is
  covered only by the notice reproduced above, not by `dist/LICENSES.txt`.
- **Vite's own `modulepreload` polyfill**, injected into the bundle by the build (6
  occurrences across 2 chunks). `vite` is an MIT development dependency, and this is its
  code shipping in the output — the same category as the CSS above.

All three are generated, injected or vendored-inline rather than a redistributed installed
file, which is what distinguishes them from the fonts. The six font families were on this
list too, for the same reason, until they were moved to production dependencies precisely
so that `--prod` would report them; they are in the census above, as `OFL-1.1`. The first
bullet is covered by the licence file the build emits — `tailwindcss` is in
`dist/LICENSES.txt`, marked `[stylesheet]`; the second is covered by the reproduced notice
in this file instead; the polyfill in the third is not covered by either, because it
belongs to no bundled package directory. See _Notices and the built frontend_.

One development dependency does carry a copyleft licence — `@axe-core/react` (MPL-2.0),
an accessibility auditing tool. It is loaded behind an `import.meta.env.DEV` guard in
`packages/frontend/src/main.tsx` and is absent from production builds (verified against
the built output), so it is not redistributed.

Finally, the claim that installed packages carry their own licence files is the norm rather
than a rule. Of the 248, eight ship none: `@ai-sdk/provider-utils`, `@github/copilot-sdk`,
`@github/copilot-sdk-linux-x64`, `@koromix/koffi-linux-x64`, `agent-base`,
`https-proxy-agent`, `pg-types` and `pgpass`. Each declares its licence in its manifest;
the two `@github/copilot-sdk` packages are the ones that mattered here, which is why the
SDK's MIT text is reproduced above from its source repository.
