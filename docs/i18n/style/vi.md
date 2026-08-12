# Style guide — Vietnamese (vi)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/vi.md`. This file settles register, casing, punctuation, length and
placeholder handling.

## Register

**Bạn.** It is the neutral second person of Vietnamese software and the right match for an
informal-but-professional English source. `sidebar:selectProject` (_Select a project_) ships
as "Chọn một dự án".

Do not use "quý khách" (commercial, reads like a bank), "anh/chị" (assumes the reader's
gender and age) or "mày/tao" in any circumstance.

Vietnamese drops the pronoun freely — prefer that in short strings. Keep _bạn_ where the
English says **your** and the possessor is load-bearing (`config:enableModuleHelp` ends
"…cho mọi dự án của bạn"), and drop it where English merely has an implied subject.

**Corrected before batch 1:** the seed cited `vault:unlockDescription` as _Enter your
password…_ rendered "Nhập mật khẩu của bạn…". Both halves were truncations — the English is
"Enter your password to decrypt module credentials for this session.", one sentence with no
ellipsis — so the row asserted a rendering no file will ever contain. A quoted span next to a
key is read by `check-lexicon-citations.mjs` as a claim that the locale ships that text, so a
citation must be the **whole value**, byte-exact, or not be a citation at all.

### Control shapes, settled once (runbook 2.1)

Vietnamese has no inflection, so the title/button/placeholder distinction is carried by word
choice and by what is present rather than by form. Resolve the control first, then write:

| Control | Shape | Batch-1 instance |
| --- | --- | --- |
| Page / section / tab title | bare noun phrase, no verb | `config:routing.title` — "Quy tắc điều phối" |
| Confirm-dialog title | verb phrase naming the action | `config:confirmDeleteTitle` — "Xóa dự án" |
| Button | bare verb phrase, no subject, no "hãy" | `config:routing.addRule` — "Thêm quy tắc" |
| Table column header | bare noun, English abbreviation kept | `config:models.colParameters` — "Tham số" |
| Placeholder inside a control | invitation with the indefinite "một" | `config:models.select` — "Chọn một mô hình" |
| In-progress status | **đang** + verb, never on a button | `config:importing` — "Đang nhập…" |
| Completed status | **đã** + verb | `config:autoSaveSaved` — "Đã lưu" |
| Hint / help sentence | full sentence, ends with a period | `config:maxLengthHelp` |

**"Hãy" is for instructions, not for buttons.** It softens an imperative into advice and
belongs in help text and error recovery ("Hãy sửa các ô liên quan…"), never on a control,
where it reads as a suggestion rather than a thing the button does.

**The worked pair the runbook names.** `config:models.select` and `config:models.pickTitle`
are byte-identical in English ("Select a model") and are two controls: `select` is the
trigger button's empty-state label (`ModelPicker.tsx:616`) and `pickTitle` is the dialog's
own `<DialogTitle>` (`:656`). Vietnamese separates them with the indefinite classifier — the
placeholder invites you to pick **one** ("Chọn một mô hình"), the title names the action in
general ("Chọn mô hình"). Do not collapse them.

**A failure verb, not a failure adjective.** English writes "Failed to save: {{message}}".
Vietnamese renders the app's inability, not the user's: **"Không … được"** ("Không lưu được",
"Không tải được", "Không xóa được"). Reserve "… thất bại" for an operation that ran and did
not finish ("Nhập thất bại", "Xuất thất bại") — the distinction is real and English does not
make it, so decide per key which one the English means.

## Casing

Sentence case for every control, label, tab and page title. Vietnamese capitalizes the
first word and proper nouns only, so `config:routing.title` (_Routing Rules_) becomes "Quy
tắc điều phối". `english-review-notes.md` records that English Title Case on page titles is
a per-surface design convention with no meaning outside English.

Months are never capitalized: "tháng một" or "tháng 1", never "tháng Một". In a language
name only the proper noun takes a capital — "tiếng Việt", "tiếng Anh".

Preserve uppercase only where English uses it for layout: `strings:columns.config`
(_STATUS_) becomes "TRẠNG THÁI". Diacritics survive uppercasing and **must be kept** —
"TRANG THAI" is a different phrase, not a stylistic variant.

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: U+201C and U+201D, **everywhere**, including where the English source
  writes escaped straight quotes. English is split three ways here (see
  `english-review-notes.md`, "Observed, not changed" item 6) and Vietnamese is not: curly
  double quotes are the house form, so every key that wraps a placeholder — among them
  `config:duplicateSuccess`, `config:confirmDeleteDescription` and `config:templateSaved` — carries
  the curly pair where English carries an escaped straight one. Runbook 3 settles that the
  marks around a placeholder are the locale's to choose; the token inside is not.
