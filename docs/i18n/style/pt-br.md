# Style guide — Brazilian Portuguese (pt-br)

This locale is **Brazilian** Portuguese, not European Portuguese. Where the two diverge,
Brazilian wins every time — see the traps section for the specific word list.

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/pt-br.md`. This file settles register, control shape, casing,
punctuation, length and placeholder handling.

## Register

**Você**, always. Never _tu_, never _o senhor / a senhora_, and never mesoclisis
(_far-se-á_) — all three read as either regional or bureaucratic, and the English source
is informal-but-professional.

## Control shapes — resolve the control before you translate the string

English writes the same words for a title, a button, a column header and a placeholder.
Portuguese does not. `config:models.select` and `config:models.pickTitle` are
byte-identical in English and are two different controls; they ship “Selecione um modelo”
and “Seleção de modelo”.

The shapes settled for this locale, and they are not re-decided per namespace:

- **Page titles, tab labels, section headings and group headings are noun phrases.**
  `config:routing.title` is “Regras de roteamento”; `backup:createSection` is
  “Criação de backup”, matching its sibling `backup:restoreSection`.
- **Buttons are infinitives**, where the English is a bare verb. `backup:createButton` is
  “Criar backup” — the same English words as the section heading above it, in the other
  shape, which is the whole reason this section exists.
- **A confirm-dialog title takes the infinitive too**, because it names the action you are
  about to authorize rather than a section you are looking at: `config:confirmDeleteTitle`
  is “Excluir projeto”. Keep English's question mark where it has one and leave it off
  where it does not — the source is inconsistent about it, and matching per key is what
  stops a reviewer harmonizing them.
- **Sidebar group headings mirror English's own part of speech**, because English is not
  uniform there either and the difference is load-bearing: `sidebar:groups.project` is
  “Preparação” (noun) while `sidebar:groups.translate` is “Traduzir” (verb). See the
  co-render note below for why the verb is not optional.
- **Table column headers are bare nouns and keep English's abbreviation** where it has
  one: `config:models.colParameters` is “Parâm.”.
- **Select/combobox placeholders are imperatives**: `config:enableModulePlaceholder` is
  “Selecione um módulo para ativar…”.
- **Search-box placeholders are infinitives**, which is the Brazilian convention and the
  one deliberate exception to the line above: `sidebar:searchProjects` is
  “Pesquisar projetos…”.
- **Progress and status text takes the gerund, never a button shape**: `backup:creating`
  is “Criando backup…”.

A word English reuses across controls does not get one rendering. `config:importCsv` is a
card title and ships the noun phrase “Importação de CSV”, while `glossary:exportCsv` is a
button and ships “Exportar CSV”.

## Casing

Sentence case for every control, label, tab and page title. Portuguese capitalizes only
the first word and proper nouns, so `config:templatesTitle` becomes “Templates de projeto”
— one capital. `english-review-notes.md` records that the English Title Case on page
titles is a per-surface design convention with no meaning outside English, so do not
mirror it.

**Two exceptions.** Preserve uppercase where English uses it for layout
(`strings:columns.config` stays “STATUS”, `console:title` stays “CONSOLE”), and preserve
lowercase where a chip is lowercase by design (`strings:compare.cellNeedsReviewBadge` is
“precisa de revisão”). Named legal documents keep their conventional Title Case:
`legal:privacy` is “Política de Privacidade”.

Language names, months and weekdays are lowercase.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: curly doubles, matching the English source after its review.
  Guillemets are a European Portuguese habit — never used here. `sidebar:templateNone`'s
  neighbours show the pattern: `sidebar:templateWarningUnknownModule` is
  “O template referencia um módulo desconhecido: “{{id}}””.
- Ellipsis is the single character `…` (U+2026), never three dots.
- Em dashes in the source stay em dashes, with spaces around them. A hyphen is never a
  dash.
- Follow the current orthographic agreement: no trema, _ideia_ not _idéia_, no accent on
  _voo_ or _leem_.

## Numbers and dates

Decimal comma, thousands point: `config:overflowRatioDescription` writes the default
overflow ratio as 1,75. No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length budgets

**Absolute character counts per class, not a multiple of English.** A ratio is the wrong
unit when the English source is short: `sidebar:legal` is five characters, and no correct
Portuguese rendering of it can be seven and a half.

Two of the six classes share one hard, fixed container: the sidebar is `16rem`
(`SIDEBAR_WIDTH` in `components/ui/sidebar.tsx`) and every label in it — sidebar items
**and the product's tab labels, which are sidebar menu items whose label is the
`truncate` span at `components/layout/Sidebar.tsx:788`** — ellipsizes on overflow.
The usable label width is about 199px of the 256px sidebar, which is roughly 26 characters
of Latin script. The other four classes scroll, auto-size or wrap; the figures below are
derived from the longest value this locale actually ships plus about 20% headroom.

| Class | Budget | Kind | Longest shipped today |
| --- | --- | --- | --- |
| Sidebar item | 26 | **hard** — fixed `16rem`, truncates | 20 (`sidebar:colorText`) |
| Tab label | 26 | **hard** — the same container | 26 (`strings:tabs`, review-translation-ai) |
| In-panel sub-tab | 28 | soft | 23 (`config:routing.tabImportExport`) |
| Table column header | 24 | soft | 19 (`strings:columns.tooltipAchievementSource`) |
| Filter label | 44 | soft | 37 (`strings:filters.clearNewFlags`) |
| Bulk-bar control | 68 | soft | 57 (`strings:bulk.allFilteredSelected`) |

**One label sits exactly at a hard budget** — the Translation AI review tab, at 26
characters. It is the longest label in the sidebar and the only one within two characters
of the limit. Nobody has measured rendered pixel widths for this locale; if that label is
ever seen ellipsized in the running app, the fix is a shorter surface name for that tab
(and its `review:translationAi.title` twin), not a change to this table.

**Measured expansion, over the 1,908 keys this locale shares with English** (one ratio per
shared key): aggregate **1.18**, median **1.18**, 90th percentile **1.56**. Re-derive it
rather than trusting these numbers, and state the population with any figure you quote —
this locale also ships 1,920 keys in total, and a ratio measured over that larger set is a
different number.

## Placeholders

`{{token}}` contents are identifiers and are never translated. Word order around a token
may change freely; every token in the English string must appear exactly once, and none
may be added.

**Only `count` triggers plural selection.** Every other numeric token — `{{total}}`,
`{{maxLength}}`, `{{entryCount}}`, `{{findings}}` and their kind — has no plural key, so
the frame around it must be grammatical at every value it can take. The device this locale
uses almost everywhere is **an invariant noun phrase, then a colon, then the number**:
`strings:pagination.rows` is “Entradas: {{formattedCount}}” rather than a numeral followed
by a counted noun.

**Where the number counts jobs rather than entries, drop the head noun entirely.** A job is
one entry into one target language, so a counted noun promising *entradas* is false on any
multi-language run. `batch:progressAriaLabel` is “Traduzidos: {{completed}} de {{total}}”
and `strings:runs.stringsProgress` is “Concluídos: {{completed}} de {{total}}” — a bare
participle, true whichever the number turns out to count. Both are fed from
`run.completed` / `run.total` (`components/tabs/RunsTab.tsx:962-968`), which
`english-review-notes.md` records as job totals for the `batch:*` counters; it does not
name `stringsProgress`, so this rendering is the safe frame rather than a claim that the
key is in that finding.

That device is also why this locale's word-axis exemption list in
`scripts/i18n-preflight.mjs` holds exactly one word, the invariant preposition `de`: it is
what every remaining ratio frame puts after its first token, and nothing else survives the
token axis.

**The Brazilian hazard is an article or contraction before a token.** _o {{module}}_ is
unsafe (unknown gender) and _do {{module}}_ doubly so, because the contraction bakes the
article in. Put a real noun in front and let it carry both:
`logs:translation.failedModuleDisabled` closes with “o módulo {{module}} está desativado”.

## Plurals

Brazilian Portuguese is a **`one` / `other`** locale for every count this UI can show.
CLDR gives `pt-BR` a third category, `many`, but it selects **only exact millions**
(1000000, 2000000, …; no integer in 0..200 selects it), so it is real per the language's
grammar and unreachable by anything the product renders. `COVERAGE_GAP_GRANDFATHER` in
`scripts/locale-rules.mjs` records exactly this, and `es`/`fr` — the same category shape —
ship zero `_many` keys between them.

**Do not write `_many`.** Running `LOCALE_PARITY_STRICT=pt-br pnpm check:locales` reports
all 41 families as missing it, and that one failure is the documented exception, not a
defect to fix. Every other strict-mode failure is real.

Twelve English families are shaped `key` plus `key_other` with no `key_one`, and the
strict gate refuses the bare-key rescue, so this locale supplies all twelve `_one` forms
and lands at **1,920 keys** rather than English's 1,908. Check English's `_other`, not its
bare key, before writing a singular: `vault:retrySuccess`'s bare key carries no token
while its `_other` carries `{{count}}`, so a correct singular has to carry it too. Write
the bare key count-neutral — once every category exists it is unreachable, and its only
remaining job is to be grammatical if something ever reaches it.

**Two of the twelve are count-neutral in every category, deliberately.**
`logs:translation.queued` and `logs:sourceReview.done` display a non-`count` token while
their family selects on `count`, and the guarantee that the two are the same number lives
in a different file. They lose a singular/plural distinction English has; do not restore
it without re-reading the log-presentation registry and deciding to depend on it.

Do not add a plural family over a plain English key. No shipped locale does it, and every
count English writes as one string is handled with the count-neutral device above.

## Agreement and gender

- **Status badges that render a stored status token are invariant masculine**, matching
  the `es`/`fr` precedent for a value that is mentioned rather than used:
  `strings:compare.cellTranslatedBadge` is “traduzido” and
  `strings:compare.cellReviewedBadge` is “revisado”, even though the implied noun is
  _tradução_.
- **Every other badge agrees with its own referent.** `strings:row.ignored` is “Ignorada”
  and `strings:row.new` is “Nova”, both agreeing with _entrada_.
- **Where the string names the noun, agreement is forced**:
  `strings:compare.cellMarkReviewedAria` is
  “Marcar a tradução de {{language}} como revisada”.
- **Standalone status words agree with whatever noun is invisible.**
  `vault:statusLocked` is “Bloqueado” because _cofre_ is masculine — the same rule that
  makes it feminine in Spanish makes it masculine here.
- **A count-neutral label with no single referent takes generic masculine plural.**
  `config:routing.nSelected` is “Selecionados: {{count}}” (categories, tones and languages
  all pass through it) while `strings:compare.selectedCount` is “Selecionadas: {{count}}”,
  where the referent is always _entradas_.

## Surface names — repeat these verbatim

Every key naming the same surface gets the same rendering, and prose mentioning the
surface repeats it.

| Surface | Rendering | Owning key |
| --- | --- | --- |
| Translations | “Traduções” | `strings:tabs` (strings) |
| Compare | “Comparação” | `strings:tabs.compare` |
| Activity | “Atividade” | `strings:tabs.runs` |
| Orphans | “Órfãos” | `orphans:title` |
| Sharing | “Compartilhamento” | `collab:sharing.pageTitle` |
| Stage details | “Detalhes da fase” | `stage-details:title` |
| Text Styler | “Estilizador de texto” | `colorText:title` |
| Quality | “Qualidade” | `strings:tabs.quality` |
| Global Config | “Configuração global” | `sidebar:globalConfig` |
| Translation Memory | “Memória de tradução” | `sidebar:translationMemory` |
| Backup | “Backup” | `strings:tabs.backup` |

The tab label is the authority in each case, and `config:globalConfigTitle` is
word-for-word identical to its sidebar item on purpose. Two page titles are deliberately
**longer** than their tab: `strings:runs.title` is “Atividade de tradução” and
`legal:title` is “Jurídico e políticas”. Expand them; never shorten them to match and
never invent a third wording.

The five guide group headings are byte-identical in English to their sidebar twins, so
`strings:guide.group*` dictates what `sidebar:groups.*` must say: Preparação, Traduzir,
Revisão, Terminologia, Manutenção. The guide topics append this locale's word for a tab:
`strings:guide.topicGlossary` is “Aba Glossário”.

## Licensed collapses and near-collisions

Each of these is two keys that share a rendering, or nearly do, and each is licensed for a
stated reason. Do not "fix" one without reading the reason.

- **“Traduzir” (group) over “Traduções” (tab).** The sidebar heading renders directly over
  its first child, so the two are painted together. The group takes the **verb** precisely
  to keep them apart — a noun heading would have been one letter from its own child. The
  run-type value `strings:runs.typeTranslation` is “Tradução”, a third distinct form.
- **“Revisão” (group) over the three review tab names.** A proper substring of each, and a
  heading over its own child: licensed structurally. It is never equal to any of them.
- **“Qualidade” in two containers.** `strings:tabs.quality` is a sidebar item and
  `colorText:groupQuality` is a swatch-group heading inside the Text Styler. They can be
  painted together and are byte-identical — licensed because a palette group heading and a
  navigation item are never mistaken for one another, and because there is no second
  Portuguese word for the rarity-colour group that would not be invented.
- **“Aprovada” for `review:sourceAi.approvedBadge` and `strings:runs.judgeVerdictPass`.**
  Different tabs, and only one tab pane is ever painted, so they never co-render. Both are
  genuinely _approved_ / _passed_ in Portuguese.
- **“Entrada” as an input-token column header** (`config:models.colInput`) alongside the
  _entry_ term. The neighbouring headers (Contexto, Cache, Saída) fix the reading, and the
  price columns are the Brazilian standard wording. The term row scopes _entrada_ to the
  content unit only, so this is a licensed homonym rather than a collision.
- **“Sair do projeto” rather than “Sair” for `collab:leaveConfirm`.** The account page's
  own “Sair” (`account:signOut`) can be on screen behind the leave dialog, so the confirm
  button names its object. This one was **not** licensed — it was fixed.
- **“Remover” for both `account:notificationsDismiss` and `collab:sharing.remove`.** Both
  genuinely remove; the destructive-dismiss ruling only forbids _fechar_ and _ocultar_.
- **“Aviso” for Warning and Warn** across `config:lqa.severityWarning`,
  `account:notificationsSeverity.warning` and `console:filter_warn` — required by the
  lexicon, which fixes the severity word once.

## Locale-specific traps

- **Brazilian vocabulary, not European.** Use _arquivo_ (not _ficheiro_), _tela_ (not
  _ecrã_), _usuário_ (not _utilizador_), _senha_ (not _palavra-passe_), _excluir_ (not
  _eliminar_), _salvar_ (not _guardar_), _compartilhar_ (not _partilhar_), _time_ or
  _equipe_ (not _equipa_). A translation that mixes the two varieties is more jarring than
  one that is merely awkward.
- **_Excluir_ means delete.** It is the wrong word for the export checkbox that leaves
  rows out of a generated file, which is why the _omit_ term is _omitir_.
- **_Modelo_ is taken by the AI model** and is therefore unavailable for _template_ and
  unavailable for the regex _pattern_. Both had to move; the model did not.
- **_Fase_ is the right word for a stage here, unusually.** The lexicon warns every
  language away from the process reading, but Brazilian gaming genuinely calls a playable
  level a _fase_. Never let it leak into a string where _stage_ would mean a step.
- **_Legal_ is a false friend.** It reads as slang for _nice_ to a Brazilian, so the
  sidebar item is “Jurídico”.
- **Three settings surfaces would otherwise read alike in one sidebar.** The Config tab,
  Global Config and the app Settings page are all _configuração_-shaped in Portuguese and
  all reachable from the same rail, so `settings:title` and `sidebar:settings` take
  “Preferências” instead. That is faithful — the page holds appearance and language.
- **The LQA check descriptions say _aponta_, not _sinaliza_.** English writes _flags_ for
  both the review disposition and what a deterministic check does; only the first is the
  lexicon's `flag` term.
- **Keyboard key names are as engraved on a Brazilian ABNT keyboard**, which prints
  `Enter`, `Shift` and `Esc` in Latin — so those three stay as written. The same words as
  verbs translate normally: `strings:shortcuts.enterEditMode` is
  “Entrar no modo de edição”.
- **Two swatch names ship in English on purpose.** `colorText:swatches.key1` and `key2`
  are game-domain colour-slot names with no established Brazilian equivalent, which
  `english-review-notes.md` explicitly permits leaving in English; the seven elemental
  names ship untranslated for the same reason, matching the game itself.

## Checking your own work

Six greps, all clean on the finished locale:

| Sweep | pt-br instance |
| --- | --- |
| the register the guide bans | _tu_, _vós_, _o senhor_, _a senhora_, and mesoclisis |
| pre-reform orthography | the trema, and _idéia_ / _vôo_ / _pára_ |
| straight or guillemet quotes where the guide sets curly | `"` `'` and `«` `»` |
| doubled spaces | — |
| three-dot ellipses instead of the single character | `...` |
| hyphens used as dashes | ` - ` |

Then the three dependency-free guards, each run unpiped: `node scripts/check-locales.mjs`,
`node scripts/i18n-preflight.mjs pt-br` and `node scripts/check-lexicon-citations.mjs`.
