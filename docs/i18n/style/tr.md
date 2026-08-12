# Style guide — Turkish (tr)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/tr.md`. This file settles register, casing, punctuation, length and
placeholder handling.

> **How to read a quoted rendering in this file — and exactly how far the guard protects
> you.** `scripts/check-lexicon-citations.mjs` reads **both** `terminology/tr.md` **and this
> file**, and fails on a quoted span whose significant words are not attested in the shipped
> `tr` corpus. It also implements the three-way split below rather than merely describing it:
> a prescription for a namespace that has **not shipped yet is skipped, not failed**, and
> starts being checked the moment that namespace ships. The `sidebar:` and `vault:`
> prescriptions were discharged in batch 4 and are citations now, checked on every run.
> Run the script for its own counts; do not copy them into this file.
>
> **`tr` has NO style-guide prescriptions left. Batch 6 was the last batch, every namespace
> has shipped, and the guard now checks every quotation in this file on every run.** The
> `common:saving` prescription this block named for a round shipped as “Kaydediliyor…”; the
> three batch-5 prescriptions listed further down shipped as written and are marked there.
> A locale with all 24 namespaces present cannot hold a prescription at all — the skip is
> keyed on the namespace being absent — so **the derivation below now prints nothing for this
> locale, and that empty list is the finished state rather than a broken snippet.** Keep the
> snippet: it is what a *reviewer* runs to check the claim, and it is the only way to tell an
> empty list from an extractor that stopped extracting. **Derive it, do not read it** — reuse the guard's own three functions
> *and its own skips*, so the answer is the guard's rather than an approximation of it:
>
> ```js
> // node --input-type=module, run from the workspace root
> import { flattenStyleParagraphs, extractStyleCitations, namespaceOfKey } from './scripts/check-lexicon-citations.mjs';
> import fs from 'node:fs';
> const shipped = new Set(fs.readdirSync('packages/frontend/src/locales/tr').map((f) => f.replace(/\.json$/, '')));
> for (const block of flattenStyleParagraphs(fs.readFileSync('docs/i18n/style/tr.md', 'utf8')))
>   for (const { key, text } of extractStyleCitations(block)) {
>     const ns = namespaceOfKey(key); // null = a file or script reference, which the guard skips
>     if (ns && !shipped.has(ns)) console.log('PRESCRIPTION:', key, '=>', text);
>   }
> ```
>
> **Print the list; never print a count.** A count from a hand-rolled loop is not the guard's
> count unless it reproduces every skip — namespace-less spans, unshipped namespaces, and (for
> non-Latin locales only) glosses with no non-ASCII letter — and a count in this file is stale
> on the next commit anyway, which the runbook forbids for exactly that reason. The list is
> what binds you; let the guard report its own totals. **And note the lexicon file is a
> different code path entirely** — `parseLexiconRows` + `candidatesForRow`, which has **no
> namespace gating at all**, so "how many prescriptions does `terminology/tr.md` have" is not a
> question that path can answer. Running the *style* extractor over the lexicon file produces a
> number that means nothing; batch 4's fix round did exactly that and reported it.
>
> That `common:saving` prescription was **doubly** binding and batch 6 had no freedom in
> it: batch 4 shipped `collab:sharing.saving` — same English, *Saving…* — as “Kaydediliyor…”,
> so the verbatim rule fixed `common:saving` before the guard ever looked at it. **Shipped;
> this is a citation now.**
>
> **What it does not check is attachment.** It proves that **each significant word** of a
> quoted rendering is attested somewhere in the shipped locale — word by word, prefix-
> tolerant, never the span as a unit — so it cannot prove the rendering belongs to the key it
> is quoted against, and a span whose words each occur in *different* strings still passes. A
> quotation that is attested but describes the cited key **wrongly** goes green; the runbook
> records exactly one such row surviving six rounds of human review in the pilot. Hold every
> quotation below to that second standard by hand; the guard has the first one covered.
>
> **This block previously asserted the opposite** — that the script "does not read style
> guides", and therefore that nothing but a manual grep could catch a stale quotation here.
> **That claim was true when it was written and false thirty minutes later**, and the gap is
> the whole lesson: it was written at `bc1ab50` (19:39, round 1's fix commit), when the guard
> genuinely read only the lexicon; `59d4f7c` (20:09) extended it to read style guides, and
> nobody went back to the sentence. Round 2 inherited it as false, and round 3 edited the
> bullet directly beneath it while holding the falsifying output — the guard had just
> rejected a `tr (style guide)` citation in this very file, which it could not have done
> without reading this file. **A claim about tooling does not decay; it flips, in one commit,
> usually somebody else's.** Corrected rather than deleted, because the distinction the
> paragraph was reaching for — attested versus correctly attached — is real and is the part
> that survives.
>
> **Batch 6 landed the last seven namespaces, so EVERY quotation in this file is now a
> citation.** `stage-details:`, `colorText:`, `orphans:`, `backup:`, `welcome:`, `common:` and
> `legal:` quotations joined the checked set the moment that batch landed, and the three
> prescriptions batch 5 wrote further down discharged as written: `colorText:assistant.unlockVault`
> and `stage-details:chatUnlockVault` both ship “Kasanın kilidini aç”, and
> `backup:toastRestoreSuccess` ships “Yedek geri yüklendi.” Each was checked **against its own
> key**, not merely against the corpus, because attestation is all the guard can prove — the
> pair above is attested from `logs:action.unlockVault` whatever `colorText` had shipped.
>
> - A quotation attached to a **`config:` or `strings:` key is a citation**: that string is
>   shipped, and it is checkable today. The `config:` ones were verified against
>   `packages/frontend/src/locales/tr/config.json` at the end of batch 1; the `strings:`
>   ones against `.../tr/strings.json` at the end of batch 2.
> - A quotation attached to a key in **any other namespace was a prescription**, binding on
>   the batch that owned that namespace — **there are none left, because there are no
>   unshipped namespaces left.** It described what that key **must** ship, not what it did
>   ship. The `orphans:` and `colorText:` rows in the surface-name table were **prose
>   guidance**, not quotations: they named a key and told batch 6 to repeat a rendering quoted
>   elsewhere, which bound batch 6 just as hard but was invisible to the extractor — and batch
>   6 did repeat them, `orphans:title` as “Yetimler” and `colorText:title` as
>   “Metin biçimlendirici”. That asymmetry is the lasting lesson of the pair: **a binding
>   instruction written as prose is still binding and still unguarded**, so the next locale
>   should quote what it means to bind. **`glossary:`, `review:`,
>   `category:` and `quality:` quotations are citations as of batch 3**, verified against
>   `.../tr/{glossary,review,category,quality}.json` at the end of that batch; the two
>   prescriptions batch 2 left for `quality:*` and `review:*` were discharged there and are
>   marked as shipped below. **`sidebar:` and `vault:` quotations are citations as of batch
>   4**, verified against `.../tr/{sidebar,vault}.json` at the end of that batch — including
>   the three this file had been carrying since batch 1: `sidebar:selectProject`
>   (“Bir proje seçin”), `sidebar:create` (“Oluştur”) and `vault:unlockDescription`, whose
>   shipped string is “Bu oturumda modül kimlik bilgilerinin şifresini çözmek için
>   **parolanızı girin**.” **`logs:`, `console:`, `system:`, `errors:`, `generation:` and
>   `batch:` quotations are citations as of batch 5**, checked on every run from the moment
>   that batch landed. **`stage-details:`, `colorText:`, `orphans:`, `backup:`,
>   `welcome:`, `common:` and `legal:` quotations are citations as of batch 6**, verified
>   against those seven `tr` files at the end of that batch. **Batch 5 left batch 6 three
>   strings it had no freedom in — all three shipped as written**, found by diffing the six
>   English files against batch 6's seven for byte-identical values:
>   `colorText:assistant.unlockVault` is “Kasanın kilidini aç”,
>   `stage-details:chatUnlockVault` is “Kasanın kilidini aç”,
>   both byte-identical in English to `logs:action.unlockVault`; and
>   `backup:toastRestoreSuccess` must repeat `logs:backup.restored`, “Yedek geri yüklendi.”
>   The first two were quoted here on purpose, so the guard started checking them the moment
>   `colorText` and `stage-details` landed; the third was recorded in the *backup* row of
>   `terminology/tr.md` as prose, and nothing mechanical said so — it shipped because the
>   translator opened the row, not because a tool asked.
>   **One same-English pair in that diff was a coincidence and was NOT copied:**
>   `colorText:swatches.warn` is English *Warn* like `console:filter_warn`, but it names a
>   game text colour in a list of colour names, not a log level. Batch 6 decided it on its
>   own and landed on the same word — `colorText:swatches.warn` is “Uyarı” — which is fine,
>   because Turkish has one noun for the warning sense and the two never co-render as the
>   same kind of object. **It arrived there by the elimination, not by the verbatim rule**,
>   and the distinction matters for the next locale: had the swatch needed a different word,
>   nothing in the identity of the English would have argued against it.
> - A quotation attached to **no key at all** is an illustration: a rejected candidate, a
>   wrong form shown as wrong, or a convention example. Never copy one as a rendering.
>
> **Two ways to write a sentence here that the guard reads as a Turkish rendering. Both cost
> this locale findings; the second cost it four rounds of silence.**
>
> 1. **Do not backtick a code fragment — in `terminology/tr.md`.** A backtick span that is not
>    key-shaped — anything with whitespace or a bracket in it — is a citation with no adjacency
>    needed there, so a function name with parentheses, or a snippet like a variable
>    assignment, fails as an unattested rendering. **Name the function in prose.** A fenced
>    block does **not** protect you: paragraph flattening only joins the lines of a block, it
>    strips nothing, so a citation inside a fence extracts exactly as it would outside one. (An
>    earlier version of this rule said fences were stripped. They are not — re-derived from the
>    flattening function itself.) **Scope corrected in batch 5, by measurement:** this rule is
>    the lexicon's, not this file's — the style extractor ignores non-key backtick spans
>    altogether (see the table below). Keeping the habit in both files costs nothing and is
>    still the right habit; believing it is what the *style* guard checks is what cost a round.
> 2. **Never put ENGLISH in quotes of ANY kind. Straight quotes are live here — the claim that
>    they are inert was wrong.** This bullet asserted that because the locale writes curly
>    everywhere, curly is "always the live delimiter here and straight-quoted English is inert".
>    **The style path does not pick one delimiter and drop the rest: it loops over all of them**,
>    straight doubles included, and the great majority of this file's own style citations are
>    straight-delimited. So a straight-quoted English gloss beside a key is a candidate exactly
>    like a curly-quoted one.
>
>    **What actually kept this file's two English glosses from failing is something else
>    entirely, and it is a hole rather than a licence:** the style path resolves a citation's
>    namespace from the key beside it, and a key written in an abbreviated or non-namespaced
>    form resolves to nothing — so the citation is **skipped, not checked**. The whole-language
>    sweep measured that this silently dropped a substantial minority of this file's style
>    citations. The tooling side is with the wave controller, but **the abbreviated keys in this
>    file were mine and are now fully qualified** — every key quoted here carries its namespace,
>    so nothing in it is dropped for that reason any more.
>
>    **Qualifying them immediately failed one citation, which is the whole argument for doing it:**
>    the *"Inspect" may not be "incele"* bullet quoted its English source in straight quotes, and
>    that had been invisible **because of this very gap** — an English gloss, in live delimiters,
>    beside a key the extractor could not resolve. It is italics now. So the gap was not
>    harmlessly suppressing noise; it was hiding exactly the class of defect the rule above
>    exists to prevent. **Never read a skip as a licence**, and write keys in full so the guard
>    can speak. Write an English gloss in *italics*, which is
>    safe under every delimiter and under every extractor, and **do not reason about which
>    delimiter is live** — this is the second time a claim in this bullet about how the guard
>    treats delimiters has turned out to be false.
>
> **And know why this locale is exposed where `ru` and `ja` are not.** The guard skips a
> citation whose text has no non-ASCII letter *only for non-Latin-script locales* — `ru`, `ja`
> and the other unspaced scripts — so their English glosses are discarded automatically.
> Turkish is Latin-script, so an English gloss and a Turkish rendering are indistinguishable to
> it. Four rows of this file failed the moment the guard learned to read curly quotes, and all
> four were English glosses, not one a wrong rendering.
>
> **What exactly makes a quoted span a candidate — measured in batch 5, because the version of
> this paragraph that stood for four rounds was wrong about it.** It said the lexicon's
> candidate builder collects EVERY quoted span in a row, *with no key adjacency*. It does not.
> Running that builder over synthetic rows gives, in the **lexicon** file:
>
> | Shape in a Notes cell | Extracted? |
> | --- | --- |
> | a quoted span with no key anywhere near it | **no** |
> | a key, then the span in parentheses | **no** — an opening parenthesis is not one of the connector characters |
> | a key, then the span directly, or after up to three connector words | **yes** |
> | the span, then the key in parentheses | **yes** |
> | a backtick span that is not key-shaped | **yes**, and this one really has no adjacency requirement |
>
> The style-guide extractor behaves the same on the first four rows and **differs on the last**:
> it ignores non-key backtick spans entirely. So the backtick-a-function-name trap is a
> *lexicon* trap, not a trap in this file — which is the opposite of what the old paragraph
> implied by treating one rule as covering both.
>
> **A third shape, and this one loses a citation silently — measured in batch 5 while writing
> the prescriptions two bullets up.** Inside a blockquote (this whole block is one), paragraph
> flattening joins the lines but keeps each line's leading angle bracket, so a citation whose
> key ends one line and whose quoted rendering begins the next has that bracket sitting
> between them — and it is not one of the connector characters, so nothing extracts. The same
> two lines outside a blockquote extract normally, and so does the same citation rewrapped
> onto one line. It cost a prescription here: the first of the two *Unlock vault* lines above
> was written across a line break, extracted nothing, and only reappeared after the pair was
> rewrapped. **Keep a key and its quoted rendering on one physical line**, and re-run the
> derivation snippet after writing a prescription rather than trusting that you wrote one.
>
> **The instruction does not change: put an English gloss in *italics*.** Only the reason
> changes, and the correction is left visible rather than rewritten away. Two of the shapes
> above extract an adjacent gloss, the parenthesized shape survives only by an accident of the
> connector pattern, and a rule that depends on remembering which is which will be got wrong.
> Italics are safe under every shape and under both extractors.
>
> When you ship a prescription, come back and leave it as a citation. When you change a
> string this file quotes, re-read the quotation next to its key — the guard catches a
> rendering that no longer exists anywhere, but it does not catch one attached to the wrong
> key.

## Register

**Siz — the `-in` / `-ın` / `-un` / `-ün` imperative.** `sidebar:selectProject` ("Select a
project") is “Bir proje seçin”; `vault:unlockDescription` ends on “parolanızı girin”.
(Both shipped in batch 4; this bullet was written as a prescription in batch 1 and the
shipped strings are what it now cites — the second one is a sentence, not the two-word
fragment an earlier version of this line quoted.)

Two forms to avoid at both ends:

- The `-sana` / bare-stem singular ("seç", "gir") is too familiar for a professional tool.
- The `-iniz` / `-ınız` form ("seçiniz", "giriniz") is bureaucratic and dated; it is the
  register of government forms, not of the informal-but-professional English source.

Button labels take the same `-in` imperative where the English is a bare verb —
`sidebar:create` is "Oluştur"… with one exception worth knowing: short, isolated action
buttons conventionally take the bare stem in Turkish UI ("Kaydet", "Sil", "İptal"), while
sentences and instructions take `-in`. Follow that split; it is what Turkish users expect.

### Titles, buttons, column headers and placeholders — five shapes

English writes the same words for all of them; Turkish does not, so **resolve the control
before you translate the string.** Settled in batch 1 across the whole `config` namespace;
every later namespace follows it.

- **Titles, tab labels and section headings are noun phrases.** `config:importCsv` is
  "CSV içe aktarma", `config:routing.tabImportExport` is "İçe / dışa aktarma",
  `config:saveAsTemplateTitle` is "Proje şablonu". A dialog title takes the deverbal noun
  for the same reason: `config:models.pickTitle` is "Model seçimi", and
  `strings:achievement.dialogTitle` ("Link achievement") is "Başarım bağlama" while its own
  button `strings:achievement.linkButton` ("Link…") is the bare stem "Bağla…" — the same
  English verb, two shapes, one dialog apart.
- **A confirm-dialog title is the exception and takes the imperative** — it names the
  action you are about to authorize, not a section you are looking at.
  `config:confirmDeleteTitle` is "Projeyi sil". Keep English's question mark where it has
  one and leave it off where it does not; the source is inconsistent about this, and
  matching per key is what stops a reviewer "fixing" one of them.
- **Buttons are the bare stem** where the English is a bare verb: `config:delete` is
  "Sil", `config:routing.importBtn` and `exportBtn` are "İçe aktar" and "Dışa aktar",
  `config:saveAsTemplate` is "Şablon olarak kaydet".
- **Table column headers are bare nouns, and they keep English's abbreviation** where it
  has one: `config:models.colParameters` ("Params") is "Param.",
  `config:models.colQuantization` ("Quant") is "Kuant.". A header is chrome, and the
  length budget bites hardest here.
- **Placeholders inside a control are imperatives**, not titles.
  `config:models.select` and `config:models.pickTitle` are byte-identical in English
  ("Select a model") and are two different controls: "Bir model seçin" for the
  placeholder, "Model seçimi" for the dialog title. That pair is the one licensed
  same-English/different-rendering collision in `config`.

**A tab label that names an *action* keeps English's verb phrase; only a tab that names a
*surface* is a noun phrase.** Settled in batch 4 on the one place in the product where the
two shapes sit in the same `TabsList`: the New Project sheet's tabs are
`sidebar:createTab` ("Create new") and `sidebar:joinProject` ("Join project"), and they
ship as "Yeni oluştur" and "Projeye katıl". The noun-phrase rule above was derived from the
main tab bar, where every English label is itself a noun ("Config", "Data", "Compare"); these
two are verb phrases in English because they name what the tab *does*, and a Turkish deverbal
noun ("Yeni oluşturma") would read as a section heading over a form the user is standing in.
The sheet's own title stays a noun phrase — `sidebar:createProjectTitle` is "Proje
oluşturma" — so the title/tab distinction is visible in the shape, exactly as it is in
`config`. **`collab:join.joinButton` is byte-identical in English to the tab and ships
byte-identical here, "Projeye katıl", because the two are genuinely on screen together** (the
form is rendered inside that tab's own `TabsContent`) and English repeats itself there
deliberately.

**A confirm button still never takes "Onayla", and batch 4 adds the third member of the
"Evet, …" family.** `account:deviceForgetConfirm` is English's bare "Confirm" on the
destructive half of a two-button row, and ships as **"Evet, unut"** — the same shape as
`config:instances.deleteConfirm` ("Evet, sil") and `config:tm.clearAllConfirm`
("Evet, tümünü temizle"). The reason is unchanged: *approve* owns "onayla"
(`review:approve`). The **noun** "onay" is not caught by that bar and is free where English
means a confirmation rather than the approve action — `account:tokenPlaceholder` is
"Onay kodu" and `confirmPlaceholder` is "Onaylamak için e-postanızı yazın". Where English
means *verify a code*, the verb is "doğrula": `account:mfaConfirmButton` ("Confirm and
enable") is "Doğrula ve etkinleştir", which is also what the route does to that code.

**One key, two call sites, takes the `-in` form.** `vault:manageOnVaultPage` is rendered both
as a hint paragraph and as the button beneath it (`VaultEditorDialog.tsx`, the cloud-managed
branch), so the bare-stem button exception cannot apply — it would read as a curt command in
the paragraph. It ships as "Kimlik bilgilerini kasa sayfasında yönetin". The bare stem stays
the rule for a **short, isolated** button, which is what `vault:unlock` ("Kilidi aç"),
`setupRedirect` ("Bu cihazı kur") and `goToVault` ("Kasa sayfasına git") are.

A `-yor` progressive ("İçe aktarılıyor…", "Ölçülüyor…") is a **status**, not a command:
use it for progress text and never for a button. It is the settled shape for every progress
string in `config` — `importing`, `duplicating`, `autoSaveSaving`, `instances.creating`,
`models.loading` — so a progress label in a later namespace that reaches for a verbal noun
instead is the outlier, not the innovation.

**A pair of keys that renders the same English word takes the same Turkish shape in both.**
`config:models.footprintInspecting` and `footprintInspectingShort` are both English
"Inspecting", and both ship the progressive: "{{model}} ölçülüyor ({{done}}/{{total}})…"
and "Ölçülüyor…". Where the long member's natural Turkish word order would put a finite
verb in front of the numbers, **reorder around the tokens rather than changing the shape** —
word order around a placeholder is free, the shape of a sibling pair is not.

**A title that is a sentence in English stays a sentence.** The noun-phrase rule covers
titles that *name* something. `config:importWarningsTitle` ("Review before importing") is
an instruction, and ships as one: "İçe aktarmadan önce gözden geçirin".
`category:reviewTitle` ("Review suggestions") is the batch-3 instance — an `<h4>` over the
suggestion checkboxes with `reviewHint` under it, so it ships as the instruction
"Önerileri inceleyin", not as a noun phrase.

**Generic English "review" takes two Turkish verbs, and the split is by construction, not
by taste.** "inceleme" is the *review* term, so the plain verb is the same stem wherever
English attaches it to an object: `strings:runs.reviewSuggestions` ("Review suggestions",
a button) is "Önerileri incele" and `category:reviewTitle`, byte-identical in English,
takes the same lexeme in the instruction shape. "gözden geçir" is kept for the
**"Review before &lt;doing X&gt;"** construction alone, which batch 1 settled at
`config:importWarningsTitle` and batch 3 repeats at `category:aiHint`
("Uygulamadan önce gözden geçirin."). Do not extend "gözden geçir" past that frame: an
earlier batch-3 draft used it for "Review suggestions" too, which put two words for one
English verb inside one namespace, and the pre-flight's same-English/different-rendering
direction is what caught it.

**"Current" is "mevcut", not "geçerli", wherever the sentence could also be read as
*valid*.** `review:currentTranslation` is "Mevcut çeviri" and `category:currentTitle` is
"Mevcut kategoriler" — "Geçerli çeviri" would read as *a valid translation*, which is a
claim about quality the English does not make. Batch 2's "geçerli görünüm"
(`strings:compare.translateScopeAll`) stands: a *view* cannot be valid or invalid, so the
ambiguity does not arise there. Choose on the noun, not on the adjective.

**A term row fixes the lexeme, not the shape.** Take the *word* from `terminology/tr.md`
and the *form* from the control. An `Example:` line in a term row is an illustration, not
a ruling that the cited key keeps that grammatical form.

### Narration — the shape of a log line, settled in batch 5

`logs` and `console` are the only namespaces that narrate events instead of labelling
controls, and 59 of the 123 keys in that batch are one register. Three rules, and they are
the same three the control section already implies — written out here because a batch that
gets one of them wrong gets it wrong sixty times.

- **A completed event is the passive perfective, with no agent.** `logs:translation.done` is
  “Bir girdi {{language}} diline çevrildi.”, `logs:vault.passwordChanged` is “Kasa parolası
  değiştirildi.”, `logs:orphan.deleted` is “Yetim bir girdi silindi.” The app is the agent in
  every one of them and Turkish does not name it, exactly as English does not.
- **An in-flight event is the `-yor` progressive**, which is the same form the progress
  labels in `config` take: `logs:translation.start` is “Bir girdi {{language}} diline
  çevriliyor…” and `logs:translation.retry` is “Başarısız bir çeviri yeniden deneniyor.”
  English marks the difference with its own participles; do not flatten the two into one
  tense.
- **A state predicate is not one of these shapes. Narrate the event, copula and all.**
  `logs:lqa.passed` / `lqa.failed` (English *Quality check passed. / failed.*) shipped for one
  round as “Kalite denetimi başarılı.” / “başarısız.” — a nominal sentence with a zero copula,
  which in a stream of narrated events reads as a **badge** rather than as something that just
  happened, and this locale ships an actual badge with that adjective (`strings:row.lqaPassed`
  “LQA başarılı”) that can be painted in the string table while the console panel is open.
  Three sibling keys with the identical English construction — `glossaryGen.failed`,
  `categoryGen.failed`, `stageDetails.failed` — had already taken the perfective “başarısız
  **oldu**”, so one English shape was shipping two Turkish shapes inside one namespace. Fixed
  to “Kalite denetimi başarılı oldu.” / “Kalite denetimi başarısız oldu.”, with
  `translation.lqaRetry` following. **Whenever English writes `<subject> failed.` in this
  namespace, the rendering ends in the copula** — the *check* lexicon row settles the word
  (“başarısız” against the “geç-” root), never the shape, and the two questions have to be
  answered separately. **The converse, so the rule is not over-applied:** where the *English*
  is itself a state rather than an event, the Turkish zero copula is the faithful rendering and
  the copula must not be added. `logs:lqa.overflow` (*Translation is too long for the space
  available.*) ships “Çeviri, mevcut alan için çok uzun.” and stays exactly as it is — it is the
  only such key in the namespace, and it is a description of the translation, not a report of
  something that happened to it.
- **A failure the user could not have caused is the impersonal negative potential**
  (`-Amadı`), never a blaming imperative: `logs:translation.queueStartFailed` is “Çeviri
  çalıştırması başlatılamadı.” and `logs:backup.pruneFailed` is “Eski yedekler
  temizlenemedi.” This matches the toasts batch 2 and batch 3 already shipped
  (`strings:bulk.cancelFailed`, `review:sourceAi.startFailed`), which is why no new wording
  had to be invented for any of them.

**A tally after an em dash keeps a head noun, and the head is chosen for what the number
actually counts.** `logs:glossaryGen.done` says “{{analyzed}} girdiden {{suggested}} terim
önerildi” because those two count entries and glossary terms respectively.
`logs:stageDetails.done` deliberately has **no** head noun — “{{completed}} başarılı, {{failed}}
başarısız” — because the engine counts *languages* there and the guarantee lives in the
engine, not in the string; the runbook records the same reasoning for the two log lines whose
displayed token and selecting token happen to agree today. Where the unit is safe, name it;
where it is a fact about another file, mirror English's bare tally instead of inventing a
claim that can silently go false.

### Text addressed to the MODEL, not to the user — settled in batch 6

**The `-in` register is a rule about addressing the reader. Six strings in this locale are not
addressed to the reader at all: they are prompt text the app sends to a model, and none of them
takes the deferential form.** `stage-details:chatQuickPrompts.improve` / `shorten` / `proofread` /
`punchier` are composed into the request when the user clicks a quick action;
`stage-details:chatNoProposalRetry` is composed when they click *Retry as a direct edit*; and
`stage-details:chatQuickCurrent` (“Mevcut metin:”) is the **header line** appended above the
current text in both of those payloads. `StageChatPanel.tsx` builds each one with `t(…)` and
passes the result to `send()` — the four quick prompts and the header at `:159`, the retry prompt
and the header again at `:425` — and **none of the six is ever painted**. So
`stage-details:chatQuickPrompts.shorten` is “{{focus}} alanını anlamını koruyarak kısalt.” — a bare imperative,
matching English's own bare imperative, where the deferential form would be addressing nobody.

**The sixth is a header, not an imperative, and it is here because of its classification rather
than its shape.** `chatQuickCurrent` is a bare noun phrase with a colon, so the bare-stem rule has
nothing to bite on and the string would read the same either way. That is exactly why it went
unnoticed for a round: it was first recorded in the *Locale-specific traps* section as “the
standalone label”, with its wording licensed on a UI ambiguity — *a bare label with a colon can be
read as valid text* — **for a control that does not exist.** The rendering was right and the reason
was about a surface that is never rendered, which is this wave's signature defect. The *Current*
rule still holds on its own UI evidence; `stage-details:scopeCurrentOnly`
(“Yalnızca mevcut dil ({{lang}})”) is the painted half that carries it.

**One key in this namespace is genuinely dual-use, and it is the worked example the
check-the-call-site sentence below exists for.** `stage-details:chatFocusSource` (“Kaynak”) is
**painted twice** — the `<option value="">` of the focus-language select at `:339`, and the
language slot of a proposal card at `:377` — **and composed into prompt text twice**: at `:125` it
becomes part of `focusLabel`, which is interpolated as `{{focus}}`, and at `:419` it is passed as
`{{lang}}` to `chatNoProposalRetry`. So the prompt set is not a partition of the namespace, and a
key cannot be classified from its neighbours. A bare noun survives both roles, which is what makes
“Kaynak” right at all four sites; a key whose two roles wanted different shapes would be a finding,
not a choice.

**The buttons that trigger them are ordinary controls and follow the ordinary rule**, which is
why the pair reads as two shapes for one action: `stage-details:chatQuickActions.shorten` is “Kısalt” (a
short isolated button, bare stem) over a prompt that is also a bare stem, while
`chatNoProposalRetryButton` is “Doğrudan düzenleme olarak yeniden dene”. **Check the call site
before applying this** — every claim in this section came from opening `StageChatPanel.tsx`, and
the one claim in it that was ever wrong was the one made from the key name instead. A string in a
chat namespace is not automatically prompt text: `stage-details:chatInputPlaceholder`
(“Asistana sorun…”) is a placeholder the user reads and therefore takes `-in` like every other
placeholder in the locale, and `chatFocusSource` above is both at once.

**The vowel-harmony rule binds prompt text exactly as hard**, and this is where it bit: every
one of the five interpolates a name. `{{focus}}` is built at `StageChatPanel.tsx` as a field
label plus a parenthesised language, so it is unpredictable text — device 1, with “alan”
carrying every suffix: “{{focus}} alanının …”, “{{focus}} alanını …”, “{{focus}} alanına …”.
The same head noun carries `{{field}}` in `chatNoProposalRetry`, whose second token sits inside
brackets (device 2). Nothing in the batch attaches a suffix to a token.

## Casing

Sentence case for every control, label, tab and page title. Turkish does not capitalize
every word of a heading, so `config:routing.title` ("Routing Rules") becomes "Yönlendirme
kuralları". `english-review-notes.md` records that English Title Case on page titles is a
per-surface design convention with no meaning outside English.

Language names and nationalities **are** capitalized in Turkish ("Türkçe", "İngilizce") —
unlike the Romance and Slavic locales. Months are capitalized too ("Ocak").

Preserve uppercase only where English uses it for layout: `strings:columns.config`
("STATUS") becomes "DURUM". Preserve deliberate **lowercase** the same way — the cell
chips are lowercase by design, and so are the inline routing fragments
(`config:routing.anySource` "herhangi bir kaynak", `config:routing.promptBadge` "istem",
`config:reviewProgressInactive` "etkin değil").

**The dotted/dotless I is a real hazard when uppercasing.** In Turkish, uppercase of `i`
is `İ` (not `I`), and uppercase of `ı` is `I`. Any label you write in uppercase must use
the Turkish mapping by hand — "İçerik", not "Icerik"; "İŞLEM", not "ISLEM". Do not rely on
a generic uppercase transformation.

**And there is a third case the two rules above do not cover: uppercase applied by CSS,
which you cannot see in the JSON at all.** Many labels ship in sentence case and are
uppercased at render time by `text-transform: uppercase` — the guide group headings
(`GuideView.tsx`), the run-detail stat cards and headings (`RunsTab.tsx`), the AI-review
section headers (`TranslationAiReviewTab.tsx`), and everything matching `[data-row-action]`
under the **default** techno theme. CSS uppercasing is language-sensitive **only** through
the document's `lang` attribute.

> **Status: fixed in the app, and correct as of this batch's fix round.** `index.html`
> shipped a static `lang="en"` that nothing ever updated, so the browser applied default
> Unicode casing and Turkish "Çeviri" rendered **"ÇEVIRI"** — the wrong letter, not a
> spelling variant. Twelve batch-2 labels were affected. `i18n/index.ts` now sets
> `document.documentElement.lang` from `resolvedLanguage` on every `languageChanged`, so
> `İ` is produced correctly. **Batches 3–6 need change nothing and must not hand-uppercase
> anything to compensate** — write ordinary sentence case and let CSS do it.

Two things to carry forward from it:

- **No guard can see this class.** The JSON was correct throughout; only the rendering was
  wrong, so it passed the parity gate, the pre-flight and all seven typography sweeps. The
  only way to catch a casing defect of this kind is to know which containers uppercase and
  check `lang` is set — which is now a product invariant rather than a translator's job.
- **If you ever add a hand-uppercased value** — there are **three** in `strings`,
  each preserved because English uses uppercase for layout: `strings:columns.config`
  "DURUM" (en "STATUS"), `strings:filters.matchAll` "VE" (en "AND") and
  `strings:filters.matchAny` "VEYA" (en "OR") — the by-hand mapping rule above still
  applies to them, because no CSS is involved there. None of the three happens to contain
  an `i` or `ı`, so none was ever affected by the casing defect; they are listed so the
  count in this guide is true rather than merely harmless. **The list was itself one short, and
  the missing member is the one where the mapping bites**: `vault:keyPlaceholder`
  “ANAHTAR_ADI” (en *KEY_NAME*), shipped by batch 4 as a translated field shape rather than a
  literal — *adı* → *ADI* is exactly the by-hand mapping this section is about. So the class is
  four before this batch, and **batch 5 adds the fifth, in `console`:** `console:title` (English *CONSOLE*) is “KONSOL”, rendered inside an
  ordinary bold span with no `text-transform`, so the uppercase has to be in the value. It
  too has no `i`/`ı`, so the by-hand mapping is a formality here — but write it by hand
  anyway, because the next such value may not be so lucky.

**Two more CSS-uppercasing containers, both found in batch 5 and both in the console.** The
level-filter tabs and the export-format select trigger carry `uppercase` in their class
lists, so six filter labels and two format labels are uppercased at render time. Two of them
contain the letter that matters — “Bilgi” and “Bildirimler” — so they are the first strings
in this locale outside batch 2's twelve whose correctness depends on the `lang` attribute
fix. Nothing to do: write sentence case and let CSS do it. The list in this section is a
list of containers someone has checked, not a closed set — check the class list of any
container you write a short label into.

**And it is a hazard in the other direction too, in tooling rather than in the UI.**
JavaScript's `toLowerCase()` is locale-invariant: `"İstem".toLowerCase()` is `i` plus a
combining dot (U+0307), not `i`. The lexicon citation guard
(`scripts/check-lexicon-citations.mjs`) lowercases both sides before comparing, so a
rendering you cite in `terminology/tr.md` is only attested against corpus occurrences that
are **already lowercase** if the word starts with `İ`. When you cite such a word, make sure
some shipped string carries it lowercase — batch 1's "istem" is attested through
`config:routing.promptBadge`, not through `config:routing.labelPromptOptions`.

**One do-not-translate collision to know about.** The guard's term check counts `API`, and
Turkish "KAPI" contains it. The check now matches on token boundaries so "KAPI" no longer
registers, but the near-miss is real: it is one of two reasons *quality gate* is "kalite
geçidi" and never "kalite kapısı".

## Punctuation and spacing

- No space before `:` `;` `!` `?`.
- Quoting a value: `“…”`, matching the English source after its review —
  `config:duplicateSuccess` ships `“{{name}}” projesi çoğaltıldı.` The **placeholder is
  untouched; the two characters around it are ours.**
- **Adding quotes English does not have is licensed in exactly two places.** It is not
  licensed for prose values, and never for a number.
  1. **An identifier.** `config:instances.formTitle` / `instanceOf` / `slugHelp` quote
     `{{base}}` so the module id reads as a name rather than as part of the sentence,
     exactly as English itself quotes `{{slug}}` and `{{model}}` in the same namespace.
  2. **A control label used as a sentence constituent.** English can drop a button name
     into a sentence bare, because its imperative and its bare noun phrase are homographic:
     *Review last run will judge…* reads as a subject. **Turkish has no such homography** —
     "Son çalıştırmayı incele" is an unambiguous 2nd-person imperative, so leaving it bare
     produces a command followed by a finite clause whose subject cannot be recovered. Put
     the label in “ ”. Shipped: `review:translationAi.emptyHintRun`
     (“Son çalıştırmayı incele”, …) and `review:sourceAi.emptyHint`
     (“İncelemeyi çalıştır”, …). The label inside the quotes is copied **verbatim** from the
     control it names (`translationAi.runReview`, `sourceAi.runReview`) — the quotes are the
     only thing added.

  Batch 3 shipped both bare for one round; they parsed as broken Turkish, and it was the
  reviewer, not a gate, that caught it — no guard can see a missing subject.

  **Only one other string is a precedent for this licence.** `glossary:generateRunningHint`
  (“Üret” düğmesini) quotes a control where English writes the label bare — the same device
  as item 2. Two nearby strings also quote a control, `review:translationAi.emptyHintNoRun`
  (“Tüm çevirileri incele”) and `review:sourceAi.scopeNoneHint` (“Tüm girdiler”), but there
  **English quotes it too** (`"Review all translations"`, `"All entries"`), so those are the
  ordinary mirroring rule two bullets up, not this licence. Do not read them as evidence that
  this locale adds quotes to control names freely; it does not.

  **Scope, stated as a conditional rather than a prediction.** The control-label-as-subject
  shape occurs in exactly **two** keys in the whole product — the two above. A scan of all 24
  English namespaces finds none in `vault:`, `orphans:` or `backup:`, whose nearest strings
  take a gerund subject (“Restoring will overwrite …”), which is unambiguous in Turkish and
  is not this shape. So: *if* the shape recurs in a later batch, this is the device. An
  earlier version of this note predicted batches 4–6 would meet it again; that prediction was
  never checked, and it is false.
- Ellipsis is the single character `…` (U+2026), matching `common:saving` ("Saving…") —
  "Kaydediliyor…".
- Turkish attaches case suffixes to proper nouns with an apostrophe ("NARN'ı", "API'sini",
  "VRAM'i"). Use the plain ASCII `'` for it, not `’` — that is Turkish practice, and the
  straight-quote sweep below is about quotes **around a value**, not about this apostrophe.
  Do this only on literal names you can see; see the placeholder rules for why never on a
  token.
- Em dashes in the source stay em dashes with spaces around them. Never a hyphen.

### Keyboard key names — Latin, as engraved

**`Enter`, `Esc`, `Shift`, `Tab`, `Ctrl` and `Alt` stay in English for this locale**, and
that is a decision about the hardware, not an untranslated leftover: a Turkish Q or F keycap
is printed with the Latin words. `terminology.md`'s rule is "write the key name as it is
engraved on that locale's keyboard", and here the engraving is English — unlike French
(**Entrée**, **Échap**, **Maj**) or Spanish (**Intro**, **Mayús**).

Shipped in batch 2 at `strings:compare.contextPlaceholder` and `tonePlaceholder`
("kaydetmek için Enter, yeni satır için Shift+Enter, iptal için Esc"),
`strings:compare.cellEditTooltip` ("Düzenle · Enter · iptal için Esc") and
`cellEditReviewedTooltip` ("İncelendi — düzenlemek için Enter'a basın").

Two consequences worth knowing:

- **A case suffix on a key name takes the apostrophe** — "Enter'a basın" — because it is a
  literal proper noun you can read in the string. That is the licensed use of the
  apostrophe form; it is still **never** available on a `{{token}}` (see the placeholder
  section).
- **The same words translate normally as verbs and nouns.** "Enter your password" is not
  this rule; read the string, not the word.

## Numbers and dates

Decimal comma, thousands point: `1.234,56`. `config:overflowRatioDescription` ships
"Varsayılan: 1,75." for English's "1.75".

No space before `%`, and Turkish writes the sign **before** the number ("%50") — follow
that where the number is literal, including where the English writes it after:
`config:health.successRate` ("Success {{rate}}%") ships "Başarı %{{rate}}", and
`config:models.gpuPlacement` ("{{pct}}% GPU") ships "GPU %{{pct}}". Verified rather than
assumed: `new Intl.NumberFormat('tr-TR',{style:'percent'}).format(0.9)` is `%90`.

**A percent range takes one sign, at the front of the range** — not one per bound and not
one at the end. Batch 3's three quality tiers are the worked set:
`quality:legend.tierHigh` is "Yüksek geçme oranı (≥ %90)", `tierMid` is
"Orta geçme oranı (%70–89)" and `tierLow` is "Düşük geçme oranı (< %70)". English writes
"(70–89%)", with the sign after the upper bound; moving it to the front is the same rule
as the single-number case, and the en dash between the bounds is kept as English has it.

**A currency symbol PRECEDES the number in Turkish, so the four cost strings keep English's
order.** `strings:runs.estimatedCost` ships "≈ ${{amount}}", and `projectTotal` /
`projectTotalYou` / `projectTotalCollaborators` follow it. CLDR is unambiguous, and it is
the same for every currency including the lira:

```
Intl.NumberFormat('tr-TR', {style:'currency', currency:'USD'}).format(1234.5)  →  "$1.234,50"
                                                              TRY              →  "₺1.234,50"
                                     (de-DE, USD, for contrast)                →  "1.234,50 $"
```

**The percent sign goes before too** ("%50"), so Turkish puts *both* signs before the number
and is internally consistent — it is not a locale where the two signs sit on opposite sides.
Nor is German the mirror of it: `de-DE` gives "50 %" and "1.234,50 $", i.e. both signs after.
The two locales are consistent opposites, not mirrors. An earlier version of this section
claimed the currency symbol follows the
number and had four strings inverted on that basis; the claim was false and the strings were
reverted. **Verify a typographic rule against `Intl` before writing it down** — it takes one
line, and the app formats every other number from the browser locale anyway, so a hard-coded
placement that disagrees with `Intl` is inconsistent with the rest of the UI by
construction. There is a real mixed usage for the lira in Turkish price displays, which is
probably where the wrong rule came from; it does not survive CLDR and it does not transfer
to the dollar sign at all.

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string. `{{time}}` is an `Intl.RelativeTimeFormat` output ("3 dk. önce"),
which is why `config:models.updated` can read "{{time}} güncellendi" in natural Turkish
word order.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

### Vowel harmony over an interpolated value — the rule

**Never attach a suffix directly to a token.** A Turkish suffix agrees with the final vowel
of the word it attaches to (and often takes a buffer consonant chosen by the final sound).
A `{{token}}` renders a value that is unknown until runtime, so any suffix written against
it is a coin flip — right for the values that happen to harmonize and wrong for the rest.
There is no i18next mechanism that could choose the allomorph, and nothing in the gate can
see the defect: it ships, and it is wrong for most values.

Three devices, in order of preference:

1. **Appositive — put a real noun after the token and suffix that instead.** The token
   stays bare in the nominative and the head noun carries every suffix the sentence needs.
   Shipped: `config:enableModuleAddInstance` is "Başka bir {{name}} örneği ekle…" and
   `config:models.useCustom` is "“{{model}}” modelini özel model olarak kullan" — "örneği"
   and "modelini" harmonize with "örnek" and "model", never with the interpolated value.
2. **Restructure so the token lands at the end of a clause, behind a colon, or inside
   brackets.** This is the count-neutral device the runbook prefers for numeric tokens, and
   in this locale it is also the fallback whenever device 1 is unavailable.
3. **Invariant postposition.** Turkish postpositions — "için", "ile", "gibi", "kadar" —
   do not harmonize, so "{{name}} için" is safe where a case suffix would not be.

**The apostrophe form is not device 4.** Turkish writes a case suffix on a proper noun with
an apostrophe — "NARN'ı", "API'sini" — and it is tempting to reach for `{{model}}'i`. It
does not help: the apostrophe separates the suffix, it does not choose it. You would still
be picking one of `-i / -ı / -u / -ü` for a value you cannot see. The apostrophe is for
literal names **you can read in the string**, never for a token.

### Which device a string takes — open the call site, do not consult a list

**The rule turns on what the token's value can be, not on what the token is called.** One
question decides it, and you answer it at the call site:

> **Is the token `{{count}}`?**
>
> - **Yes — stop here. Write the plain, natural Turkish: `{{count}}` + the singular
>   noun.** "{{count}} satır işlendi", "{{count}} kural", "{{count}} yetim". `{{count}}` is
>   the one token i18next selects a plural category for, so its own family handles
>   agreement — and Turkish does not mark the plural after a numeral anyway, so there is
>   nothing to make grammatical and **nothing to restructure**. Roughly eighteen strings in
>   `config` are this shape. The rest of this section does not apply to them.
>
> **Otherwise — can this token's value ever be a number the reader counts?**
>
> - **No** — it is an id, a name, a language, a message, a timestamp, a model, a slug.
>   **Device 1 is available**, and is usually the best Turkish: write the natural
>   appositive, and the following head noun carries the suffix. It is *available*, not
>   compulsory — device 2 is often the better sentence anyway, and three `config` strings
>   correctly take it on non-numeric tokens (`credentialsMissing`, `activatedLanguages`,
>   `rawNewlineLanguagesNotice`, all of which end on a list the reader scans). Choose on the
>   sentence; either is safe here.
> - **Yes, and it is not `{{count}}`** — a total, a size, a limit, a rate, a token count, a
>   position. **Write the natural Turkish here too, unit noun and all: "en fazla
>   {{maxLength}} karakter", "{{chars}} karakter / {{bytes}} bayt".** The runbook's
>   *"Only `count` triggers plural selection"* rule demands a count-neutral frame for these
>   tokens because in most languages the noun after them inflects and the framework cannot
>   select the form. **Turkish has no numeral agreement at all** — a noun after any numeral
>   stays in the bare singular — so there is no form to get wrong and the frame buys this
>   locale nothing. Device 2 stays available as a *stylistic* choice where the sentence
>   reads better with the number last; it is not a requirement.
>
> **Two rules survive all three branches, and they are the ones that actually bind:** never
> weld a suffix onto a token (the section above), and never swap the token English wrote for
> a different one — interpolating `{{count}}` in place of `{{total}}` fails the placeholder
> multiset check, whatever it does for the grammar.

An earlier version of this section said the device was chosen by whether the token appeared
on the pre-flight's 23-name `NUMERAL_TOKEN_SKIPLIST`. **That was wrong, and it is worth
saying why**: that list is a Russian-calibrated description of which tokens in this app
cannot hold a number — a fact about the app, useful as a *hint* for the question above —
not a grammar policy for 1,500 Turkish keys. Reading it as policy also made the guide
disagree with its own batch: `config:models.confidenceReason.effort-reduces-quality` ships
device 1 on `effort`, which is not on that list, and it is perfectly correct Turkish.

#### The tooling constraint that used to bind here — and no longer does

**Read this before copying batch 1's shapes: the blocker is gone.** While batch 1 was
written, `tr` had no `NUMERAL_WORD_AXIS_EXEMPTIONS` entry, so *every* `{{token}}` + space +
Turkish word occurrence outside the token skiplist was reported as an uncleared candidate
and the pre-flight exited non-zero — which blocked the bare device-1 form even where it was
the correct Turkish. `scripts/i18n-preflight.mjs` now carries
`NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES`, and `tr` is in it: because Turkish counted nouns
never inflect for number, there is no numeral-word agreement to check, so every token-axis
survivor is cleared **unconditionally** — "there is nothing to look for", not "nobody has
looked yet". The script's own comment names `{{total}} girdi` as the correct string the old
behaviour would have failed.

Two consequences:

- **Device 1 is now available for every non-numeric token**, bare, in natural word order.
  No punctuation trick is needed to satisfy the gate.
- **The identifier quoting in `config:instances.*` (`“{{base}}” örneği`) stands on its own
  merits, not on the gate.** Keep it: English quotes identifiers in the same namespace
  (`config:instances.slugReserved`, `config:models.useCustom`), and punctuation around a
  placeholder is ours to set. But do not reach for it as a workaround — there is nothing
  left to work around.

Turkish's real numeral-adjacent hazard is a different check now: **1b, "Welded suffix"**,
which gates a case or particle suffix written directly against a token. That is the one to
keep clean.

#### Worked example — `config:instances.formTitle` ("New instance of {{base}}")

- **Wrong:** "{{base}}'in yeni örneği". The genitive is `-in / -ın / -un / -ün` plus a
  buffer `n` after a vowel. `openai` wants "openai'nin", `deepl` wants "deepl'in", `gpt-4`
  wants "gpt-4'ün". One string cannot be right for all three, and two of the three are
  wrong however you write it.
- **The question:** can `{{base}}` be a number? No — it is a base module id. **Device 1.**
- **Shipped: "Yeni “{{base}}” örneği"** — the appositive, in natural Turkish word order,
  with the identifier quoted. The suffix rides on "örnek". Its sibling
  `config:instances.instanceOf` ships the same shape, "“{{base}}” örneği", so the badge and
  the dialog title agree.

#### Numeric tokens, as shipped — natural order, unit noun attached

Every one of these carries a token whose value **is** a number. They ship in ordinary
Turkish word order, with the unit noun where a Turkish writer would put it:

| Key | English | Turkish |
| --- | --- | --- |
| `config:reviewProgressCount` | `{{reviewed}} / {{total}} reviewed` | `{{reviewed}} / {{total}} incelendi` |
| `config:lqa.lengthLimitValue` | `{{chars}} chars / {{bytes}} bytes` | `{{chars}} karakter / {{bytes}} bayt` |
| `config:templateMeta` | `{{languages}} languages · {{rules}} routing rules` | `{{languages}} dil · {{rules}} yönlendirme kuralı` |
| `config:routing.templateMeta` | `max {{maxLength}} chars` | `en fazla {{maxLength}} karakter` |
| `config:models.confidenceReason.prompt-near-context` | `(~{{tokens}} tokens)` | `(~{{tokens}} token)` |
| `config:models.confidenceReason.batch-exceeds-reliable` | `{{entryCount}} entries exceed the ~{{reliable}}` | `{{entryCount}} girdi, … ~{{reliable}} sınırını aşıyor` |

**Never drop the unit noun.** Whether the number comes first or last, "karakter", "bayt",
"token" and their kind stay: a bare number in a metadata strip says nothing, and rubric
item 4 is about exactly this. `config:routing.templateMeta` is the standing example: it
ships "en fazla {{maxLength}} karakter". A round-1 draft of it read *uzunluk sınırı*
followed by the bare number, with no unit at all — that is the shape to avoid, and it is
quoted here as a wrong form, not as a rendering.

**These six shipped inverted for one round, and the story is worth keeping.** Turkish's
natural order was blocked while batch 1 was written: the pre-flight then treated `tr` as an
uncalibrated word axis, so "{{maxLength}} karakter" reported as an uncleared survivor and
failed the gate. It was recorded as calibration debt — a word axis waiting to be derived
from whole-language survivors. **The debt turned out not to be real.** Turkish nouns never
inflect after a numeral, so there is nothing for a word axis to catch and none was ever
needed; `tr` is now in `NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` and the natural order passes.
The six were restored in fix round 3. **The lesson generalises past this locale: an
inversion that exists only to keep a detector quiet is a guard authoring copy, which the
runbook forbids — when a shape looks unnatural, check whether a tool is the only thing
asking for it before you write it down as a convention.**

#### Non-numeric tokens, as shipped in batch 2 — the cell aria-labels

Five sibling `aria-label`s in the Compare grid all interpolate `{{language}}`, and they are
the clearest worked set of device 1 vs device 3 in the language. A screen reader speaks an
ungrammatical form verbatim, so this family is worth copying rather than re-deriving.

| Key | English | Turkish | Device |
| --- | --- | --- | --- |
| `strings:compare.cellMarkReviewedAria` | `Mark {{language}} translation as reviewed` | `{{language}} çevirisini incelendi olarak işaretle` | 1 — "çeviri" carries the suffix |
| `strings:compare.cellClearAria` | `Clear translation for {{language}}` | `{{language}} çevirisini temizle` | 1 |
| `strings:compare.cellEditAria` | `Edit translation for {{language}}` | `{{language}} çevirisini düzenle` | 1 |
| `strings:compare.cellRetranslateAria` | `Re-translate {{language}}` | `{{language}} için yeniden çevir` | 3 — invariant "için" |
| `strings:compare.cellUndoAria` | `Previous versions for {{language}}` | `{{language}} için önceki sürümler` | 3 |

**Why two devices inside one family, deliberately.** Device 1 needs a head noun to carry the
suffix, and for the first three that noun is "çeviri", which their English names too. The
last two have no such noun available: device 1 on `cellRetranslateAria` forces
"{{language}} çevirisini yeniden **çevir**" — the same root twice in four words — and
`cellUndoAria`'s head is already "sürümler", which cannot take the language. The invariant
postposition is the better sentence in both, and it is just as safe. **Choose on the
sentence, not on the family**: the rule that binds is that no suffix ever touches the token.

`strings:runs.copyRunId` ("{{runId}} çalıştırma kimliğini kopyala") and
`strings:runs.runFailedToast` ("{{type}} çalıştırması başarısız oldu") are the same device 1
shape on other tokens, and `strings:achievement.dialogSubtitle` ("“{{text}}” için karşılığını
seçin.") is device 3 with the identifier quoted exactly as English quotes it.

### Counted nouns stay singular

After a numeral, Turkish does not mark the plural: `config:routing.ruleCount_other`
("{{count}} rules") is "{{count}} kural", with no `-lar`. **That means `_one` and `_other`
are usually byte-identical, which is correct and not a copy-paste error** — four families
in `config` ship that way and the pre-flight reports them as same-rendering collisions,
all licensed for this one reason.

Where the two categories *can* legitimately differ, make them differ: a demonstrative plus
a noun carries no numeral, so `config:exportRoundtripWarning_one` ends "o hücreyi düzeltin"
against `_other`'s "o hücreleri düzeltin".

### Plural categories

`Intl.PluralRules('tr')` gives **`one` and `other`** — exactly English's set. So:

- Turkish ships **1,920 keys, twelve more than English's 1,908** — no `_few`, no `_many`, and
  no missing category, but one `_one` that English does not have for each of the twelve
  `bare + _other` families. **This corrects an earlier version of this bullet, which said
  "the same key count as English, 1,908".** That sentence was wrong and it was wrong in a way
  worth keeping visible, because the reasoning behind it is right and only its conclusion was
  not: Turkish's category set *is* English's, so a family English spells `_one` + `_other`
  costs Turkish exactly two keys. The twelve exceptions are the families English spells
  **bare + `_other` with no `_one` at all** (runbook 2.3 — verified against
  `locales/en` rather than quoted: 41 families, 29 with `_one`, 12 without, 0 other shapes).
  English's *singular* there is the bare key, and a bare key is a plain key, not a category —
  so a Turkish family that copies that shape has **no `one` form**, and `pnpm check:locales`
  in strict mode fails it. Measured, not reasoned: deleting `vault:keysCount_one` and
  re-running `LOCALE_PARITY_STRICT=tr pnpm check:locales` produces
  `FAIL — tr: 1 plural family do not supply "_one" … including 1 a bare "key" sibling would
  otherwise rescue`. Restoring it is green. **Batch 4 shipped four of the twelve — all in
  `vault`. Batch 5 owes the other eight: two in `console` (`unreadErrors`,
  `membersNotShown`) and six in `logs` (`translation.queued`, `translation.failedNoRoute`,
  `translation.failedModuleDisabled`, `translation.failedModuleNotFound`,
  `sourceReview.done`, `orphan.detected`).** Do not rediscover this — the `_one` will not be
  in the English file you copy, and the gate will not mention it until you run strict mode.
  Note also that `logs:translation.queued` and `logs:sourceReview.done` are the two the
  runbook flags for a *different* reason on top of this one: each displays a non-`count`
  token while selecting on `count`.
  **Batch 5 shipped the other eight and the twelve are now complete.** All eight come out
  byte-identical across bare / `_one` / `_other`, which is the third of the three shapes batch
  4 met and the commonest one: a Turkish noun after a numeral never inflects, and none of the
  eight has a possessive or a demonstrative that could carry a number the way
  `vault:retrySuccess` does. `logs:sourceReview.done` is “Kaynak incelemesi {{findings}} sorun
  buldu.” in all three, and the other seven behave the same way. **The bare keys are
  unreachable and were checked, not assumed:** every one of the eight is reached through a
  call site that always passes a count — the six `logs` families through the log-presentation
  registry, whose presenter for each of them sets `count` explicitly, and the two `console`
  families through the unread-error badge and the grouped-row overflow line, both of which
  interpolate a count. They are written count-neutral anyway, per the runbook.
  **Batch 6 adds none of either, and the language closes at 1,920 exactly.** Its seven
  namespaces contain **no plural family at all** — no `_one`, no `_other`, no `_zero` in any of
  the seven English files — so the batch ships 282 keys against English's 282, and the
  whole-language total is English's 1,908 plus the twelve `_one` forms batches 4 and 5
  supplied. Verified by counting both trees rather than by adding up the batch reports.
- **Keep the bare key.** English has it, so key parity requires it, and it is the sibling
  that rescues the family in the default gate. Write it count-neutral: once `_one` and
  `_other` both exist it is unreachable. **Checked rather than assumed, because supplying
  `_one` is what makes it unreachable:** all four `vault` families are called with a `count`
  at every one of their call sites — `keysCount` at `GlobalConfigView.tsx:312`,
  `remainingAttemptsHint` at `VaultUnlockDialog.tsx:82`, `retrySuccess` and `retryFailed` at
  `AppShell.tsx:770` and `:773` — so no site reaches the bare key at all, and nothing
  regressed by adding the singular. (`strings:runs.retryFailed` is a different key in a
  different namespace; do not confuse the two when grepping.)
- **The counter-argument, stated so nobody re-opens it as if it were new.** Turkish counted
  nouns stay in the bare singular after a numeral, so the singular and the plural of
  `keysCount` are byte-identical and the `_one` form buys the *reader* nothing. It is
  supplied anyway, for two reasons that outrank that: `LOCALE_PARITY_STRICT=tr` fails without
  it (measured above), and two of the four families — `retrySuccess` and `retryFailed` — do
  have a real singular/plural distinction in Turkish that lives in the possessive noun
  ("işleminiz" / "işlemleriniz"), not in numeral agreement. A shape that is right for two of
  the four and merely harmless for the other two beats one that is wrong for two.
- Copy English's plural shape as-is, add the missing `_one` where English has none, then
  apply the singular-after-numeral rule to the wording.
- `_zero` remains legal in every locale and English already ships one
  (`strings:bulk.removeCategoryApply_zero`); keep it. Never add a `_plural` suffix — it
  never resolves.
- The twelve `bare + _other` families (listed in the runbook) all live in `console`, `logs`
  and `vault`, none in `config`. Read the runbook's section 2.3 before writing them: your
  `_one` is checked against English's `_other`, so it must carry `{{count}}` even where
  English's own singular does not. **The four in `vault`, as shipped in batch 4, are the
  worked set** — and they come out three different ways, which is the point:
  `keysCount` and `remainingAttemptsHint` are byte-identical across bare/`_one`/`_other`,
  because a Turkish noun after a numeral never inflects and the frame is already
  count-neutral; `retrySuccess` differs in all three (bare has no token, `_one` carries
  `{{count}}` because it is checked against English's `_other`, `_other` adds "tümü" for
  English's "all"); `retryFailed` carries **no** token in any form — neither English form has
  one — and differs only in the number of the noun ("işleminiz" / "işlemleriniz"), with bare
  and `_one` identical because they say the same thing.

## Length discipline

Turkish is **about the same length as English or slightly longer**, because agglutination
packs prepositions and possessives into suffixes. Measured over the 374 shipped `config`
keys: aggregate **1.10**, median **1.07**, 90th percentile **1.43**, longest single ratio
1.92 (`config:deselectAll`). Over the 452 shipped `strings` keys: aggregate **1.16**, median
**1.13**, 90th percentile **1.70**, longest single ratio 3.33 (`strings:compare.run`, three
English characters against “Çalıştırma”). Over the 377 batch-3 keys
(`glossary` + `review` + `category` + `quality`): aggregate **1.08**, median **1.06**, 90th
percentile **1.50**, longest single ratio 3.00 (`review:sourceAi.findingTypo`, four English
characters — "Typo" — against “Yazım hatası”). Over the 300 batch-4 keys
(`collab` + `account` + `vault` + `settings` + `sidebar`): aggregate **1.09**, median
**1.08**, 90th percentile **1.50**, longest single ratio 2.80 (`sidebar:legal`, five English
characters — "Legal" — against “Yasal bilgiler”). **State the population**: that is the 300
keys this batch shares with English; the batch ships **304** `tr` keys, the extra four being
the `_one` forms the four `vault` `bare + _other` families owe (see "Plural categories"),
which have no English counterpart to be a ratio of. Over the 123 batch-5 keys
(`logs` + `console` + `system` + `errors` + `generation` + `batch`): aggregate **1.10**,
median **1.09**, 90th percentile **1.52**, longest single ratio 2.60 (`console:filter_debug`,
five English characters — *Debug* — against “Hata ayıklama”). **State the population**: that
is the 123 keys this batch shares with English; the batch ships **131** `tr` keys, the extra
eight being the `_one` forms the eight `bare + _other` families in `console` and `logs` owe.
The batch is the lowest-tail one so far and the reason is the register: 59 of its keys are
whole narrated sentences, where Turkish and English cost about the same, and the tail is again
the handful of one-word labels. Over the 282 batch-6 keys
(`stage-details` + `colorText` + `orphans` + `backup` + `welcome` + `common` + `legal`):
aggregate **1.14**, median **1.12**, 90th percentile **1.55**, longest single ratio 2.40
(`stage-details:stale`, five English characters — *Stale* — against “Güncel değil”). **State
the population**: that is all 282 keys, and for this batch it is also the whole of it — the
namespaces carry no plural family at all, so `tr` ships exactly 282 keys here and there is no
second population to distinguish. It is the highest-tail batch since `strings`, for the same
reason `strings` was: seven small namespaces are mostly one- and two-word chrome, and a short
English source is what makes a large ratio.

**The whole-language figures, re-derived after the last string edit of the last batch.** Over
the **1,908 keys `tr` shares with English**: aggregate **1.11**, median **1.08**, 90th
percentile **1.56**, longest single ratio 3.33 (`strings:compare.run`). Over the **full 1,920
`tr` keys**, each extra `_one` measured against the English form it resolves to: aggregate
**1.11**, median **1.08**, 90th percentile **1.55**. **The two populations barely differ here,
and that is a fact about this language rather than a rounding accident** — Turkish carries only
twelve keys English has no counterpart for, against Russian's ninety-four, so the denominator
the runbook warns about cannot move these apart. A language with a larger category set must
still state which population it measured. Turkish is **slightly shorter in aggregate than every
locale shipped before it** (ru 1.19, es 1.22, fr 1.26) and yet sits in the same place at the
tail, which is the runbook's point restated: the aggregate is not what breaks chrome. **The two namespaces differ because
`strings` is chrome:** it is full of one- and two-word labels, and a short English source is
what produces a large ratio — the tail here is not long renderings, it is short sources. The catch is distribution, not the aggregate: fewer,
much longer single tokens ("değerlendirilemedi", "yapılandırmalarınızı"), which clip rather
than wrap, and a tail that is what breaks chrome.

**Budgets are absolute character counts, per class — never a multiple of English.** A ratio
is the wrong unit when the English source is short: "Legal" is five characters, and no
correct Turkish rendering of it can fit 1.5×. The four classes are not equally constrained:
**one of them is hard** — the sidebar container, which holds both the sidebar items and the
tab labels — and the other three scroll, auto-size or wrap, where going long costs elegance
rather than correctness.

| Class | Anchor key | Budget | Kind | Basis |
| --- | --- | --- | --- | --- |
| **Sidebar item _and_ tab label — one class, one container** | `sidebar:globalConfig`, `sidebar:legal`, `strings:tabs.backup` | **199px ≈ 27–29 tr chars** | **hard** — fixed `16rem` (`SIDEBAR_WIDTH`), `truncate` | the container, measured: 256px − 1 border − 16 `SidebarGroup p-2` − 16 `SidebarMenuButton p-2` − 16 icon − 8 `gap-2` = 199px. **199px is what binds**; the character figure is a density-dependent proxy — see below |
| Table column header | `strings:columns.config` | 20 | soft | measured — longest shipped is 18: `strings:runs.runIdColumn` "Çalıştırma kimliği" |
| Filter label | `strings:filters.needsReview` | 40 | soft | measured — longest shipped is 38: `strings:filters.lqaFailed` "Yalnızca LQA başarısızlıklarını göster" |
| Bulk-bar control | `strings:bulk.approveSelected` | 40 | soft | measured — longest shipped control is **40** as a template / ~35 rendered: `strings:bulk.selectAllFiltered` "Filtrelenen {{count}} satırın tümünü seç", which **equals the budget rather than sitting under it**; longest static one is 23, the anchor itself, "Çeviri belleğine onayla" |

**There is no main tab bar in this product, and the tab labels are sidebar items.**
`strings:tabs.*` has exactly two call sites, both in `components/layout/Sidebar.tsx` (785,
788) — a `SidebarMenuButton` tooltip and a `<span className="truncate">` inside it — so a
tab label lives in the **same physical container** as a sidebar item and is held to the same
hard budget. An earlier version of this table split them into two classes and called the tab
one *soft*, on the strength of two sentences that described a wider scrolling bar and said
"only the sidebar has a fixed width". **Both sentences were false and both are deleted.**
This is not a raise of `config`'s in-panel figure of 26 either: `config:routing.tab*` is a
genuinely different, softer container, and its number was never a floor for this one.

**The pixel figure is what binds; the character count is a per-language proxy — and it is a
RANGE, not a number.** This paragraph used to read "Turkish averages 7.09px per character in this
class", giving a single figure of ~28 characters. **7.09 was never a class average: it is one
label's own density.** `strings:tabs.review-source-ai` is recorded two paragraphs down at 198.4px over 28
characters — 198.4 ÷ 28 = 7.086 — and its sibling `strings:tabs.review-translation-ai` is 187.4px over the
same 28 characters, i.e. 6.693. **Two labels in one class differ by 6%**, so no single density can
describe the class, and the arithmetic that produced "28 chars" was one label generalised.

Measured across the whole 25-label class by the whole-language sweep: the mean is **6.741 px/char**
(199 ÷ 6.741 = **29.5** characters) and the densest label is **7.308 px/char**
(199 ÷ 7.308 = **27.2**). So the honest proxy is **27–29 characters depending on the label's own
density**, and a label near the top of the range must be checked in pixels rather than counted.
(The two class-wide figures are the sweep's measurement; the density arithmetic above is
re-derived here from this file's own recorded pixel widths. Measuring glyph advances needs the
font, so re-derive them with a real text measurement, not by counting characters.)
Re-derive the range per language; do not port this one.

**The two 28-character tab labels are inside the budget and stay exactly as they are.**
Measured with real glyph advances: `strings:tabs.review-source-ai` "Kaynak yapay zekâ incelemesi" is
198.4px and `strings:tabs.review-translation-ai` "Çeviri yapay zekâ incelemesi" is 187.4px, both
under 199px. For scale, shipped Russian's 28-character label in this same class is 215.7px,
overflows by 17px, and ships anyway. They are also forced by a term rule — *AI review* is
"yapay zekâ incelemesi" and the AI is never abbreviated to "YZ" — which the runbook says
outranks the budget.

**Do not shorten a settled surface name to fit a number**, and note that the reason is not
the budget: every later batch repeats these names verbatim, so a shortened tab label
propagates into four namespaces at once. Measure first, and if a name genuinely does not
fit, escalate rather than trimming it.

**One caveat to record rather than act on.** `SidebarMenuButton` carries
`data-active:font-medium`, so the tab you are *on* renders at weight 500. Geist's advances
grow ~1.5–3% with weight, which puts `strings:tabs.review-source-ai` at roughly 201–203px while
selected — it may clip a character or two, only on the tab whose label you least need. Not
a reason to shorten it.

**Batch 4 is the first batch to write into the hard class, and everything fits with room to
spare.** The sidebar items it owns run: `colorText` "Metin biçimlendirici" **20**,
`globalConfig` "Genel yapılandırma" **18**, `changelog` "Değişiklik günlüğü" **18**,
`legal` "Yasal bilgiler" 14, `translationMemory` "Çeviri belleği" 14, `aboutNarn`
"Narn hakkında" 13, down to `guide` "Kılavuz" 7 and `account` "Hesap" 5; the six group
headings run 5–11 ("Terminoloji" is the longest). The budget is 28 characters / 199px, so
the longest is 20 characters ≈ 135–146px across this class's density range — a margin so wide
that the mean-advance proxy cannot be wrong enough to matter, which is why this batch did not
need per-glyph measurement the way batch 2's two 28-character tab labels did. **Nothing was
shortened to fit and nothing needed escalating.** Two notes for whoever measures next: the
longest of them, `sidebar:colorText`, has no live call site at all (`PAGE_ITEMS` in
`Sidebar.tsx` does not list it), so the real longest *rendered* item is 18; and the four
longest `sidebar` values overall are toasts and aria-labels (`templateWarningUnknownGlossary`
at 51), which are not in this class and must not be counted into it.

Batch 4 moved no soft figure either. Its longest column header is **18**
(`collab:sharing.columnLanguages` "Yazılabilir diller" and `collab:invites.columnCreated`
"Oluşturulma tarihi", budget 20 — tying batch 2's longest, `strings:runs.runIdColumn`), and it ships
no filter label and no bulk-bar control.

**Batch 6 touches one soft class, moves nothing, and adds nothing to the hard one.** It ships
no sidebar item and no `strings:tabs.*` key, so the 199px container is untouched by the last
batch of the language. Its only column headers are `orphans:columns.*`, the longest of which is
**9** (`orphans:columns.translations` “Çeviriler”, budget 20). `orphans:columns.select` is
**not** in that class and must not be measured into it: despite its key name it is the
`aria-label` on the select-all checkbox and on every row checkbox — two call sites, which is
why it ships as the deliberately generic “Seç” rather than being specialised to either. The
batch ships no filter label; the one control that could be read into the bulk-bar class,
`orphans:actions.bulkDelete` (“Seçilenleri sil ({{count}})”), is 26 characters as a template
against a budget of 40, and it sits in the Orphans toolbar rather than in the bulk bar the
anchor was measured from. So all four figures stand exactly as batch 2 left them, across the
whole language.

**Batch 5 touches one soft class and does not move it either.** The console's six level
filters are filter labels; the longest is 13 (`console:filter_debug` “Hata ayıklama”, budget
40), well inside it even though it is the batch's largest ratio — a five-character English
source is what produces that number, not a long rendering. The batch ships no sidebar item,
no column header and no bulk-bar control, so the hard class is untouched.

**Batch 3 tested the three soft figures against a second namespace group and none moved.**
Over `glossary` + `review` + `category` + `quality` the longest column header is **11**
(`quality:columns.passRate` "Geçme oranı", budget 20), the longest filter label is **16**
(`review:filterNeedsReview` "İnceleme gerekli", budget 40) and the longest bulk-bar control
is **38** as a template / ~34 rendered (`glossary:bulkMarkConstant`
"{{count}} terimi sabit olarak işaretle", budget 40). The batch adds **no** value to the
hard sidebar class — it names surfaces but never labels one. So the four figures stand as
batch 2 left them; the whole-language sweep still re-measures.

**The three soft figures were all re-derived by batch 2** from the longest value `strings`
actually ships; batch 1 could measure only the column-header class (from
`config:models.col*`) and had no filter row or bulk bar at all. Each is the longest shipped
value plus a little headroom. The whole-language sweep re-measures every class over the
finished locale — including the hard one, in pixels.

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, but do not distort a term to
hit a number. **Terms outrank the budget**, which exists only to stop *avoidable* length.

The guard's own length check is a separate, cruder thing: a 2.5× ratio cap
(`MAX_LENGTH_RATIO` in `scripts/locale-rules.mjs`) on English sources of 12 characters or
more. Nothing in `config` comes close — the longest Turkish/English ratio in the namespace
is well under 2×. If a correct rendering ever breaches it, escalate for a per-key
`LENGTH_EXEMPTIONS` entry rather than distorting the wording.

## Surface names — repeat these verbatim

A surface is named in one namespace and owned by another, so these are written by different
translators at different times. **Batch 2 owns the main tab bar, which is where most of them
are settled**; `config` named five of them before the labels existed, and those five are
consistent with the table below by construction. They are settled; copy them, do not
re-render them.

### The main tab bar — `strings:tabs.*`, all seventeen

| Surface | Turkish | Owning key | Also named at |
| --- | --- | --- | --- |
| Config | Yapılandırma | `strings:tabs.config` | `strings:guide.topicConfig` "Yapılandırma sekmesi" |
| Data | Veri | `strings:tabs.data` | — |
| Translations | Çeviriler | `strings:tabs.strings` | `config:routing.categoriesConfiguredHint`, `strings:guide.topicMultiLanguage` |
| Compare | Karşılaştırma | `strings:tabs.compare` | `config:routing.tonesHint`, `strings:guide.topicCompare`, `strings:order.presortHint` |
| Source AI review | Kaynak yapay zekâ incelemesi | `strings:tabs.review-source-ai` | `review:sourceAi.configTitle` — **shipped in batch 3**, byte-identical |
| Translation AI review | Çeviri yapay zekâ incelemesi | `strings:tabs.review-translation-ai` | `review:translationAi.title` — **shipped in batch 3**, byte-identical |
| Manual review | Elle inceleme | `strings:tabs.review-manual` | the page it opens is titled *Review queue* → “İnceleme kuyruğu” (`review:title`); deliberately **not** the tab label, exactly as Activity's page title expands |
| Quality | Kalite | `strings:tabs.quality` | `strings:guide.topicQuality` — **no "Tab" suffix in English; do not add "sekmesi"**. The page it opens is *Quality Dashboard*, a **different** string: `quality:title` ships as "Kalite panosu", the wording batch 2 already committed to in `strings:tabPlaceholder.quality` ("Kalite panosunu görüntülemek için…"). Do not copy the tab label into it, and do not invent a third wording. |
| Glossary | Sözlükçe | `strings:tabs.glossary` | `strings:guide.topicGlossary` "Sözlükçe sekmesi" |
| Category | Kategori | `strings:tabs.category` | `strings:guide.topicCategory` "Kategori sekmesi" — singular on purpose, though the page it opens is plural |
| Routing | Yönlendirme | `strings:tabs.routing` | `strings:guide.topicRouting` "Yönlendirme sekmesi" |
| Activity | Etkinlik | `strings:tabs.runs` | `strings:guide.topicActivity`; page title expands to "Çeviri etkinliği" (`strings:runs.title`); named in prose by `review:*.progressActivityNote`, `glossary:generateRunningHint` and, in batch 6, `orphans:toast.aiRetranslateStarted` (“…Etkinlik sekmesine bakın”) |
| Stage details | Bölüm ayrıntıları | `strings:tabs` (stage-details) | `stage-details:title` — **shipped in batch 6**, byte-identical; `strings:runs.typeStageDetailsTranslation` |
| Orphans | Yetimler | `strings:tabs.orphans` | `orphans:title` — **shipped in batch 6**, byte-identical; `config:fullReplaceOrphanNotice`, `strings:guide.topicOrphans` |
| Backup | Yedekleme | `strings:tabs.backup` | `config:importSnapshotNote`, `strings:guide.topicBackup`; the page title expands to “Yedekleme ve geri yükleme” (`backup:title`, batch 6) exactly as Activity's does — a countable backup stays “yedek” |
| Sharing | Paylaşım | `strings:tabs.sharing` | `collab:sharing.pageTitle` — **shipped in batch 4**, byte-identical |
| Text Styler | Metin biçimlendirici | `strings:tabs` (color-text) | `sidebar:colorText` — **shipped in batch 4**, byte-identical; `colorText:title` — **shipped in batch 6**, byte-identical, the third and last site; `strings:runs.typeChatTextStyler` |

### Surfaces named outside that bar

| Surface | Turkish | Owning key | Also named at |
| --- | --- | --- | --- |
| Global Config | Genel yapılandırma | `sidebar:globalConfig` — **the owning key shipped in batch 4** | `config:globalConfigTitle` — **word-for-word identical in English, and must stay so**; also `strings:runs.aiReviewNoModules`, `review:sourceAi.noModules`, and in batch 6 `orphans:relink.aiNoModules` (whose English says *the global settings* — a surface that does not exist; see `english-review-notes.md`) plus `stage-details:chatOpenConfig` / `colorText:assistant.openConfig`, both “Genel yapılandırmayı aç” |
| Credential Vault | Kimlik bilgisi kasası | `strings:guide.topicVault` | `vault:statusLabel` — **shipped in batch 4**, the full form, cold; also `vault:unlockTitle` / `createTitle` / `editorTitle` and `account:devicesDescription` / `devicesEmpty`, all of whose English writes it out in full. The bare clip "kasa" is licensed only where English clips it too |
| AI Review | Yapay zekâ incelemesi | `strings:guide.topicAiReview` | `strings:runs.aiReview` / `aiReviewConfigTitle` / `judgeBadge` |
| Translation Memory | Çeviri belleği | `sidebar:translationMemory` — **the owning key shipped in batch 4** | `config:tm.*`, `strings:guide.groupTranslationMemory`, `strings:guide.topicTranslationMemory` |
| Review (sidebar group) | İnceleme | `sidebar:groups.review` — **shipped in batch 4**, copied verbatim from its guide twin | `strings:guide.groupReview` — an umbrella, not any one member; see the term row |
| Guide | Kılavuz | `sidebar:guide` — **shipped in batch 4** | `config:pseudoTestHelpLink` and every link that sends the reader to the guide |
| Settings | Ayarlar | `sidebar:settings` — **shipped in batch 4** | `settings:title` — **word-for-word identical in English, and must stay so**, the same relationship Global Config has; named in prose by `welcome:themeChooser.intro`, which is one of the locale's **two** apostrophized surface names (“Ayarlar'dan”) — see "Surface names" |
| Account | Hesap | `sidebar:account` — **shipped in batch 4** | the page's own sections name parts of it, never the page |
| Legal | Yasal bilgiler | `sidebar:legal` — **shipped in batch 4** | `legal:title` is English's *longer* *Legal & policies* and expands, exactly as Activity's page title does — **discharged in batch 6: “Yasal bilgiler ve politikalar”**, which keeps this label as its head and adds English's second noun rather than inventing a third name |
| Changelog | Değişiklik günlüğü | `sidebar:changelog` — **shipped in batch 4** | named in prose by `common:changelogEntryError` ("Couldn't load this **changelog** entry.", batch 6), which repeats the stem; `common:changelogShowOlder` counts *releases*, a different word |
| Pseudo Test | Pseudo Test | `strings:guide.topicPseudoTest` | `config:pseudoTestHelpAria` — a proper noun, untranslated |

### The sidebar group headings — `sidebar:groups.*`, all six

Five of the six are byte-identical in English to a `strings:guide.group*` key batch 2 already
shipped, so the verbatim-copy rule **dictated** them and batch 4 copied them rather than
deciding them. They are listed here because the next reader needs to see that they were
copied, not invented.

| Heading | Turkish | Source of the decision |
| --- | --- | --- |
| `groups.project` (Setup) | Kurulum | copied from `strings:guide.groupSetup` |
| `groups.translate` (Translate) | Çeviri | copied from `strings:guide.groupTranslate` |
| `groups.review` (Review) | İnceleme | copied from `strings:guide.groupReview` |
| `groups.content` (Terminology) | Terminoloji | copied from `strings:guide.groupContent` |
| `groups.maintenance` (Maintenance) | Bakım | copied from `strings:guide.groupMaintenance` |
| `groups.page` (Page) | Sayfa | **batch 4's own** — no guide twin; the workspace pages group (Ayarlar, Değişiklik günlüğü, Yasal bilgiler, Narn hakkında) |

**The nesting the runbook warns about is clean in this locale, and it is worth stating why
rather than only that.** `Sidebar.tsx:773` paints each heading directly over its own tab
labels, so heading and first child are on screen together, one inside the other. Here that
gives "Çeviri" over "Çeviriler" — the general word over the one that specialises it, which is
the licensed shape — and "İnceleme" over three children that all carry "inceleme" as their
head ("Kaynak yapay zekâ incelemesi", "Çeviri yapay zekâ incelemesi", "Elle inceleme") plus
"Kalite", which sits outside the umbrella in both languages. Neither pair is the Japanese
failure, where one word served both the heading and its child.

**One same-rendering pair this creates is licensed and must not be "fixed":**
`sidebar:groups.translate` "Çeviri" (English *Translate*) renders the same word as
`strings:runs.typeTranslation` and `strings:runs.judgeTargetLabel` (English *Translation*).
Those are run-type and panel labels inside the Activity/AI-review surfaces, and the sidebar is
always painted, so the two genuinely co-render — but there is no nesting between them and no
ambiguity: one is a nav group over five tabs, the other is a value in a table column headed
"Tür". The pair also predates batch 4 (batch 2 shipped both `guide.groupTranslate` and
`runs.typeTranslation`), and the verbatim rule leaves batch 4 no choice about it.

**Guide topics append "sekmesi", and only where English appends "Tab".** `topicQuality`,
`topicActivity`, `topicAiReview`, `topicPseudoTest`, `topicVault`, `topicQuickSetup` and
`topicTranslationMemory` have no "Tab" in English and take no "sekmesi" — mirror English
per key rather than regularising the set.

Four notes on these tables:

- **A tab label is a sidebar item.** `strings:tabs.*` renders in the sidebar menu, not in a
  tab bar, so these names are held to the **hard** 199px container — see "Length
  discipline". The two AI-review tabs are 28 characters, because the term is "yapay zekâ
  incelemesi" and the AI is never abbreviated; both measure inside 199px and stay.
- **`strings:runs.viewEngines` ("AI engines") is not a surface name.** It labels a view
  toggle inside Activity and ships as "Yapay zekâ motorları". "motor" is banned as a
  rendering of *module*, not as a word — here English itself says engines. Its sibling
  `runs.viewManual` must be a **noun phrase of the same shape**, "Elle düzenlemeler", not a
  bare adverb.
- **Backup: the tab is "Yedekleme", a countable backup is "yedek".** `config:maxBackupsLabel`
  is "Proje başına en fazla yedek" — the object — while the surface that lists and restores
  them is the process noun. Do not swap them.
- **Orphans: `config:fullReplaceOrphanNotice` calls it the "Relink tab" in English.** There
  is no such tab; `english-review-notes.md` records it as stale copy. It ships as "Yetimler
  sekmesi".

Turkish declines the surface name in prose, which is expected: "Yedekleme sekmesinden",
"Çeviriler sekmesinde". The **stem** is what must match, not the letters. Keep the surface
name unquoted, as English does.

**Whether that declension takes an apostrophe is decided by ambiguity, not by the name being
a surface name.** Every surface name in this product is an ordinary Turkish common noun
pressed into service as a name, so the proper-noun apostrophe rule (`NARN'ı`, `API'sini`,
`DeepL'e`) does **not** transfer to them automatically:

- **No apostrophe where the sentence already disambiguates** — because it appends "sekmesi"
  ("Yedekleme sekmesinden", "Çeviriler sekmesinden", "Etkinlik sekmesinden"), or because the
  name is two words and cannot be read as the bare common noun ("Genel yapılandırmada", at
  `review:sourceAi.noModules` and `strings:runs.aiReviewNoModules`). This is the normal case
  and covers every in-prose surface name shipped through batch 3 but one.
- **Apostrophe only where the bare stem would otherwise read as the common noun.**
  `category:noModules` ("…Configure one in Config.") ships "Yapılandırma'da birini
  yapılandırın." — without the apostrophe, "yapılandırmada" is simply *in the configuration*,
  and the sentence would lose the fact that it is naming a tab. English gets this free from
  capitalisation, which Turkish sentence case does not provide here.

**The finished locale has exactly TWO apostrophized surface names**, and both are deliberate
rather than inconsistencies: `category:noModules` above, and — added by batch 6 —
`welcome:themeChooser.intro`, “…ikisini de istediğiniz zaman **Ayarlar'dan**
değiştirebilirsiniz.” Both meet the condition stated one bullet up and nothing else does: bare
“ayarlardan” reads as *from the settings* and loses that the sentence names the **Settings**
page, exactly as bare “yapılandırmada” loses **Config**. Every other in-prose surface name in the
locale is disambiguated by an appended “sekmesi” or by being two words, and correctly takes none.

**This paragraph said “the only” for two rounds, and batch 6 falsified it in the same commit that
wrote the string** — the same shape as the hand-uppercased inventory in *Casing*, which was also
one short until somebody swept instead of trusting the list. So **derive it, do not read it**:
flatten every value under `packages/frontend/src/locales/tr` and print those containing an ASCII
apostrophe. Everything that comes back is either a **proper noun or key name** — `narn'ı`,
`DeepL'e`, `API'sini`, `VRAM'i`, `Google'da`, `Enter'a`, `Tekno'da`; note a theme name is a proper
noun, not a surface name — or one of the two above. **It is not the proper-noun rule.** The
apostrophe sweep in the table below groups both classes, so read a hit before licensing it: a
`DeepL'e` hit is a proper noun, a `Yapılandırma'da` hit is this rule, and both are correct
for different reasons.

## Matching a sibling namespace — match the English, not another locale's file

When the surface-name rule sends you to a sibling key, read the sibling's **English**.
Copying another locale's rendering imports whatever *that* key's English says, including
words your own key's English does not have. The standing example:
`config:lqa.checks.tag-equality.name` is "**Inline** tag equality" and ships as "Satır içi
etiket eşitliği", while `quality:checkLabels.tag-equality` is the bare "Tag equality" and
ships as "Etiket eşitliği" — same term, each faithful to its own key. **Both halves are now
shipped**; the second was a prescription until batch 3.

Batch 3 met the same class three more times, and all three resolved the same way:

- **`quality:legend.passed` / `failed` are "Geçen" / "Geçmeyen", not "Başarılı" /
  "Başarısız".** Their English is the bare "Passed" / "Failed"; the LQA row badge's English
  is the qualified "LQA passed" (`strings:row.lqaPassed` → "LQA başarılı"), and
  `strings:runs.statusFailed` ("Failed") is a *run status*. Matching either by rendering
  would collapse three different verdict families into one word. The dashboard instead
  reads as one family with its own `quality:columns.passRate` "Geçme oranı".
- **`review:approve` is the bare "Onayla".** Batch 2's `strings:bulk.approveSelected` names
  the destination — "Çeviri belleğine onayla" — because *its* English says "Approve to
  memory". This key's English does not, so this key does not.
- **`category:modulePlaceholder` is "Bir modül seçin"** even though its English is "Choose
  a module" where every sibling picker says "Select a module". Same control, same
  rendering; English's verb drift here carries no meaning, and mirroring it would invent a
  second Turkish wording for one picker.

## Register and typography sweeps

Run all seven before handing a batch to review. The first six are the standard set; the
seventh is Turkish-specific and is the one that catches this locale's signature defect.

| # | Sweep | Turkish instance | How to run it |
| --- | --- | --- | --- |
| 1 | Over-formal imperative the guide bans | `-iniz` / `-ınız` endings | the runner below, rule `over-formal` — then **eyeball every hit** |
| 2 | Bare-stem singular where a sentence needs `-in` | "seç", "gir" mid-sentence | **the only one that is not mechanisable** — read the imperatives |
| 3 | Straight quotes where the guide sets typographic ones | `"` and `'` around a value | the runner below, rule `straight quote` |
| 4 | Doubled spaces | — | the runner below, rule `doubled space` |
| 5 | Three-dot ellipsis instead of the single character | `...` for `…` | the runner below, rule `three-dot` |
| 6 | Hyphen used as a dash | ` - ` for ` — ` | the runner below, rule `hyphen-dash` |
| 7 | **Suffix attached to a placeholder** | `{{model}}'i`, `{{count}}ı` | the runner below, rule `welded suffix` |

**Sweep 1 needs the eyeballing, and it is the reason the runner prints the matched form.** The
same endings spell the ordinary 2nd-person possessive, ability, participle and question forms —
“hesabınız”, “edebilirsiniz”, “seçtiğiniz”, “mısınız” — which are all correct. **Only a bare verb
stem plus the ending is the defect** (“seçiniz”, “giriniz”, “tıklayınız”). Across the finished
locale every hit is one of the correct classes and none is a bare stem. This cell used to quote a
per-namespace hit count; that figure was not reproducible from the command beside it, and the
runbook forbids counters in a document for exactly that reason — **the durable claim is the
classification, and the runner reports its own counts.**

**THREE of these sweeps shipped as commands that could neither pass nor fail, and they were found
one at a time over three rounds. Run the negative control on every one of them, not on the one a
finding names.**

- `grep -nE '  '` (doubled spaces) matched the JSON's own two-space **indentation**, and
  `grep -n '\"'` (straight quotes) matched every line's own key/value **delimiters** — each
  returned essentially the whole file.
- `grep -nE '(iniz\|ınız\|unuz\|ünüz)\b'` (over-formal imperative) carried the **markdown
  pipe-escaping** into the shell. In ERE `\|` is a *literal* pipe, so the command searched for the
  one-piece string `iniz|ınız|unuz|ünüz`, which occurs nowhere. It returned 0 on the shipped
  corpus **and 0 on a corpus with “Bir model seçiniz” planted in it.**

The third is the instructive one: it sat two rows from the two that were fixed, in the same edit,
by the same person, who wrote the paragraph explaining why a replacement must be proved able to
fail — and did not re-run the row that was not named. **A finding names a location because that is
where somebody happened to look.** The fix is therefore not three fixed commands but **one runner
with one negative control**, so a new rule cannot be added without inheriting both:

```bash
# from the workspace root. Prints: <rule> <file> <key> <value> for every hit.
node -e 'const fs=require("fs"),p="packages/frontend/src/locales/tr";
const f=(o,k="",a=[])=>{for(const[q,v]of Object.entries(o))v&&typeof v==="object"?f(v,k+q+".",a):a.push([k+q,v]);return a};
const R={"over-formal":/[a-zçğıöşüA-ZÇĞİÖŞÜ]*(iniz|ınız|unuz|ünüz)\b/,"doubled space":/ {2}/,"three-dot":/\.\.\./,"hyphen-dash":/ - /,"straight quote":/"/,"welded suffix":/\}\}[\x27\u2019]?[a-zA-ZçğıöşüÇĞİÖŞÜ]/};
for(const n of fs.readdirSync(p))for(const[k,v]of f(JSON.parse(fs.readFileSync(p+"/"+n,"utf8"))))
for(const[name,re]of Object.entries(R)){const m=v.match(re);if(m)console.log(name,n,k,JSON.stringify(m[0]),JSON.stringify(v));}'
```

**It reads parsed values, never file bytes, which is what retires the whole indentation/delimiter
class.** On the finished locale it prints only `over-formal` hits, all of them correct forms
(see above), and nothing for the other five rules.

**Prove it can still fail before you trust a clean run.** Point `p` at a throwaway directory
holding one file with a planted defect per rule — `"iki  boşluk"`, `"üç nokta..."`,
`"tire - kısa çizgi"`, `"düz \"tırnak\""`, `"{{model}}'i sil"`, `"{{count}}ı sil"`,
`"Bir model seçiniz"` — and confirm each rule fires and a clean value stays silent. A sweep that
has never been shown to go red is not evidence of anything, which is the lesson all three broken
commands taught separately.

**The seventh sweep now has a gate behind it — keep running it anyway.** When batch 1 was
written, the pre-flight's narrow rule required **whitespace** between `}}` and the following
word, so it could not see `{{model}}'i` at all — this locale's signature defect passed the
gate cleanly, and the grep was the only thing that caught it. `scripts/i18n-preflight.mjs`
now carries **check 1b, "Welded suffix"**, which matches a case or particle suffix written
directly against a token and gates the exit code. The grep stays in this table as the
cheaper inner-loop check and as cover for shapes the gate may not match; a clean grep is no
longer the only evidence, but a dirty one is still a defect.

Conversely, what the narrow numeral rule flags for Turkish is **not** a numeral-agreement
defect at all: a Turkish noun after a numeral never inflects for number, so "{{total}} girdi"
is correct at every count. The pre-flight now says so itself — it reports the word axis as
**not applicable** for `tr` and clears token-axis survivors unconditionally rather than
treating this locale as merely uncalibrated. Twelve `config` occurrences are cleared that
way today, and every one of them is ordinary Turkish. The runbook's *"Only `count` triggers
plural selection"* rule is written for languages whose counted nouns inflect; it constrains
this locale only through the shared placeholder rules, never through word order.

## Open debts — each with the event that discharges it

Three decisions were deliberately deferred rather than guessed. Each is a **debt with a
trigger**, not a remark: when the trigger happens, the person it happens to owns the fix.
They are also recorded in the wave ledger, so neither this file nor the ledger is the single
point of failure.

| # | Debt | Trigger — who discharges it, and when | What to do |
| --- | --- | --- | --- |
| 1 | ~~`terminology/tr.md` records *credential vault* as the clip **"kasa"**, not the term.~~ **CLOSED in batch 2.** | — | `strings:guide.topicVault` ships **"Kimlik bilgisi kasası"**, and the Rendering column in `terminology/tr.md` is promoted to the full form. The clip "kasa" remains licensed only where the string already establishes credentials. **The transferred half is now discharged too: batch 4 shipped `vault:statusLabel` as "Kimlik bilgisi kasası"**, the full form, cold — along with `unlockTitle`, `createTitle` and `editorTitle`, whose English also writes the term out. Nothing of this debt remains open. |
| 2 | ~~Six strings invert the unit noun behind a colon where Russian ships natural order.~~ **CLOSED in fix round 3 — and it was never a real debt.** It was recorded as a word-axis calibration debt on the assumption that `tr`'s axis was merely uncalibrated; Turkish counted nouns do not inflect after a numeral at all, so the axis is structurally moot and no list was ever owed. | — | Natural order restored in all six, plus `models.confidenceReason.batch-exceeds-reliable` in the same class. **Batch 2 writes numeric strings in natural Turkish order, unit noun attached** — there is one convention, not two. See "Numeric tokens, as shipped" above. |
| 3 | ~~Two of the five length budgets (filter label, bulk-bar control) are still provisional.~~ **CLOSED in batch 2**, then corrected in its fix round. | — | There are **four** classes, not five: the tab-label class turned out to be the *same hard container* as the sidebar item, so the two merged at **199px ≈ 28 tr chars**. **Three** classes are soft, and batch 2 re-derived all three from the longest value `strings` actually ships: column header 16 → **20**, filter label 38 → **40** (the provisional guess landed on the exact measured longest, 38), bulk-bar control 52 → **40**. The tab-label figure batch 2 first published (32, soft) was wrong — derived from a container that does not exist — and no string was written to fit it. The whole-language sweep re-measures every class over the finished locale, the hard one in pixels. |

## Locale-specific traps

- **CSS-applied uppercase is the trap no guard can see — and it is now fixed in the app.**
  Labels in the guide group headings, the run-detail cards and the AI-review section headers
  are uppercased by CSS, which only honours Turkish's `İ` when the document carries
  `lang="tr"`. It did not until batch 2's review found "Çeviri" rendering as "ÇEVIRI" in
  twelve labels; `i18n/index.ts` now keeps `documentElement.lang` in step with the UI
  language. **Write ordinary sentence case and do not compensate by hand.** Full account,
  including the one key that is still hand-uppercased on purpose, in "Casing" above.
- **Agglutination means the domain term appears inflected everywhere.** "proje" shows up as
  "projeyi", "projeden", "projenin". That is expected and correct; `terminology/tr.md` records
  the bare citation form, and consistency means the same stem, not the same letters.
- **Vowel harmony applies to your own coinages too** — a suffix chosen for its written look
  rather than by harmony is immediately wrong to a reader.
- **"Judge"** takes the evaluative sense ("değerlendirme"), never "yargıç"/"hâkim", the
  courtroom reading.
- **"Stage" is a game level**, not a phase: "aşama" and "evre" are exactly the process
  readings `terminology.md` warns about.
- **AI is "yapay zekâ"**, with the circumflex, everywhere — `config` ships it four times.
  Do not alternate with "yapay zeka" or the abbreviation "YZ".
- **"Confirm" may not be "Onayla".** *Approve* is the lexicon term and takes "onayla", so a
  confirm button takes the explicit two-step Turkish form instead: "Evet, sil"
  (`config:instances.deleteConfirm`), "Evet, tümünü temizle" (`config:tm.clearAllConfirm`),
  "Eminim" (`config:routing.removeConfirm`). Cancel stays "İptal".
- **The LQA check descriptions' English "Flags …" is not the *flag* term.** It means
  "reports", and ships as "bildirir" throughout `config:lqa.checks.*`. The review-queue
  disposition verb is therefore still free for the batch that meets it.
- **"Success rate" is not "pass rate".** `config:health.successRate` (provider request
  success) ships as "Başarı"; the Quality dashboard's *pass rate* is a different metric and
  ships as "Geçme oranı" (`quality:columns.passRate`), on the same "geç-" root as
  "kalite geçidi". Settled in batch 3; the reservation batch 1 wrote held.
- **"Inspect" may not be "incele".** `quality:byLanguage.description` and
  `quality:bySource.description` say *Click a language to inspect its failed entries*, and they ship
  as "… görmek için bir dile tıklayın". "inceleme" is the *review* term, and the Quality
  dashboard is the one member of the Review group that is explicitly **not** a review — using
  the review verb for its drill-down would say the opposite of what the lexicon settled.
- **"Etkin" renders both *active* and *enabled*, and that is settled, not drift.** Batch 1's
  `config:modulesEnabledSection` is "Etkin ({{count}})" for English *Enabled*, and batch 2's
  `strings:runs.activeRuns` is "{{count}} etkin çalıştırma" for *active runs*. Batch 3's
  `review:glossaryActiveTitle` renders *Active glossaries* and is therefore
  "Etkin sözlükçeler", byte-identical to `strings:contextMenu.enabledGlossaries`, which
  renders *Enabled glossaries* — the pre-flight reports that as a same-rendering collision,
  licensed because the two name **the same set of glossaries** on two surfaces. Do not coin
  a second word to make the tool quiet.
- **"Action failed" is "İşlem başarısız oldu", and the "işlem" ban does not reach it.**
  `terminology/tr.md` sends the Activity table's **Action** column to "Eylem"
  (`strings:runs.actionColumn`) so that one word is not doing two jobs one column apart.
  That is a column-local reservation: `review:actionFailed` is a generic error toast on a
  different surface, and "İşlem başarısız oldu" is the natural Turkish. `glossary:colActions`
  — a column header, the same class as the reserved one — takes "Eylemler".
- **"İstem" (prompt) and "istek" (request) differ by one letter** and appear in the same
  settings panel. Read the English before you type either. **Batch 5 is where the two first render inside
  one component**, and the split is faithful because English writes both: `generation:contextHint`
  names the *prompt* while `generation:skipCategoriesHint` and `ignoreGlossariesHint` both end
  “istekten tamamen çıkarılır” for English's *request*, all three inside the generation-context
  controls. **A second trap sits on top of it: the dative of “istem” is homographic with the
  negative imperative of *istemek*.** “…için isteme … ekleyin” garden-paths as *do not want*, so
  the hint ships the compound instead — “…için **istem metnine** fazladan girdi ayrıntıları
  ekleyin.” Inflect this noun through a compound, not bare, wherever the case ending would
  produce that form.
- **"Context" is three different things in English.** The model's context window is "bağlam
  penceresi" (`config:models.confidenceReason.prompt-near-context`); the CSV column is the
  translator's own note (`config:includeContext`, "Bağlam sütununu dahil et"); the entry
  metadata bundle is a third. They share the head "bağlam" and are separated by their
  qualifiers, which is licensed — a shared root is not a collision when the heads differ.
  What is banned is rendering *translator context* as bare "bağlam".
- **Loanword or Turkish coinage — pick once.** "modül" vs "birim", "şablon" vs "kalıp",
  "önbellek" vs "cache". All are attested; alternating inside one namespace is the defect.
  Settled and closed by batch 1: module is "modül", template is "şablon", cache is
  "önbellek", token is "token", prompt is "istem", batch is "yığın".
- **Two batch-4 same-rendering collisions the pre-flight prints, both licensed — the licence
  belongs here, not in a batch report.** (a) English *Done* takes two renderings:
  `collab:invites.done` is “Tamam” and `config:routing.doneEdit` is “Bitti”. Resolve the
  control, then choose — “Tamam” is what a Turkish user expects on the button that dismisses
  a dialog they have finished reading (the one-time invite code), while “Bitti” ends an
  inline edit and reports that the editing is over. They never co-render. (b) Turkish
  “Yeniden dene” now serves two English phrasings, `collab:routing.retry` (*Retry*) and
  `glossary:generateTryAgain` (*Try again*): one action, two English wordings, one Turkish
  verb. Coining a second verb to keep the tool quiet is the error the *Etkin* bullet below
  warns about.
- **Two keys in this locale are translated but render nowhere, and both are English's own
  dead keys rather than this locale's defect.** `sidebar:colorText` — `PAGE_ITEMS` in
  `components/layout/Sidebar.tsx` does not list it, and the Text Styler is reached through
  `strings:tabs.color-text`, which ships the same “Metin biçimlendirici” — and `vault:remove`
  (“Kaldır”), which no component calls: `VaultEditorDialog` uses `delete`, `undoRemove` and
  `discard` for the three row states. Both are translated for parity and are correct; **do
  not measure either against a length budget and do not spend review attention on them.**
- **A UI control is "kontrol"; "denetim" is the LQA check and nothing else.** The *check*
  term row rejected "kontrol" precisely because it reads as a UI control — and batch 4 is
  where that reading is spent: `settings:previewHint` ("Sample controls rendered with the
  selected theme.") ships as "Seçili temayla görüntülenen örnek **kontroller**". The generic
  verb *check* takes the same root — `account:mfaLoading` is "Güvenlik ayarlarınız kontrol
  ediliyor…", `collab:nickname.loading` is "Takma adınız kontrol ediliyor…" — and neither is the
  term. Reserve "denetim" for a named LQA rule; nothing in this batch is one.
- **"oturum" is barred as a rendering of *run*, and that is the whole of the ban.**
  `account:signOut` is "Oturumu kapat" and `vault:unlockDescription` / `createDescription`
  say "bu oturumda" / "her oturumda" for English's own "session" — the ordinary word, doing
  its own job. The reservation in `terminology/tr.md` is against calling a *run* an "oturum",
  and it does not reach the noun (runbook 2.9).
- **Turkish word order can strand an email address or a link, and a colon is the fix.**
  `account:reportBugsPrefix` is an English fragment ending on a preposition, with the support
  address appended by the component. A literal Turkish rendering ends on the verb, leaving the
  address dangling with no connector, so it ships as “Bir hata mı buldunuz? Şu adrese
  bildirin:” — the demonstrative announces the address and the colon carries it. English
  gets this free from its preposition; Turkish has no preposition to end on. Punctuation is
  ours to set (see "Punctuation and spacing"), and this is the one place in the batch where
  the fix is punctuation rather than word order.
- **A status badge is not an LQA verdict, even when the English word is the same.**
  `settings:previewSamples.pass` / `fail` are theme-preview samples of the four semantic
  colours, and they ship as "Başarılı" / "Uyarı" / "Başarısız" / "Bilgi" — matching
  `strings:runs.statusFailed` ("Başarısız"), the generic run status, **not**
  `quality:legend.passed` / `failed` ("Geçen" / "Geçmeyen"), which are LQA verdicts on the
  Quality dashboard and are fixed by the *pass rate* row. The pre-flight reports both
  "Passed" and "Failed" as same-English/different-rendering pairs for this reason; they are
  licensed, and the deciding question is which family the key belongs to, not which word
  English used.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Turkish needs no parenthetical at all — the singular
  noun after the number already covers every count.
- **A number in a run control counts JOBS, not entries — open the call site before you
  name the unit, and open it for each key rather than for the family.** The batch's first
  version of this bullet claimed three `logs` failure counters were jobs too. **They are not**,
  and the review caught it: the three `translation.failed*` siblings aggregate on target
  language **and** reason together, so the language is fixed inside a group and their `count` is
  distinct entries for the one language the same sentence names — “girdi” is right there. The
  non-aggregated path passes no count and defaults to 1. In `logs` exactly **one** key has the
  mismatch, `translation.queued`, whose token is the routing-decision count; it ships
  “{{total}} çeviri sıraya alındı.” for that reason. **Do not re-broaden this to the `failed*`
  siblings — that is the correction being recorded, not a warning about them.** `batch:toTranslateCount` (English *{{count}} to translate*) ships
  “yapılacak {{count}} çeviri” and **not** “{{count}} girdi”, because the value is computed
  by walking the selected rows *and* the selected target languages: ten entries into three
  languages is 30, not 10. `batch:progressAriaLabel`, `runCompleted` and
  `runCompletedWithErrors` count the same thing and take the same head noun. English elides
  the noun in all four and so hides the question; Turkish has to supply a head, and the
  wrong head is a false statement in an `aria-label` a screen reader reads out verbatim.
- **“Dismiss” is “Kapat” on a banner and “Kaldır” on a notification, and the split is the
  control.** `system:restarted.dismiss` / `cancelled.dismiss` are the ✕ on a transient
  restart banner, so they take the closing verb — the same word `glossary:close` already
  ships for English *Close*. `account:notificationsDismiss` removes a row from a list that
  persists, so batch 4's “Kaldır” stands. The pre-flight reports both directions of this and
  both are licensed; the two surfaces cannot co-render.
- **English's log levels *Warn* and *Warning* are one Turkish word.** `console:filter_warn`
  is “Uyarı”, byte-identical to `config:lqa.severityWarning` and
  `settings:previewSamples.warn`. English clips the level name to fit a tiny tab; Turkish
  has no established clipping of this word, and inventing one to make the tool quiet is the
  error the *Etkin* bullet warns about. The tab is uppercased by CSS, which costs nothing
  here.
- **Bare “bellek” is licensed exactly once, and it is the RAM reading on purpose.**
  `logs:vault.credentialsEvicted` (English *…were cleared from memory*) ships “…bellekten
  temizlendi.” The *translation memory* row bans the bare word because it reads as RAM —
  and here the string genuinely means RAM. `logs:tm.cleared` two rows away is the term,
  written out in full: “Çeviri belleği temizlendi.”
- **Batch 6's licensed collisions, all six, with the deciding question for each.** The
  pre-flight prints them and none is a defect. *Create backup* takes two renderings because
  `backup:createSection` is a section heading (“Yedek oluşturma”) and `backup:createButton` is
  the button directly beneath it (“Yedek oluştur”) — the runbook names this exact key as the
  place Russian took the wrong shape, and the two being siblings on screen is why the shapes
  must differ, not a reason to unify them. *Discard* splits by sense, settled by the frozen
  lexicon, which names `colorText:assistant.discard` in its sense-2 group: “Reddet” there,
  “Vazgeç” at the three sense-1 sites. *Translate* splits by control: `stage-details:translate`
  is a button (“Çevir”) against the sidebar group heading “Çeviri”. In the other direction,
  “Uyarı” now serves *Warn* at `colorText:swatches.warn` as well as the console level and the
  severity value; “Başlık” serves `colorText:swatches.title` (*Title*) and
  `settings:previewSamples.heading` (*Heading*), which are in different namespaces and never
  co-render; and “Kaydedilemedi: {{message}}” serves `stage-details:saveFailed` (*Could not
  save*) beside `config:autoSaveError` (*Failed to save*) — one event, two English wordings,
  one impersonal negative potential, exactly as *Retry* / *Try again* already resolved. Two more
  same-rendering groups belong to this batch and were **missed by the first enumeration, which
  closed itself at “all six” over a set of eight**: “Henüz çeviri yok” serves
  `config:reviewProgressNone` (*No translations yet*) and `stage-details:noTranslation` (*No
  translation yet*) — genuinely new, and licensed because a bare Turkish noun is unmarked for
  number so one rendering is true of both; and “Hedef diller” serves `config:targetLanguages`
  (*Target Languages*) and `stage-details:languagesLabel` (*Target languages*) — a pre-existing
  group this batch joined, where the English difference is Title Case and carries no meaning into
  Turkish. **Re-derive both directions mechanically rather than listing them:** an enumeration
  that says “all” and is short by two is the class of claim this programme has paid for
  repeatedly, and the fix is to close it with a script, not with more care.
- **“Current” goes to “mevcut” wherever the phrase could also be read as *valid*, and batch 6's
  painted instance is the scope filter.** `stage-details:scopeCurrentOnly` is
  “Yalnızca mevcut dil ({{lang}})”: “geçerli dil” would read as *a valid language*, a claim about
  the language that the English does not make. Batch 2's `strings:compare.undoVersionsHint`
  (“Geçerli metin geçmişte tutulur”) stands, because a clause about undo history cannot be read
  that way — decide on the ambiguity, not on the adjective. The rule's other half is corroborated
  in the same batch by `colorText:invalidHex` (“Geçerli bir hex renk değeri
  girin…”), where English really does mean *valid* and “geçerli” is the right word.

  **`stage-details:chatQuickCurrent` (“Mevcut metin:”) was cited here as the bare-label instance,
  and that was wrong — it is never painted at all.** Both of its call sites compose it into a model
  request, so it belongs to the prompt-text section above, and its wording never depended on a UI
  ambiguity. The correction is left visible because **the string did not change**: a right
  rendering resting on a reason about a surface that does not exist leaves nothing broken to
  signal it. Check the reason at the call site, not at the key name.
- **English's *Override* is two different actions and takes two Turkish verbs.**
  `config:routing.labelModelOverride` is “Model geçersiz kılma” — a rule replacing a setting —
  while `orphans:relink.overrideModeLabel` is “Üzerine yazma modu” and `orphans:relink.overrideAll` is
  “Tüm çevirilerin üzerine yetimin çevirilerini yaz”, because there the action writes over
  stored translation text. Rendering the orphans pair with the routing verb would say the
  translations are being *invalidated*, which is not what relinking does. Resolve the action,
  not the word.
- **A search placeholder takes the `-in` imperative — one shipped string disagrees and it is
  the outlier.** `console:searchPlaceholder` is “Günlüklerde arayın…”, matching every earlier
  search field in the locale — `strings:compare.searchPlaceholder`,
  `strings:filters.searchPlaceholder`, `strings:mobile.searchPlaceholder`,
  `strings:achievement.dialogSearch`,
  `strings:compare.translateExamplesSearchPlaceholder`, `config:models.searchOrType` and
  `config:tm.searchPlaceholder`. `sidebar:searchProjects` shipped the bare stem “Projelerde
  ara…” for four rounds, which is the button shape in a placeholder's position. **The
  whole-language sweep took it, as this note asked: it is “Projelerde arayın…” now**, and the
  class is uniform — all twelve `Search …` placeholders in the locale take the `-in` form. The
  note is kept as the worked example of the mechanism: a defect in a *shipped* namespace found by
  a *later* batch has no batch of its own to fix it, so it has to be written down against the
  sweep or it never gets fixed at all.