- Ellipsis is the single character `…` (U+2026) — `config:importing` is "Đang nhập…".
- **Diacritics are mandatory, never optional.** Unaccented Vietnamese is not an informal
  register, it is unreadable. Write "sửa", not "sua".
- Use **precomposed (NFC) characters**. Decomposed sequences look identical on screen but
  compare unequal, which will make the whitespace and tag checks and any string search
  behave unpredictably.
- Tone-mark placement follows the **traditional style (kiểu cũ)**: "hòa", "thủy", "quý" —
  not the newer style (kiểu mới), which writes "hoà"/"thuỷ". Despite the names, the
  traditional placement is what Vietnamese software, dictionaries and publishing use, and
  it is what the input methods produce by default.
- Em dashes in the source stay em dashes with spaces around them.
- **Loanwords are hyphenated where the lexicon says so and bare otherwise.** "mô-đun" and
  "token" are both settled in `terminology/vi.md`; do not re-decide either per string.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. This applies inside prose too —
`config:overflowRatioDescription` ships "Mặc định: 1,75" where English writes "1.75".
No space before `%`.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

**Corrected before wave 3 — this section used to state a ratio rule, and the runbook
forbids it.** It read: "For those classes, never exceed ~1.7× the English character count".
Section 2.4 of the runbook is titled "Length budgets are absolute character counts, per
class" and opens "Never a multiple of English": an audit found **27** correct strings over
the pilot's 1.5× ceiling, including a sidebar item at 3.80×, because a ratio measures how
long the *English* is rather than how wide the *control* is. A short source such as
`sidebar:legal` ("Legal") denies slack the control actually has.

**The seed's "widest expander of the fourteen" claim is an unverified estimate.** It is
carried here unresolved on purpose: it cannot be measured until every namespace has shipped,
and the measurement is a deliverable of the whole-language sweep (runbook 7.2), not of
batch 1. See "Measured expansion" below, which holds the method now and the numbers after
the sweep. **The tail, not the aggregate, is what breaks chrome** (runbook 2.10).

### The six budgets

Absolute character counts, not multiples. The two **hard** classes are derived from the
container, the four **soft** ones from the longest value this locale actually ships plus
headroom.

| Class | Anchor key | Kind | Budget | Derivation |
| --- | --- | --- | --- | --- |
| Sidebar item | `sidebar:globalConfig`, `sidebar:legal` | **hard** | **26 chars** | container |
| Tab label | `strings:tabs.backup` | **hard** | **26 chars** | same container |
| In-panel sub-tab | `config:routing.tabImportExport` | soft | _pending sweep_ | longest shipped + headroom |
| Table column header | `strings:columns.config` | soft | _pending sweep_ | longest shipped + headroom |
| Filter label | `strings:filters.needsReview` | soft | _pending sweep_ | longest shipped + headroom |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | _pending sweep_ | longest shipped + headroom |

The four soft budgets are derived from the longest value **this locale ships** in each class,
so they cannot be written before the class has shipped: three of the four anchors live in
`strings` (batch 2) and the classes they name run across batches 2 and 6. They are filled in
at the whole-language sweep, where runbook 7.2 makes replacing a provisional budget with a
measured one a deliverable rather than a note. The two hard numbers do not wait, because they
come from the container rather than from the copy.

**How the two hard numbers were derived, so a later reader can re-derive them.** Both
classes live in one container: `SIDEBAR_WIDTH` is `16rem` = 256px
(`components/ui/sidebar.tsx:34`), and the product's tabs *are* sidebar menu items —
`components/layout/Sidebar.tsx:788` renders `strings:tabs.*` as a `<span className="truncate">`
inside a `SidebarMenuButton`, which is `text-sm` (14px) with `[&>span:last-child]:truncate`
(`ui/sidebar.tsx:467`). The runbook's arithmetic takes 1px border + 16 group padding + 16
button padding + 16 icon + 8 gap off the 256, leaving ≈199px of label, ≈26 characters at
14px Latin. **Vietnamese inherits that number unchanged**, and the reason is checkable:
Vietnamese diacritics are stacked above and below the base letter and add no advance width,
while Vietnamese text carries more spaces than English and a space is the narrowest glyph in
the run — so 26 is if anything conservative here. Nobody has measured rendered pixels; if a
correct rendering will not fit, look at the running app before shortening it, and escalate
rather than distorting the term (runbook 2.4).

