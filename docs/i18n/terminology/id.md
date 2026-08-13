# NARN terminology — Indonesian (`id`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/id.md`](../style/id.md) — how Indonesian is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

**Quoting convention in this file.** Indonesian renderings are quoted with curly doubles,
`“…”`, matching `../style/id.md`. English glosses and rejected candidates are written in
*italics*, never in quotes — a quoted span next to a key is read by
`scripts/check-lexicon-citations.mjs` as a claim that this locale ships that exact text,
and `id` is a Latin-script locale, so the guard's non-ASCII skip does not rescue an English
gloss written here the way it would in a Cyrillic or CJK file.

| Term | Rendering | Notes |
| --- | --- | --- |
| project | proyek | The established loan, not *karya* or *garapan*. Compounds freely: bahasa proyek, konfigurasi proyek. |
| workspace | ruang kerja | Deliberately two words against project's one, because several strings contrast the two scopes side by side (`config:batchGroupingDefaultOption` sets the workspace value against the project's). |
| entry | entri | Reserved for the content unit and nothing else. Not *catatan*, which is spent on a review record (see `review:sourceAi.ignoredToast`), and not *baris*, which names a CSV row (`config:rowsProcessed`) and a log line. `logs:orphan.detected` narrates in *strings* in English and takes this rendering anyway; `logs:translation.queued` counts jobs and does **not** — see its row in `../english-review-notes.md`. |
| source text | teks sumber | Shares *sumber* with source language and source label; Indonesian keeps all three transparent, so no disambiguation was needed. |
| translation | terjemahan | The noun. The verb is *terjemahkan* (bare) / *menerjemahkan* (progressive). Number-invariant, so the tab label and every plural mention are the same word. |
| source label | label sumber | Not the bare *sumber*: `config:routing.labelSources` shortens the column heading to it, and the full term keeps the two apart everywhere else. |
| achievement | pencapaian | What Indonesian game platforms print. Not *trofi*, which is PlayStation's word for a different object. |
| inline tag | tag sebaris | *tag* is kept as a loan — Indonesian *tanda* is already carrying the mark/flag sense. *sebaris* renders the inline part. |
| placeholder | placeholder | Kept in English. Indonesian has no settled word for the `{{…}}` token sense, and the two candidates both collide: *penampung* reads as a container and *isian* is the input-hint sense the lexicon explicitly forbids sharing. The input-hint sense does not occur as a translatable value anywhere in the 24 namespaces, so no second word was needed. |
| translator context | konteks penerjemah | Distinct from *konteks entri* (the metadata bundle, `generation:contextLabel`) and from *jendela konteks* (the model's context window, `config:models.confidenceReason.prompt-near-context`). Three different things, three different modifiers, one head noun. |
| source language | bahasa sumber | Pairs naturally with bahasa target; the two sit side by side in Config. |
| target language | bahasa target | Not *bahasa tujuan*, which reads as a destination and is the network sense the routing term warns against. |
| reference language | bahasa rujukan | *rujukan* is reference-as-consultation, not *acuan*, which would read as a standard being conformed to. |
| writable language | bahasa yang dapat diedit | Held to the one adjective *dapat diedit* everywhere: the column header (`collab:sharing.columnLanguages`), the lock messages and the compare-toolbar hint. Alternating with *dapat disunting* is the bug the lexicon warns about — and note the surrounding editor strings do use *sunting* for the ordinary edit verb, so the two coexist deliberately. |
| Pseudo Test | Pseudo Test | Untranslated: it names the synthetic language `pseudo-test`, and translating the label would break the tie to the code. |
| run | putaran | Coined by elimination and the elimination is the point. *proses*, *eksekusi*, *sesi*, *operasi* and *tugas* are each barred by the lexicon's Not list, and three of them are independently spoken for in this locale — *proses* by `config:rowsProcessed`, *operasi* by `strings:bulk.bulkOperation`, *tugas* by the assignment verb in `glossary:matchAssignmentLabel`. *putaran* survives, and it does mean the right thing: one pass of a repeatable job. |
| revert | kembalikan | One of three separate words this product needs and Indonesian has: *kembalikan* undoes a whole run, *urungkan* undoes one cell (`strings:compare.undo`), *pulihkan* restores a backup (`backup:restoreButton`). The badge takes the participle, “Dikembalikan”. |
| Activity | Aktivitas | The tab; the page title expands to “Aktivitas Terjemahan” (`strings:runs.title`) exactly as English expands it, and is not shortened to match. |
| log | log | Kept as a loan. A single line is *baris log*, built from the same root as the lexicon asks — used in `console:empty` and in `console:membersNotShown`, whose *entry* is a grouped console line and not a content entry (verified at `components/layout/ConsoleLogRow.tsx:158`, where the members are log rows). |
| batch | batch | Kept in English. *tumpak* is unused in practice and *kelompok* is spent on grouping — see the next row. |
| batch grouping | pengelompokan batch | Distinct from mode batch (`config:module.batchMode`) by the head noun, which is what the lexicon asks for. |
| AI review | tinjauan AI | *tinjauan* is a considered opinion; *pemeriksaan* is the deterministic LQA word and never appears here. The literal English *Checks* at `strings:runs.aiReviewChecksLabel` and `review:sourceAi.checksLabel` is a check and does take *pemeriksaan* — that is the carve-out the lexicon spells out, not a drift. |
| judge | menilai | The evaluative sense only. *hakim* and *mengadili* are the legal reading and are barred. The feature is never called *si penilai* as a noun, matching English. |
| source review | tinjauan sumber | The tab is “Tinjauan AI Sumber”; the two review tabs differ only in their last word, which is what keeps them adjacent and distinguishable. |
| finding | temuan | Kept apart from isu (the LQA verdict) and from saran. All three can be listed against one entry. |
| suggestion | saran | One word across the judge panel, the glossary generator and the category generator. The action on it is *terapkan* — including at `strings:runs.judgeApproveAll`, whose English says *Approve*; see the known copy bug in the lexicon and in `../english-review-notes.md`. |
| discard | buang / tolak | Two senses, two words, as most languages need. *buang* throws away unsaved edits and sits beside Save (`strings:editor.discard`, `config:discard`, `vault:discard`); *tolak* refuses something the app offered (`strings:runs.judgeDiscard`, `glossary:generateDiscard`, `colorText:assistant.discard`). The third sense, omitting rows from an export, is a third word again — see the omit row. |
| needs review | perlu ditinjau | A verb phrase, so it carries no agreement and works unchanged in the filter, the badge and the flag-all control. The row badge `strings:compare.cellNeedsReviewBadge` keeps English's deliberate lowercase. |
| flag | sisihkan | Deliberately not *tandai*, which is the mark verb — this action *clears* the needs-review flag, so one word for both would make the same verb set and unset one state. The filter chip is the participle, “Disisihkan”. Note `strings:compare.flagAllNeedsReview` says *Flag* in English but belongs to the needs-review family, and takes *tandai* there; that split is required, not drift. |
| ignore / ignored | abaikan / diabaikan | The un-form is built from the affirmative rather than coined: `strings:row.unignoreAction` is “Jangan abaikan entri”. `review:sourceAi.ignore` is a different English *Ignore* — dismissing a source-review finding — and takes the same verb, which the lexicon permits because the two never render on one surface. |
| Review (the sidebar group) | Peninjauan | The umbrella nominalization, chosen so it claims none of its four members: the three review tabs are all *Tinjauan …* and the fourth is Kualitas. Same string at `strings:guide.groupReview`, which the guide rail paints over the same children. |
| review queue | antrean tinjauan | Built from the same root as the reviewing verb, so a reader sees one feature. |
| back-translation | terjemahan balik | The Indonesian translation industry's own term. A literal compound would name the action, which this product does not offer. |
| module | modul | The canonical picker word. Not *plugin*: the app has no plugin system. |
| module instance | instans modul | Shortened to *instans* once modul is established in the sentence, as `config:instances.instanceOf` does. The identifier itself is never translated; `config:instances.slugReserved` names the identifier fragment, and *slug* is kept there because that is what the field holds. |
| provider | penyedia | Kept distinct from modul throughout. The three English strings that label a module-instance picker *Provider* (`colorText:assistant.instanceLabel`, `stage-details:chatInstanceLabel`, `config:routing.simplePlaceholder`) are translated as written, per the lexicon, and did not drag modul anywhere. |
| model | model | The loan. Note this is exactly why template could not be *model* — see that row. |
| prompt | prompt | Kept in English; it is what Indonesian practitioners say. Distinct from *permintaan*, which this locale spends on an HTTP request (`config:requestsPerSecondLabel`), and from *pencarian*. |
| reasoning effort | upaya penalaran | The provider's own parameter, not a NARN concept. *upaya* is effort-as-exertion; *penalaran* is reasoning-as-inference. |
| routing rule | aturan penyaluran | *penyaluran* is channelling — deciding which module a job is sent down. *perutean* is the obvious Indonesian calque and was rejected precisely because it is the network word the lexicon warns against. The verb phrase is *disalurkan ke* (`config:routing.routesTo`). |
| rule group | grup aturan | *grup* is the loan, kept clear of *pengelompokan* (batch grouping) and *kategori*. |
| credential vault | brankas kredensial | *brankas* is the ordinary Indonesian word for a strongbox and is what Indonesian password managers use. It carries all four required phrases: brankas kredensial, brankas terkunci, buka kunci brankas, kata sandi brankas. Shortened to *brankas* wherever the context is unambiguous. |
| credential | kredensial | The loan. Not *kata sandi*, which is the password itself and appears beside it constantly in the vault dialogs. |
| LQA | LQA | Kept as the industry acronym. Indonesian localization practice has no established localized form, and inventing one would have to be repeated in the filter chip and every check name. |
| quality gate | gerbang kualitas | The process-control sense. Indonesian software QA already uses *gerbang* this way, so the physical-door reading the lexicon warns about does not arise here. |
| check | pemeriksaan | The noun, used in *pemeriksaan kualitas*, *Pemeriksaan LQA* and every individual check name. The verb *periksa* shares the root and is free (`config:models.inspectFootprint`). The two severity values are *memblokir* and *peringatan*, and neither is *galat*. |
| issue | isu | The loan, deliberately: *masalah* is the ordinary problem word and *temuan* is spent on the source review's finding, and all three can be listed against one entry. `logs:sourceReview.done` is the one place *masalah* is right, because its English says *issue* about the source rather than about a translation. |
| severity | tingkat keparahan | Shortened to *keparahan* inside a sentence. The two values are fixed by the check row and do not drift here. |
| notification severity | tingkat keparahan | Same head word as LQA severity — the two never co-render, and the lexicon's binding constraint is on the value *Peringatan*, which is byte-identical in both sets (`account:notificationsSeverity.warning`, `config:lqa.severityWarning`). |
| assertion | asersi | A genuinely fourth word was required: *kondisi* is spent on routing conditions, *pemeriksaan* on the LQA checks and *aturan* on routing rules. |
| pattern | pola | The regex sense only. Not *templat*, which is spoken for. |
| overflow | luapan | Relative-to-source, and kept clearly apart from *batas panjang*, which is absolute — both appear in the same checks list. |
| length limit | batas panjang | The hard cap. Also names the routing-rule condition on source length (`config:routing.labelMaxLength`). |
| pass rate | tingkat lulus | Not *tingkat keberhasilan*: `config:health.successRate` is a different metric in the same product and ships as “Berhasil {{rate}}%”, so the two must not share a word. |
| glossary | glosarium | The CAT-tool word. Used for the glossary only, never for translation memory. |
| glossary term | istilah | Shortened to *istilah* throughout the Glossary tab, and never *entri* — `glossary:totalTerms` and `category:countLabel_other` count two different things. |
| constant | konstan | The column header and the badge, with the badge lowercase where its neighbours are. Not *hanya-baca*, which is the read-only flag two columns away and ships as its own words. |
| match | kecocokan | Noun and verb share the root *cocok*, which the lexicon asks for where the language allows it: `glossary:matchesPanel` is the noun, `config:lqa.regexModeMustMatch` the verb. |
| translation memory | memori terjemahan | The established CAT-tool phrase. Bare *memori* is left to mean RAM, which is what `logs:vault.credentialsEvicted` genuinely means, and that string says so explicitly. |
| approve | setujui | Kept distinct from *terapkan* (apply a suggestion), *tandai sudah ditinjau* (clear a flag) and *simpan* (persist an edit) — all four are in the same bulk bar. |
| category | kategori | The loan. Not reused for grup aturan or label sumber. |
| tone | nada | Indonesian uses *nada* idiomatically for register and voice, so the acoustic reading the lexicon warns about does not bite here. *gaya bahasa* was rejected as the model's writing style rather than an authoring instruction. |
| orphan | yatim | The figurative noun, used consistently in the tab title, the count chip, the confirm dialog and the log lines. The surface name is “Entri Yatim”, which is what both `strings:tabs.orphans` and `orphans:title` ship — the bare adjective would not stand alone as a sidebar item. |
| relink | hubungkan ulang | One verb across the row button, the dialog title, the confirm step and the import warning. |
| backup | cadangan | The noun; the verb is *buat cadangan*, never a verbed loan. Kept separate from *ekspor* and from snapshot. |
| snapshot | snapshot | Kept in English. *cuplikan* means an excerpt and *titik pemulihan* is a phrase rather than a term — that phrase is used where English itself says *restore point* (`backup:itemPreImport`), which is a different key, not a second rendering of this term. |
| template | templat | The KBBI form. *model* was unavailable, exactly as the lexicon predicts for this language family: it is the AI model. |
| omit (from an export) | kecualikan | The third sense of English's *discard* and a third Indonesian verb, matching four other locales that reached an omit/exclude verb independently. `config:discardUntranslatable` is where every translator meets it first. |
| collaborator | kolaborator | The loan, and narrower than anggota. |
| member | anggota | Wider: every kolaborator is an anggota, the owner is an anggota and not a kolaborator. The two appear in adjacent strings on the Sharing page. |
| nickname | nama panggilan | Not *nama pengguna*, which is the account identity the lexicon warns against reusing. |
| claim | klaim | Yields all the forms the UI needs: the button *Klaim*, the progressive *Mengklaim…*, the participle *diklaim*. Distinct from *dipesan*, which is what `collab:errors.nickname_reserved` says about a reserved name. |
| invite | undangan | The four statuses are translated as one adjectival set — “Tertunda”, “Ditukarkan”, “Dicabut”, “Kedaluwarsa” — because they sit in one column and are read down the page. |
| revoke | cabut | The button is the bare verb and the status is the participle, so English's Revoke/Revoked pair survives as Cabut/Dicabut in the adjacent columns where a reader compares them. Indonesian's `di-` prefix does this for free; no second verb was needed. |
| recording | perekaman | The process; *terekam* and *direkam* for what it produced. Deliberately not *catatan* (which would collide with the entry sense the lexicon warns about) and not *log*. English's three names for this one feature — audit, record, track — all render with this term, per `../english-review-notes.md`, and no audit word was coined. |
| stage | stage | Kept in English, which is what Indonesian gaming does. *tahap* and *tahapan* are exactly the process reading the lexicon calls the single most likely mistranslation in the app. The surface is “Detail Stage”. |
| Text Styler | Penata Teks | The product surface name, identical in the sidebar item, the tab label and the tool's own title. |
| element | Elemen | The group heading. The seven colour names themselves — Hydro, Pyro, Anemo, Electro, Dendro, Cryo, Geo — are game content and stay exactly as the game ships them in Indonesian, which is untranslated. |
| assistant | asisten | Settled at its first appearance, the run-type label `strings:runs.typeChatGeneric`, not at the chat surfaces it reaches later. The role noun, not *bantuan*, which is the abstract act. |
| theme | tema | The four names are localized and byte-identical in both places they appear: “Klasik”, “Piksel”, “Tekno”, “Minimal” at `settings:themes.default.name` and again at `welcome:themeChooser.names.default` and its three siblings. |
| guide | panduan | One word for the section, the sidebar item and every read-the-guide link. Not reused for the AI reviewer's guidance, which is *arahan* (`strings:runs.judgeGuidanceToggle`) — that is a different thing wearing a similar English word. |
| release | rilis | The loan. Not *versi*, which is the number, and never *entri*. |
| changelog | Catatan Perubahan | Title Case as a surface name. *catatan* is free here because the entry term took *entri* rather than a record word. |
| dismiss | hapus / tutup | Two words, because the two consequences differ and one destroys data. `account:notificationsDismiss` issues a DELETE, so it ships as “Hapus”; `system:restarted.dismiss` closes a banner and destroys nothing, so it ships as “Tutup”. |
