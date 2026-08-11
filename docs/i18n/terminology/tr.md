# NARN terminology — Turkish (`tr`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/tr.md`](../style/tr.md) — how Turkish is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

**Renderings are given in the bare citation form** (nominative singular, or the bare verb
stem for a verb). Turkish is agglutinative, so the shipped strings almost always carry the
word with case, possessive or plural suffixes on it — “proje” appears as “projeyi”,
“projenin”, “projeden”. Consistency here means **the same stem**, never the same letters.

| Term | Rendering | Notes |
| --- | --- | --- |
| project | proje | Verb is “oluştur”, never “aç” (open). |
| workspace | çalışma alanı | Deliberately two words, so it can never collapse into “proje”. Attributive use keeps the izafet: “çalışma alanı ayarları”. |
| entry | girdi | The unit the app counts. “kayıt” is refused — it is the obvious Turkish for *record*, and the *recording* term reserves that family. “satır” (row) is the CSV row (`config:rowsProcessed`), a different object. The reservation binds the **content unit only**: a disambiguated compound such as “kasa girdisi” (`config:credentialsMissing`, vault key entries) is licensed, exactly as the runbook allows for a log entry. |
| source text | kaynak metin | Same “kaynak” as source language and source label; the head noun disambiguates all three. |
| translation | çeviri | Verb “çevirmek”. The tab label is the plural “Çeviriler” — see the surface-name table in `../style/tr.md`. |
| source label | kaynak etiketi | The routing column shortens it to the bare “Kaynaklar” (`config:routing.labelSources`), exactly as English shortens it to “Sources”. |
| achievement | başarım | The settled Turkish game-platform word. “başarı” (success/achievement in the everyday sense) is refused: it is already the health metric in `config:health.successRate`, and the two appear in the same product. |
| inline tag | satır içi etiket | Umbrella over placeholders, formatting tags and “\n” escapes. Shares “etiket” with source label; the qualifier separates them. |
| placeholder | yer tutucu | The interpolation token inside game text only — the double-brace kind the mask-integrity check protects (`config:lqa.checks.mask-integrity.description`). The input-hint sense of the English word is a different concept and takes “ipucu metni” if it is ever needed — never this. |
| translator context |  | Met in batch 1 only as the CSV column (`config:includeContext`), where the string names the column and not the concept, so no full rendering shipped yet. The intended rendering and the reason it does not collide with “bağlam penceresi” (context window) are recorded in `../style/tr.md`; whoever first ships the concept writes the row. |
| source language | kaynak dil |  |
| target language | hedef dil | Pairs with “kaynak dil”; the two sit side by side in Config. |
| reference language |  |  |
| writable language |  |  |
| Pseudo Test | Pseudo Test | Kept as a proper noun, like the language code it names. A Turkish rendering (“sözde test”) would read as a value judgement about the test rather than a language name. |
| run | çalıştırma | Noun only — never a verb, per the shared lexicon. “koşu” is athletics; “işlem”, “görev” and “oturum” are the operation/task/session readings the lexicon bans. The verbs stay “çevir”, “başlat”, “üret”. |
| Activity |  |  |
| batch | yığın | “toplu” is refused and **reserved**: it is Turkish for *bulk*, which the bulk-operations bar needs (`strings:bulk.*`). “grup” is refused too — it is taken by rule group. |
| batch grouping | yığın gruplaması | Distinct from batch mode (“yığın modu”) by the head noun, as the lexicon requires. |
| AI review |  |  |
| judge | değerlendirme | The evaluative sense. “yargı”, “hâkim”, “yargıç” are the courtroom readings and are refused outright. Appears in batch 1 only as a run type (`config:requestTimeoutDescription`, `config:batchGroupingDescription`). |
| source review | kaynak incelemesi | Built from “kaynak” + “inceleme”. “inceleme” is therefore reserved for **review**; the LQA check family takes “denetim” instead — see the *check* row. |
| finding |  |  |
| suggestion |  |  |
| discard | vazgeç | Sense 1 only, the ghost button beside Save (`config:discard`). Sense 2 (refusing a produced result) is **not** this word — reserve “reddet” for it. “iptal” is unavailable: it is Cancel (`config:cancelImport`). `config:discardUntranslatable` is a third, non-term use — “leave out of the export” — and is rendered by meaning (“dışarıda bırak”), not with this word. |
| needs review |  |  |
| flag |  | Not met. Note for whoever does meet it: the LQA check descriptions' English “Flags …” is **not** this term, and batch 1 renders it “bildirir” (reports) precisely so the disposition verb stays free. |
| Review (the sidebar group) |  |  |
| review queue |  |  |
| module | modül | The loanword, settled. “birim” (unit) is refused — it says nothing about what the thing does, and the app has no other “unit”. |
| module instance | modül örneği | “örnek” is the settled Turkish computing word for *instance*; its other reading (*example*) never collides here because every occurrence sits beside a module. “kopya”, “profil”, “yapılandırma” are all on the lexicon's ban list. **The izafet suffix rides on “örnek”, never on the module name** — see the placeholder section of `../style/tr.md`. |
| provider | sağlayıcı | The outside company behind a module. Kept strictly apart from “modül”, including in the three English strings that mislabel a module picker “Provider” (`config:routing.simplePlaceholder`), which are translated as written. |
| model | model | Loanword. This is why *template* may not be “model”: see that row. |
| prompt | istem | The settled Turkish AI term. **Watch the near-collision with “istek” (request)** — one letter apart, and both live in the same settings panel (`config:requestsPerSecondLabel`, `config:requestTimeoutLabel`). “komut”, “sorgu”, “yönerge” are the command/query/instruction readings the lexicon bans. |
| reasoning effort | akıl yürütme çabası | The provider's own parameter. Not “çaba” alone, which reads as work done. |
| routing rule | yönlendirme kuralı | Content routing, not network routing — “rota” and “yol” are refused for that reason. |
| rule group | kural grubu | “grup” is reserved here, which is one reason *batch* is “yığın”. Not “küme”, not “profil”, not “önayar”. |
| credential vault | kasa | The short form is what batch 1 shipped, because every `config` occurrence has an unambiguous context (`config:credentialsVaultLockedChip`, `config:credentialsUnlockButton`). The full form is “kimlik bilgisi kasası” and belongs wherever the vault is named cold — the `vault` namespace's own status label. All four required phrasings read naturally on this stem: kasa kilitli / kasanın kilidini aç / kasa parolası / kimlik bilgisi kasası. Whoever ships the full form should move it into this column then. |
| credential | kimlik bilgisi | Usually plural in the UI (“Kimlik bilgileri eksik”). Not “parola”, not “hesap”. Vault key names themselves are never translated. |
| LQA | LQA | Kept as the industry acronym; Turkish localization practice uses it untranslated. Used attributively with no suffix on the acronym: “LQA denetimleri”, “LQA geçidi”. |
| quality gate | kalite geçidi | The process-control sense. “kapı” is refused — it is a literal door, and its uppercase form “KAPI” also collides with the do-not-translate term API in the guard's own term check. “eşik” (threshold) is refused because a threshold is a number, and this file already has severity and limit vocabulary. |
| check | denetim | One named LQA rule. Elimination: “kontrol” is the generic Turkish for *control* and reads as a UI control; “sınama” is *test*; “doğrulama” is *validation* and is taken by **assertion**; “inceleme” is taken by **review**. “denetim” survives, and it means an applied rule that passes or fails — which is what a check is. |
| issue | sorun | One LQA verdict, at blocking or warning severity. “hata” (error) is refused by the lexicon; “bulgu” is deliberately left free for **finding**, which is listed on the same entry. |
| severity | önem derecesi | The two values are “Engelleyici” and “Uyarı” and are fixed by the *check* row, not re-decided here. “seviye”/“düzey” (level) and “öncelik” (priority) are refused. |
| notification severity |  |  |
| assertion | doğrulama | A user-written regex the translation must or must not match. Elimination: “koşul” is routing conditions, “kural” is routing rules, “denetim” is the LQA check, “iddia”/“sav” are the claim reading, “ifade” is *statement*. “doğrulama” survives, is free (nothing else in this app is called *validation*), and means what an assertion does. |
| pattern | desen | The regex sense only. Never “kalıp” or “şablon” — the latter is template. |
| overflow | taşma | Relative to the source, via the overflow ratio. Kept clearly apart from “uzunluk sınırı”, which is absolute. |
| length limit | uzunluk sınırı | Hard per-language cap set by the game editor. Also the routing condition on source length (`config:routing.labelMaxLength`). |
| pass rate |  | Not met. Note for the quality batch: `config:health.successRate` is a **different** metric and already ships as “Başarı”, so pass rate needs its own word (“geçme oranı” is free). |
| glossary | sözlükçe | Elimination: “sözlük” alone is *dictionary*, which the lexicon bans; “terim tabanı” is a termbase, a different CAT artefact; “kelime listesi” is the word-list reading. “sözlükçe” is the attested Turkish for *glossary*, is one word (it has to fit a tab label), and leaves “terim” free for the row below. |
| glossary term | terim | Shortened to the bare “terim” inside the Glossary tab, as English does. Never “girdi” — that is a content entry, and the app counts those constantly. |
| constant |  |  |
| match | eşleşme | Noun. The verb is “eşleşmek” on the same root, which keeps the search and routing strings (`config:models.noMatches`, `config:lqa.regexModeMustMatch`) visibly the same word as the glossary noun, exactly as the lexicon asks. |
| translation memory | çeviri belleği | The established Turkish CAT term. Bare “bellek” is never used alone — it reads as RAM. |
| approve | onayla | Storing a translation into translation memory. This forces one consequence worth knowing: **confirm buttons may not also be “Onayla”**, so they take the explicit two-step Turkish form instead (“Evet, sil” at `config:instances.deleteConfirm`, “Eminim” at `config:routing.removeConfirm`). “kabul et” (accept), “doğrula” (validate) and “kaydet” (save) are all refused or taken. |
| category | kategori |  |
| tone | ton | An authoring instruction on an entry. “üslup” is refused: it is the writing-style reading the lexicon warns about, and it would read as the model's style rather than an instruction to it. |
| orphan | yetim | The figurative noun, used identically in the tab title, the count chip and the import notices. “artık”, “sahipsiz” and “kayıp” are the leftover/ownerless/lost readings the lexicon bans. Adjectival “orphaned” is “yetim olarak işaretlenmiş” or simply “yetim”. |
| relink | yeniden bağla | One verb for the row button, the dialog title, the confirm step and the import warning (`config:importModeFullReplaceHint`). Not “yeniden eşle”, not “taşı”. |
| backup | yedek | Countable noun (“proje başına en fazla yedek”). The **surface** is “Yedekleme” — see the surface-name table in `../style/tr.md`; do not use one where the other belongs. The verb is “yedek oluştur”. |
| snapshot | anlık görüntü | An automatic pre-operation restore point. Distinct from “yedek”, which matters because `config:importSnapshotNote` uses both in one sentence. Not “ekran görüntüsü”, which is a screenshot. |
| template | şablon | Never “model” — that is the AI model, and this is exactly the collision the shared lexicon warns Romance and Slavic languages about. Turkish has the same trap through “kalıp”, which is also refused because it is the natural word for a regex *pattern*. |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| recording |  | Not met. Note: the *entry* row above reserves the “kayıt” family for this term, so it is free. |
| stage |  |  |
| Text Styler |  |  |
| element |  |  |
| theme |  |  |
| guide | kılavuz | One word for the sidebar item and every “read the guide” link (`config:pseudoTestHelpLink`). Not “yardım”, “belgeler” or “el kitabı”. |
| release |  |  |
| changelog |  |  |