**Soft means prefer the shorter of two correct options**, not a failure threshold. Keeping
chrome to two or three syllables — "Hoạt động" over "Lịch sử hoạt động" — is good style
because Vietnamese wraps at a syllable boundary and a four-syllable label in a narrow cell
wraps to two lines; it is not a rule that outranks a term.

**Terms outrank the budget.** `config:credentialsMissingChip` is "Thiếu thông tin xác thực"
(24 chars against English's 19) because *credential* is settled as "thông tin xác thực" and
every shorter candidate is a different term.

### Measured expansion

Method, so it can be re-run rather than trusted: one ratio per key over the **1,879 keys
`vi` shares with English** (the population runbook 2.10 asks you to name — `vi` has exactly
these, no extra plural forms, see below), character counts by code point.

```bash
node -e 'const fs=require("fs");const f=(o,p,out)=>{for(const[k,v]of Object.entries(o))v&&typeof v==="object"?f(v,p+k+".",out):out.set(p+k,String(v))};
const load=(l)=>{const m=new Map();for(const n of fs.readdirSync(`packages/frontend/src/locales/${l}`))f(JSON.parse(fs.readFileSync(`packages/frontend/src/locales/${l}/${n}`,"utf8")),n.replace(".json",":"),m);return m};
const en=load("en"),vi=load("vi");const r=[];let a=0,b=0;for(const[k,v]of en)if(vi.has(k)){const x=[...v].length,y=[...vi.get(k)].length;a+=y;b+=x;r.push(y/x)}
r.sort((p,q)=>p-q);console.log(r.length,(a/b).toFixed(2),r[Math.floor(r.length/2)].toFixed(2),r[Math.floor(r.length*0.9)].toFixed(2))'
```

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

Vietnamese is comfortable here: nouns do not inflect and there are no articles.

**Do not put a classifier in front of a token** ("cái {{module}}") — the correct classifier
depends on the value, which is unknown. Put the real noun first and classify that instead:
`config:enableModuleAddInstance` is "Thêm một thực thể {{name}} nữa…", where "thực thể" is
the classified head and the token only modifies it.

**No plural marking after a numeral — ever.** `category:countLabel_other` (_{{count}}
entries_) is "{{count}} mục"; "{{count}} các mục" and "{{count}} những mục" are
ungrammatical. This is the **one** numeral-adjacent hazard Vietnamese has, it is why `vi`
is not in `NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` alongside `tr` and `ja`, and it is why
"các" and "những" must never be added to `vi`'s word-axis exemption list.

**Every non-`count` token is count-neutral by construction here**, because the noun after it
does not inflect — so runbook 2.2's device 1 (invariant noun phrase, then the number) is
available but rarely necessary. Use it where English's own frame is wrong at some counts:
`config:templateMeta` is "{{languages}} ngôn ngữ · {{rules}} quy tắc điều phối", which is
grammatical at every value, so Vietnamese does **not** need the colon frame `de`/`ja`/`tr`/`ru`
reached for. Reproduce the *effect* the English has on its reader — a phrase true at every
count — not its surface (runbook 6).

**Vietnamese has exactly one plural category: `other`.** Verified:
`new Intl.PluralRules('vi').resolvedOptions().pluralCategories` is `['other']`. A plural
family therefore supplies `_other` and nothing else — never a `_one` copied across from
English. A `_one` key can never resolve here, and `pluralFamilyErrors()` in
`scripts/locale-rules.mjs` rejects any suffix that is not a plural category of the language,
so copying English's pair is a red build, not a harmless duplicate. `_zero` remains legal in
every locale and `strings:bulk.removeCategoryApply_zero` is kept.

**Consequence for the key count: `vi` lands at 1,879, not 1,908 and not 1,920.** English
ships 29 `_one` keys that Vietnamese must not carry; the twelve `bare + _other` families
(runbook 2.3) need nothing added, because their missing category is `one` and Vietnamese
does not have it. `ja`, `ko` and `zh-hans` are at 1,879 for the same reason.

## Locale-specific traps

- **CAT-tool vocabulary is not settled in Vietnamese.** "Bộ nhớ dịch" for _translation
  memory_ and "bảng thuật ngữ" for _glossary_ are the renderings this locale takes, but they
  are not universal the way the Spanish or German equivalents are. Both are recorded in
  `terminology/vi.md`; do not re-decide either per namespace.
- **Sino-Vietnamese vs native register.** "Xóa" and "loại bỏ", "lưu" and "lưu trữ", "cài
  đặt" and "thiết lập" differ in formality, not meaning. Pick one per term; mixing them
  inside a namespace is the defect. This locale takes the shorter, more native member in
  every pair above.
- **"Routing" is not "định tuyến".** The obvious Vietnamese word for _routing_ is the
  networking one, and `terminology.md`'s *routing rule* row says in as many words: "Avoid any
  word that suggests *network* routing — this is content routing." "điều phối" (to dispatch /
  allocate) carries no network reading and is not claimed by another term, so `config:routing.*`
  ships "điều phối" throughout. **The seed cited "Quy tắc định tuyến" here and it was
  wrong** — it was written before the lexicon row was read, and the citation guard did not
  catch it (see the note in `terminology/vi.md` on `routing rule`).
- **"Stage" is a game level.** Vietnamese gaming uses "màn chơi"; "giai đoạn" is exactly the
  process reading `terminology.md` warns about.
- **"Judge"** takes the evaluative sense ("đánh giá"), never "thẩm phán"/"xét xử".
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Vietnamese needs no parenthetical at all — the unmarked
  noun already covers every count.
- **Vietnamese words are written one syllable per space-delimited unit**, which makes every
  whitespace-tokenising tool in this repo operate on syllables rather than words for `vi`.
  It is why `scripts/i18n-preflight.mjs`'s "word axis" is a *syllable* axis here, and why
  `check-lexicon-citations.mjs`'s word-attestation test is weak for this locale: almost every
  Vietnamese syllable occurs somewhere in a shipped namespace, so a citation can be wrong in
  every word and still pass. **Check a citation against the file, not against the guard.**

## Surface names shipped so far

Repeat these verbatim; every later batch inherits them. `strings:tabs.*` is the authority for
a surface, because it names all seventeen of them first.

| Surface | Rendering | Key | Also owed by |
| --- | --- | --- | --- |
| Config | "Cấu hình" | `strings:tabs.config` | `strings:guide.topicConfig` prefixes it with "Tab" |
| Data | "Dữ liệu" | `strings:tabs.data` | — |
| Translations | "Bản dịch" | `strings:tabs.strings` | `strings:guide.topicMultiLanguage`, and the prose at `config:routing.categoriesConfiguredHint` |
| Compare | "So sánh" | `strings:tabs.compare` | `strings:guide.topicCompare`, and the prose at `config:routing.tonesHint` and `strings:order.presortHint` |
| Source AI review | "Rà soát nguồn bằng AI" | `strings:tabs` (review-source-ai) | `review:sourceAi.configTitle` (batch 3) |
| Translation AI review | "Rà soát bản dịch bằng AI" | `strings:tabs` (review-translation-ai) | `review:translationAi.title` (batch 3) |
| Manual review | "Duyệt thủ công" | `strings:tabs` (review-manual) | — |
| Quality | "Chất lượng" | `strings:tabs.quality` | `strings:guide.topicQuality` — no "Tab" suffix, per the lexicon |
| Glossary | "Bảng thuật ngữ" | `strings:tabs.glossary` | `strings:guide.topicGlossary` prefixes "Tab" |
| Category | "Danh mục" | `strings:tabs.category` | `strings:guide.topicCategory` prefixes "Tab" |
| Routing | "Điều phối" | `strings:tabs.routing` | `strings:guide.topicRouting` prefixes "Tab" |
| Activity | "Hoạt động" | `strings:tabs.runs` | `strings:guide.topicActivity` — and the page title expands, see below |
| Stage details | "Chi tiết màn chơi" | `strings:tabs` (stage-details) | `stage-details:title` (batch 6) |
| Orphans | "Mục mồ côi" | `strings:tabs.orphans` | `orphans:title` (batch 6), `strings:guide.topicOrphans`, and the prose at `config:fullReplaceOrphanNotice` |
| Backup | "Sao lưu" | `strings:tabs.backup` | `strings:guide.topicBackup`, and the prose at `config:importSnapshotNote` |
| Sharing | "Chia sẻ" | `strings:tabs.sharing` | `collab:sharing.pageTitle` (batch 4) |
| Text Styler | "Tạo kiểu văn bản" | `strings:tabs` (color-text) | `colorText:title` (batch 6), `sidebar:colorText` (batch 4) |
| Global Config | "Cấu hình chung" | `config:globalConfigTitle` | `sidebar:globalConfig` (batch 4) — identical in English, so identical here |
| Workspace Settings | "Cài đặt không gian làm việc" | `config:workspaceSettingsTitle` | — |
| Translation Memory | "Bộ nhớ dịch" | `config:tm.policyTitle`, `strings:guide.groupTranslationMemory` | `sidebar:translationMemory` (batch 4) |
| Credential Vault | "Kho bảo mật" | `strings:guide.topicVault` | `vault:statusLabel` (batch 4) |
| LQA Checks | "Kiểm tra LQA" | `config:lqa.title` | — |
| Routing Rules | "Quy tắc điều phối" | `config:routing.title` | — |
| Project Templates | "Mẫu dự án" | `config:templatesTitle` | `config:saveAsTemplateTitle` is the same surface in English's singular and takes the same rendering |

**Two expansions that look like drift and are not.** `strings:runs.title` is "Hoạt động dịch"
where the tab is "Hoạt động" — expand the page title, never shorten it to match. `legal:title`
does the same against `sidebar:legal` and is settled in batch 6.

`config:fullReplaceOrphanNotice` says "Relink tab" in English; there is no such tab and
`english-review-notes.md` records it as a stale name, so the Vietnamese names **Orphans**.

### The five sidebar group headings, and what nests under them

`strings:guide.group*` (batch 2) and `sidebar:groups.*` (batch 4) are byte-identical in
English, so batch 2 decides both. `Sidebar.tsx:773` renders the group heading with its tab
labels nested directly underneath, so heading and child are painted together and the pair has
to be read as a pair.

| Group | Rendering | Nested tab labels | Verdict |
| --- | --- | --- | --- |
| Setup | "Thiết lập" | Cấu hình · Dữ liệu · Điều phối | no overlap |
| Translate | "Dịch" | Bản dịch · So sánh | **proper substring, licensed** |
| Review | "Xem xét" | Rà soát nguồn bằng AI · Rà soát bản dịch bằng AI · Duyệt thủ công · Chất lượng | no overlap |
| Terminology | "Thuật ngữ" | Bảng thuật ngữ · Danh mục | **proper substring, licensed** |
| Maintenance | "Bảo trì" | Mục mồ côi · Sao lưu · Chia sẻ | no overlap |

Both licensed pairs are licensed **on structure** — a heading standing over its own compound,
never an equality — and both are proper substrings, which is the rider that makes that rule
safe rather than dangerous. English corroborates the first (Translate over Translations, as
`ru` Перевод/Переводы and `de` Übersetzen/Übersetzungen do) and does **not** corroborate the
second, which is expected: Vietnamese compounds by juxtaposition and will always show more
substring relations than English, so English is a second opinion here and not the test.

Two more overlaps were checked and cleared:

- `strings:guide.groupTranslate` "Dịch" against `strings:guide.groupTranslationMemory` "Bộ nhớ
  dịch". These are **siblings** in the guide's left rail (`GuideView.tsx:73`), not a
  heading over a child, so the structural licence does not carry them — but they are a bare
  verb against a three-syllable compound noun, which no Vietnamese reader confuses, and
  English has the identical relation.
- `strings:guide.groupTranslationMemory` over its single child `topicTranslationMemory`, which
  is an **equality**. That one is licensed explicitly by the runbook: English writes
  "Translation Memory" over "Translation Memory" deliberately and every shipped locale renders
  the pair identically.

### Collisions found in batch 2 and what was done

The same-rendering / same-English sweep is in `pnpm i18n:preflight vi`. Three hits were real
defects and were fixed in the strings rather than explained away:

- `strings:runs.startedColumn` (_Started_, a timestamp column) had collapsed onto
  `strings:compare.translateStart` (_Start_, a button). It now reads "Bắt đầu lúc", which is
  also the better column header.
- `strings:bulk.removeCategoryApply_zero` (_Remove categories_) had collapsed onto
  `strings:bulk.removeCategory` (_Remove category_), and those two **co-render**: the menu item
  and the apply button are in one popover. The zero form now marks the plural with *các*, which
  is available because no numeral is present.
- `strings:compare.clearSelection` and `strings:bulk.clearSelection` (_Clear selection_) had
  collapsed onto _Deselect all_. English keeps two wordings; runbook 2.6 says to carry a
  sibling disagreement across rather than harmonize it in one language, so they now read
  "Bỏ chọn" against "Bỏ chọn tất cả".

The rest are licensed, and all but one for the same reason — **English marks number and
Vietnamese does not**, so an English singular/plural pair is one Vietnamese word: Sources /
Source, Languages / Language, Categories / Category, Tones / Tone, Project Template(s), Target
Language(s), Remove category / categories. This includes `strings:tabs.strings`
(_Translations_) against `strings:runs.judgeTargetLabel` (_Translation_), which is the one
pair in that group whose members can be painted at once — the sidebar is always visible — and
it is licensed on the same grounds rather than on nesting: they are the same lexeme naming the
same object, differing in English only by a suffix this language has no equivalent of.

The one that is not about number: _Discard_ is deliberately two words, per the lexicon's
two-sense rule — "Bỏ thay đổi" where a Save button sits beside it (`config:discard`,
`strings:editor.discard`) and "Từ chối" where the app is offering something
(`strings:runs.judgeDiscard`).

### Collisions found in batch 3 and what was done

Two more real defects, fixed in the strings:

- `quality:checkLabels.forbidden-term` (the issue code) had collapsed onto
  `quality:checkLabels.forbidden-terms` (the check name) — English separates them by number
  alone, and both live in one map that the Quality dashboard can paint at once. The issue code
  now reads "Có thuật ngữ bị cấm", stating that one was found. Every other check/issue pair in
  that map was already distinct (`tag-equality` against `tag-mismatch`, `overflow` against
  `too-long`, and so on); this was the only one English left to number.
- `strings:pagination.showAll` (_Show all_) had collapsed onto `review:viewAll` (_View all_).
  They are different actions — one sets the page size, the other opens the findings dialog — so
  the English disagreement is carried across rather than harmonized: "Hiện tất cả" against
  "Xem tất cả".

Three deliberate splits of one English word, all recorded in `terminology/vi.md`:

- _Approve_ is **two** actions. `review:approve` stores a translation into translation memory
  and takes the lexicon's **approve** term; `review:sourceAi.approve` only records that you
  read a finding and takes *đồng ý* instead. Rendering the second with the memory word would
  promise a write that does not happen.
- _Failed_ is two things: an LQA result that did not pass ("Trượt", matching
  `strings:runs.judgeVerdictFail`) and a run that errored ("Thất bại").
- _Discard_ stays the two words settled in batch 1.

And one collapse that looks like drift and is licensed by
`english-review-notes.md` item 7 rather than in spite of it: `strings:pagination.prev` (_Prev_)
and the three _Previous_ keys all read "Trước". That note says to use the locale's usual pager
wording and **not** to align the two. Nothing was aligned — Vietnamese simply has no shorter
form of a word that is already one syllable, so the pager wording and the full word are the
same string.

The remaining same-rendering hits are the number-marking class from batch 2, plus one new
shape: English derives a **noun phrase** from a verb phrase where Vietnamese cannot.
`strings:bulk.aiGeneration` (_AI generation_) reads the same as `category:aiButton`
(_Generate with AI_), and `strings:runs.typeGlossaryGeneration` (_Glossary generation_) the
same as `glossary:generateGlossariesBtn` (_Generate glossaries_). Neither pair co-renders, and
Vietnamese marks the difference with syntax rather than morphology, so there is no form to
preserve.

## Keyboard key names

Vietnamese keyboards are US QWERTY with **English keycaps** — `Enter`, `Shift`, `Esc`, `Tab`,
`Ctrl` and `Alt` are engraved in English on every layout sold in Vietnam, and no Vietnamese
word is printed on any of them. So the lexicon's rule ("write the key name as it is engraved
on that locale's keyboard") requires keeping the English word here, exactly as it does for
`ru`. This is a decision, not an untranslated leftover: a reviewer scanning
`strings:compare.contextPlaceholder` or `strings:compare.cellEditTooltip` for English words
should not reopen it.

The same words translate normally where they are **verbs or nouns** — `strings:shortcuts.enterEditMode`
(_Enter edit mode_) is "Vào chế độ sửa", and the *tab* that means a tab in the UI is "tab".
Read the string, not the word.
