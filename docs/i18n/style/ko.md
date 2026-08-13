# Style guide — Korean (ko)

Terminology — _which word_ — is settled in `terminology.md`, which defines every domain
term and the list of things that are never translated; this locale's rendering of each
term goes in `terminology/ko.md`. This file settles register, casing, punctuation, length and
placeholder handling.

**Three claims in the pre-flight version of this file were falsified by the shipped
locale and are corrected in place rather than deleted**, because a repaired reason should
not be indistinguishable from one that was always sound:

- It said Korean runs "roughly 0.7–0.9×" English. Measured over the 1,879 shared keys, the
  aggregate is **0.55** — see "Length discipline". The direction was right and the figure
  was a guess.
- It said to "treat the English character count as the ceiling" on the constrained
  surfaces. That is a ratio rule, which runbook 2.4 shows is the wrong unit; it is replaced
  below by **seven absolute per-class budgets**.
- It cited `vault:createDescription` as ending in *…필요해요.* The shipped value ends
  「…잠금을 해제해야 해요.」 The citation is corrected; the register point it illustrated stands.

## Register

**해요체 for sentences, noun form for controls.**

- Messages, descriptions and instructions end in 해요체: `sidebar:selectProject` ("Select a
  project") is “프로젝트를 선택하세요”, and `vault:createDescription` ends “…잠금을 해제해야 해요.”
  해요체 is the register of modern Korean consumer and professional software, and it is the
  right match for an informal-but-professional English source. 합니다체 ("선택하십시오") is
  enterprise-formal and reads as a different product.
- **Buttons and labels take the bare noun form (명사형)**: `sidebar:create` is “만들기”,
  `sidebar:cancel` is “취소”, `strings:bulk.clearSelection` is “선택 해제”. Never conjugate
  a button.

Never mix 해요체 and 합니다체 within one surface — the inconsistency is more visible in
Korean than a wrong word choice would be.

**Never write 당신.** Korean software does not address the user with a pronoun; drop it, or
use the possessive-free construction ("비밀번호를 입력하세요").

## Control shapes — decided in batch 1, binding on every later batch

English writes the same words for a title, a button, a column header and a placeholder;
Korean does not. Resolve the control **before** writing the string.

| Control | Shape | Example |
| --- | --- | --- |
| Page / section / dialog title | bare noun phrase, no verb ending, no 마침표 | `config:reviewProgress` “검토 진행률”, `config:models.pickTitle` “모델 선택” |
| Button whose action has a 한자어 noun | 〈object〉 〈noun〉 — the noun alone, never 합니다/하세요 | `config:duplicateProject` “프로젝트 복제”, `config:deleteProject` “프로젝트 삭제” |
| Button whose action has no 한자어 noun | 〈object〉 〈verb〉기 — the 명사형 in ~기 | `sidebar:create` “만들기”, `config:instances.createButton` “인스턴스 만들기”, `glossary:close` “닫기” |
| Confirm-dialog title | **the same string as the button it confirms**, where English is identical too | `config:deleteProject` and `config:confirmDeleteTitle` are both “프로젝트 삭제”. Where English differs, follow English — `category:deleteConfirmTitle` ("Delete category?") is “카테고리를 삭제할까요?” |
| Confirm-dialog title that asks a question | ~할까요? — Korean's own way of asking for authorization; keep English's question mark where it has one | `backup:confirmTitle` “현재 프로젝트 데이터를 바꿀까요?”, `collab:leaveConfirmTitle` “프로젝트에서 나갈까요?” |
| Table column header | bare noun, shortest defensible form | `strings:columns.config` “상태”, `config:models.colConfidence` “신뢰도” |
| Select option / value label | bare noun or 〈noun〉별, never a sentence | `config:module.batchByLanguage` “언어별”, `config:lqa.severityBlocking` “차단” |
| Checkbox / radio whose English is a verb phrase | ~하기 (명사형), not a bare noun: the user is choosing what the app will do | `strings:compare.translateModeRetranslate` “기존 번역을 다시 번역하기”, `strings:compare.translateDisableMemory` “이번 실행에서는 메모리를 사용하지 않기” |
| Checkbox whose English is a noun phrase | follow English — bare noun phrase | `strings:runs.aiReviewVerbose` “상세 로깅 (프롬프트, 파라미터, 원본 응답)” |
| Placeholder whose English is an instruction | ~하세요 + “…”, matching the 해요체 imperative | `config:enableModulePlaceholder` “활성화할 모듈을 선택하세요…” |
| Placeholder whose English is a descriptive noun phrase | noun phrase — follow English, do not convert it into an instruction | `stage-details:fields.name.placeholder` “스테이지의 이름” over *The stage's name* |
| Progress / in-flight status | ~하는 중 (+ “…” **only where English has one**) | `config:duplicating` “복제하는 중…” (English has the ellipsis); `strings:row.translating` “번역 중” (English has none) |
| Completed status chip | ~됨 — a state, never a sentence | `config:autoSaveSaved` “저장됨”, `strings:compare.cellReviewedBadge` “검토됨” |
| Description / help / toast | full 해요체 sentence, and it takes 마침표 **only where English does** | `config:maxBackupsDescription` ends “…기본값(10)을 사용해요.”; `strings:compare.editSaved` “번역을 저장했어요” has none, because English's "Translation saved" has none |
| Inline fragment in a summary row | 모든 〈noun〉 / 〈noun〉 없음, no verb, no 마침표 | `config:routing.anySource` “모든 출처”, `config:routing.noModule` “모듈 없음” |
| Empty-state title | bare 해요체 clause, 마침표 only where English has one | `glossary:emptyTermsTitle` “이 용어집에는 아직 용어가 없어요”, `review:emptyTitle` “검토 대기열이 비어 있어요” |
| Error / failure toast | ~하지 못했어요 for a failed attempt; 실패 for a label:value line | `config:autoSaveError` “저장하지 못했어요: {{message}}” against `config:importFailed` “가져오기 실패: {{message}}”, whose English is the same label:value shape |

**Two English words that each needed two Korean ones.** *Discard* splits into 변경 취소
(unsaved edits) and 폐기 (a proposal or produced result); *Dismiss* splits into 삭제 (it
deletes) and 닫기 (it closes a banner). Both splits are recorded with their call sites in
`terminology/ko.md`; neither is a style choice, and neither may be collapsed.

**One split that exists only to avoid a co-render.** `stage-details:translate`
("Translate", a button) is “번역하기” rather than the bare 번역, because
`stage-details:translationsHeading` ("Translations") is “번역” and the two are painted in
the same view. English gets away with it on the part-of-speech mark Korean does not have.

## Casing

Korean has no letter case, so the English sentence-case / Title Case / uppercase
distinctions have nothing to map onto. `english-review-notes.md` records that the uppercase
table header `strings:columns.config` ("STATUS") shouts for a layout reason and that a
language without case should simply translate it — “상태”. The same applies to
`console:title` ("CONSOLE") → “콘솔” and to the deliberately lowercase cell chips
(`strings:compare.cellNeedsReviewBadge`), which are byte-identical to their sentence-case
filter siblings. That identity is the casing rule working, not drift.

Latin-script material inside a Korean string (`API`, `CSV`, `AI`, `LQA`, `VRAM`, provider
and model ids) keeps its English casing and stays half-width.

## Punctuation and spacing

- Use half-width `.` `,` `?` `!` with Korean text — not the full-width Japanese forms, and
  not 「」, which is Japanese quoting.
- Quoting a value uses 큰따옴표 “…”, with ‘…’ nested inside. Where English has
  `“{{category}}”` (`category:deleteConfirmBody_other`), Korean writes “{{category}}”, and
  where English has escaped straight quotes (`\"{{name}}\"`, `config:duplicateSuccess`)
  Korean uses the same 큰따옴표 — the marks around a placeholder are set here, the token is not.
- Use 가운뎃점 · for tight coordinate lists (`strings:row.ignoredTooltip` “용어집·카테고리 생성”).
  Where English writes a `·` as a **field separator** rather than a list — `review:provenance`
  is "{{module}} · {{date}}" — keep the spaced ASCII middle dot exactly as English has it;
  that key is on the shared `IDENTICAL_ALLOWLIST` for precisely this reason.
- Ellipsis is the single character `…` (U+2026) wherever the English source has it:
  `common:loading` ("Loading…") is “불러오는 중…”. Never `...`.
- Em dash `—` where English has one, with a space either side; never a hyphen doing a dash's job.
- **띄어쓰기 (word spacing) is mandatory and is the most common Korean quality defect.**
  Dependent nouns take a space ("할 수 있어요", "삭제한 것"), auxiliary verbs take a space,
  and compound technical terms usually do too ("번역 메모리", not "번역메모리"). When in
  doubt, space it.
- Do not put a space before a particle — the particle attaches to the preceding word.
- A parenthesis that follows a word takes a space before it where English has one
  (`config:requestTimeoutLabel` “요청 제한 시간 (초)”), and none where the parenthetical is
  glued to a number (`config:maxBackupsDescription` “기본값(10)”).

## Numbers and dates

Half-width Arabic numerals. Comma thousands, period decimal: `1,234.56`. No space before
`%`. A unit or counter is written closed up against the numeral (“{{count}}개”, “{{chars}}자”,
“{{bytes}}바이트”), which is both the Korean convention and what keeps the numeral-agreement
hazard away — see "Placeholders".

Dates and times are formatted by the app from the browser locale — a date format string is
not a translatable string.

## Length discipline

Korean runs **much shorter** than English. Measured over the **1,879 keys `ko` shares with
`en`** (the whole locale — Korean supplies no key English lacks; see "Plurals"): aggregate
**0.55**, median **0.51**, 90th percentile **0.76**. State that population whenever you
quote these, because a locale with extra plural forms measures a different one.

That means the chrome surfaces are never the binding constraint in this language, and the
budgets below confirm it: the widest label in the app's tightest container uses **58%** of
the space it has. Prefer the 한자어 compound over a long native paraphrase anyway
("번역 메모리" over "번역한 내용을 저장한 기록") — brevity is still a virtue where two
renderings are both correct.

### The seven per-class budgets — absolute character counts, never a multiple of English

Counted in **rendered characters**, with the convention stated because two of the figures
move with it: a Hangul syllable block is **1** (it is full-width, one em), a half-width
Latin character, digit, space or ASCII punctuation mark is **0.5**, and a `{{token}}` counts
as the three digits it can show, i.e. **1.5**. That is what the container has to fit.

| Class | Anchor key | Kind | Budget | Basis |
| --- | --- | --- | --- | --- |
| Sidebar item — **including every `strings:tabs.*` label and every `sidebar:groups.*` heading** | `sidebar:globalConfig`, `strings:tabs.backup` | **hard** — fixed `16rem`, `truncate` | **13** | Derived from the component, not from the shipped values: `SIDEBAR_WIDTH` 16rem = 256px, less 1px `border-r`, less `SidebarGroup`'s `p-2` (16px), less `SidebarMenuButton`'s `p-2` (16px), less the `size-4` icon (16px), less `gap-2` (8px) = **199px**. At `text-sm` (14px) a Hangul syllable advances 1em = 14px, so 199 ÷ 14 = 14.2 fit and 13 leaves one glyph of headroom. Measured over all **34** labels the rail can paint: max **7.5** (`sidebar:colorText` / `strings:tabs.color-text` “텍스트 스타일러”), median 4. Nothing is close, and nothing was shortened to fit |
| In-panel sub-tab | `config:routing.tabRules` | soft | **11** | Measured over the whole class — **9** members, `config:routing.tab{Rules,Templates,ImportExport}` plus the six `console:filter_*` (`FILTER_LEVELS` at `ConsolePanel.tsx`) — max **9.5** at `config:routing.tabImportExport` “가져오기 / 내보내기”, next 6, median 2. Budget is the max plus headroom, per runbook 2.4 |
| Table column header | `strings:columns.config` | soft | **8** | Measured over **48** headers across eight namespaces (`config:models.col*`, `glossary:col*`, `strings:columns.*`, `strings:runs.*Column`, `orphans:columns.*`, `collab:{sharing,invites}.column*`, `quality:columns.*`): max **7** at `collab:sharing.columnLanguages` “편집 가능 언어”, median 2. That maximum is fixed by the *writable language* term, which outranks the budget |
| Filter label | `strings:filters.needsReview` | soft | **14** | Measured over **33** members (`strings:filters.*` plus the Compare filter row): max **12.5** at `strings:filters.clearNewFlags` “새 항목 표시 지우기 ({{count}})”, next 10, median 4.5. The anchor itself is 4 |
| Bulk-bar control | `strings:bulk.approveSelected` | soft | **16** | Scoped to the **controls** the bar renders, not its status lines: max **14.5** at `strings:bulk.generateGlossaryFromSelection` “선택한 항목에서 용어집 생성”, median ~9; the anchor “번역 메모리에 승인” is 9. **The status and toast strings in the same namespace are longer and are not a breach** — `strings:bulk.approveSuccess_other` is 18.5 and `allFilteredSelected` 17, and both are sentences rather than controls |
| Swatch chip label | `colorText:swatches.hydro` | **hard** — `max-w-24` + `truncate` | **8** | Derived from the component: `PaletteSection.tsx` renders the label in a span carrying `max-w-24` and `truncate` inside a `text-xs` chip — 96px ÷ 12px = 8 glyphs. Measured over all 18 swatches: max **2**, median 2. The class is hard and nothing in it is remotely close |
| Palette group caption | `colorText:groupElements` | soft | **9** | Derived from the component: `PaletteSection.tsx` puts each caption in a `w-28 shrink-0` `text-xs` span — 112px ÷ 12px = 9.33, taken down to 9. Soft because an over-long caption wraps inside the fixed box rather than clipping. All five measure 2–5.5 |

**Hard** means fix it — a sidebar item over budget is cut off in a container that cannot
grow. **Soft** means prefer the shorter of two correct options, but never distort a term to
hit a number: a term rule outranks the budget, and `collab:sharing.columnLanguages` is the
shipped case of that.

## Placeholders

`{{token}}` contents are identifiers, never translated. Word order around a token may
change freely; every token in the English string must appear exactly once.

**The Korean hazard is particles.** 이/가, 은/는, 을/를, 와/과 and 로/으로 are chosen by
whether the preceding syllable ends in a consonant — and a token's value is unknown at
translation time, so a bare particle written against `{{token}}` is a coin flip.

Three fixes, in order of preference. The first two are used throughout the shipped locale;
the third has not been needed once.

1. **Put a real noun after the token** and attach the particle to that. The closing clause
   of `logs:translation.failedModuleDisabled` becomes “{{module}} 모듈이 꺼져 있어요” —
   모듈 takes 이, the token stays bare. The same device fixes every `{{language}}`:
   `logs:translation.done` is “항목을 {{language}} 언어로 번역했어요.”, because a bare
   `{{language}}로` would be wrong for any language name ending in a consonant.
   `collab:locks.readOnlyLanguage` and `sidebar:templateWarningUnknownModule` are the other
   two shapes — a noun after the token, or the token moved to the end of the clause behind a
   colon: “템플릿이 알 수 없는 모듈을 참조해요: “{{id}}””.
2. **End the clause on the token**, so no particle follows it at all —
   `config:models.useCustom` “사용자 지정 모델로 “{{model}}” 사용”.
3. The doublet — “{{name}}이(가)”. Correct but ugly. **Not used anywhere in this locale**;
   reach for it only when neither device above fits.

**A counter welded to a token is safe and is not this hazard.** 개, 건, 자, 번, 회, 점, 배,
바이트 and 턴 are invariant after every numeral, so “{{count}}개를” chooses its particle from
개, not from the token. Every one of the 64 token-adjacent spans in this locale is of that
shape — see "The numeral-agreement guard" below.

### Counters, by object — read this table instead of guessing

Korean picks a counter per counted object, and alternating between two for one object is
the defect. This table is the record; extend it rather than deciding again.

| Object | Counter | Shipped example |
| --- | --- | --- |
| entry (the content unit) | 개 | `category:countLabel_other` “항목 {{count}}개” |
| CSV row / table row | 개 with the head noun 행 | `config:rowsProcessed` “{{count}}개 행 처리됨”, `strings:bulk.rowsSelected_other` |
| glossary term, category, glossary, template, model | 개 | `glossary:generateSuggestionCount` “용어 {{count}}개” |
| run, key, notification | 개 | `strings:runs.queuedCount_other` “실행 {{count}}개 대기 중” |
| **job** (one entry × one target language) | 건 | `logs:translation.queued` “번역 {{total}}건을 대기열에 넣었어요.”, `batch:toTranslateCount` |
| LQA issue, finding, match, suggestion, invite | 건 | `strings:row.lqaIssues_other` “LQA 이슈 {{count}}건” |
| characters | 자 | `config:lqa.lengthLimitValue` “{{chars}}자 / {{bytes}}바이트” |
| attempts, repeats | 번 | `vault:remainingAttemptsHint` “{{count}}번 남았어요.” |
| chat turns | 턴 | `strings:runs.chatTurns_other` |

The 개/건 split is the one that carries meaning: **개 counts things the user owns, 건 counts
occurrences of an event or a verdict** — which is why a *job* takes 건 and an *entry* takes
개, and why `logs:translation.queued` does not promise entries it is not counting.

### Non-`count` numeric tokens

Only `{{count}}` drives plural selection, and Korean has nothing to select, so the usual
trap — a frame grammatical for some values and not others — cannot fire here at all: a
Korean noun after a numeral is invariant. Every non-`count` token nonetheless sits behind a
counter or a head noun rather than bare, because that is also what reads best:
`strings:pagination.rowsFiltered` is “항목 {{totalCount}}개 중 {{formattedCount}}개” and
`config:templateMeta` is “언어 {{languages}}개 · 배정 규칙 {{rules}}개” — the count-neutral
frame `english-review-notes.md` asks four locales to use for that key.

## Plurals — Korean supplies `_other` and nothing else

**Verified, not assumed.** `new Intl.PluralRules('ko').resolvedOptions().pluralCategories`
is `["other"]`, and `pluralFamilyErrors()` in `scripts/locale-rules.mjs` fails any suffix
that is not a category of the language, so a `_one` copied across from English is a hard
build failure rather than dead weight. `ko` therefore ships **1,879 keys — 29 fewer than
English**, which is exactly English's 29 `_one` forms removed and nothing added. That is the
same count `ja` ships, and `ja` was checked key-by-key before this was written.

**The twelve `bare + _other` families keep both members.** English's bare key is a plain key
under `classifyKeys()`, so key parity demands it independently of the plural family — see
`vault:keysCount`, `console:unreadErrors`, `logs:orphan.detected` and the other nine. Write
the bare key count-neutral: it is unreachable once `_other` exists, and its only remaining
job is to be grammatical if anything ever reaches it. In Korean the two forms are
legitimately **identical** in eleven of the twelve, because a counted noun does not inflect;
`vault:retrySuccess` is the exception and differs because its English pair does — the bare
key carries no token and `_other` carries `{{count}}`.

`strings:bulk.removeCategoryApply_zero` is kept: `_zero` resolves in every locale regardless
of its categories, and English ships it.

## Locale-specific traps

- **Loanword transliteration follows the standard orthography**, and the common
  misspellings are widespread enough to look right: "메시지" (not 메세지), "콘텐츠" (not
  컨텐츠), "데이터" (not 데이타), "라이선스" (not 라이센스), "플러그인" (not 플러그 인).
- **"스테이지" is correct for _stage_** — the gaming word for a playable level. "단계" is
  exactly the process reading `terminology.md` warns about.
- **"Judge"** takes the evaluative sense (평가), never 판사/재판.
- **한자어 or native word — decide per term and record it.** "저장" vs "보관", "삭제" vs
  "지우기", "설정" vs "환경 설정" are register choices, not synonyms to alternate between.
  The three 설정 surfaces are settled below.
- **Do not carry the English period into a label.** “저장” takes no full stop; sentences do.
- **Count-neutral phrasing.** `english-review-notes.md` lists keys with no plural forms
  where English writes "entr(ies)". Korean needs no parenthetical at all — number plus
  counter already covers every count.

### The three-way 설정 hazard

Three different surfaces are *settings* in English and they must not share a rendering:

| Surface | Rendering | Keys |
| --- | --- | --- |
| the per-project Config tab | “설정” | `strings:tabs.config`, `strings:guide.topicConfig` “설정 탭” |
| the workspace-wide Global Config page | “글로벌 설정” | `config:globalConfigTitle`, `sidebar:globalConfig` — byte-identical in English, so byte-identical here |
| the app-wide Settings page | “환경 설정” | `settings:title`, `sidebar:settings` — byte-identical in English, so byte-identical here |

`config:workspaceSettingsTitle` ("Workspace Settings") is a fourth, “워크스페이스 설정”, and
is a section inside the Global Config page rather than a rival surface.

## Surface names settled so far — repeat these verbatim

A surface's name is written out two or three times, in different namespaces, and the keys
are usually never on screen together. A later change that names one of these copies it
exactly and does not re-decide.

| Surface | Rendering | Fixed by | Also owed by |
| --- | --- | --- | --- |
| Global Config | 글로벌 설정 | `config:globalConfigTitle` | `sidebar:globalConfig`; named in prose by `orphans:relink.aiNoModules` and `colorText:assistant.openConfig` |
| Translation Memory | 번역 메모리 | `config:tm.policyTitle` | `sidebar:translationMemory`, `strings:guide.groupTranslationMemory`, `strings:guide.topicTranslationMemory` |
| Settings | 환경 설정 | `settings:title` | `sidebar:settings`, `welcome:themeChooser.intro` |
| Changelog | 변경 이력 | `sidebar:changelog` | `common:changelogEntryError` |
| Legal | 법적 고지 | `sidebar:legal` | `legal:title` is a **different English string** ("Legal & policies") and expands deliberately: “법적 고지 및 정책” |
| Account | 계정 | `sidebar:account` | the Account page has no title key of its own |
| Guide | 가이드 | `sidebar:guide` | `welcome:guidesHeading` (English's plural *Guides*, one rendering in Korean) |
| Translations (tab) | 번역 | `strings:tabs.strings` | `strings:guide.topicMultiLanguage` “번역 탭”; named in prose by `config:routing.categoriesConfiguredHint` and `category:subtitle` |
| Compare (tab) | 비교 | `strings:tabs.compare` | `strings:guide.topicCompare` “비교 탭”; named in prose by `config:routing.tonesHint` |
| Backup (tab) | 백업 | `strings:tabs.backup` | `strings:guide.topicBackup` “백업 탭”; named in prose by `config:importSnapshotNote`. `backup:title` ("Backup and Restore") expands to “백업과 복원” |
| Orphans (tab) | 미연결 항목 | `strings:tabs.orphans` | `orphans:title`, `strings:guide.topicOrphans` “미연결 항목 탭”; named in prose by `config:fullReplaceOrphanNotice`, which calls it the *Relink tab* in English — a stale name, not a second tab |
| Config (tab) | 설정 | `strings:tabs.config` | `strings:guide.topicConfig` |
| Data (tab) | 데이터 | `strings:tabs.data` | — |
| Routing (tab) | 배정 | `strings:tabs.routing` | `strings:guide.topicRouting` “배정 탭”. The *routing rule* term is 배정 규칙; the tab is the bare root |
| Source AI review | 원문 AI 검토 | `strings:tabs` (review-source-ai) | `review:sourceAi.configTitle` |
| Translation AI review | 번역 AI 검토 | `strings:tabs` (review-translation-ai) | `review:translationAi.title` |
| Manual review | 수동 검토 | `strings:tabs` (review-manual) | `review:title` is a **different English string** ("Review queue") and ships “검토 대기열”. Do not copy 수동 검토 onto it |
| Quality | 품질 | `strings:tabs.quality` | `strings:guide.topicQuality`. `quality:title` is a different English string ("Quality Dashboard") and ships “품질 대시보드” |
| Glossary (tab) | 용어집 | `strings:tabs.glossary` | `strings:guide.topicGlossary` “용어집 탭”, `glossary:glossaries` |
| Category (tab) | 카테고리 | `strings:tabs.category` | `strings:guide.topicCategory` “카테고리 탭”, `category:title` — English's singular tab / plural page title carries nothing into Korean |
| Activity | 활동 | `strings:tabs.runs` | `strings:guide.topicActivity`. The **page title expands deliberately**: `strings:runs.title` is “번역 활동”. Named in prose by `review:sourceAi.progressActivityNote` and `orphans:toast.aiRetranslateStarted` |
| Sharing | 공유 | `strings:tabs.sharing` | `collab:sharing.pageTitle` — exact equality with the rail item, and they do co-render; licensed because English is byte-identical in both homes |
| Stage details | 스테이지 상세 | `strings:tabs` (stage-details) | `stage-details:title` |
| Text Styler | 텍스트 스타일러 | `strings:tabs` (color-text) | `sidebar:colorText`, `colorText:title` — all three agree |
| AI Review (guide topic) | AI 검토 | `strings:guide.topicAiReview` | `strings:runs.judgeBadge` |
| Pseudo Test | 슈도 테스트 | `config:pseudoTestHelpAria` | `strings:guide.topicPseudoTest` |
| Credential Vault | 자격 증명 보관함 | `strings:guide.topicVault` | `vault:statusLabel`. Short form 보관함 |
| **Theme names** | 클래식 / 픽셀 / 테크노 / 미니멀 | `settings:themes.*.name` | `welcome:themeChooser.names.*`, **byte-identical, copied out of `locales/ko/settings.json` rather than out of this row** — the two are never on screen together, so nothing mechanical would catch a divergence. `welcome:themeChooser.keepDefault` reuses one: “테크노 유지” |

The word for *tab* is 탭, appended after a space: “번역 탭”. Every `strings:guide.topic*`
whose English ends in "Tab" follows that shape; `topicQuality` and `topicActivity` have no
"Tab" suffix in English and take none here.

### The guide / sidebar group headings

`strings:guide.group*` and `sidebar:groups.*` name the same groupings and must agree. Five
are shared; each side has one the other lacks.

| Heading | en | ko | Owed by |
| --- | --- | --- | --- |
| Setup | Setup | 준비 | `sidebar:groups.project` |
| Translate | Translate | **번역 작업** | `sidebar:groups.translate` — **not** 번역; see below |
| Review | Review | 검토 | `sidebar:groups.review` |
| Terminology | Terminology | 용어 | `sidebar:groups.content` |
| Maintenance | Maintenance | 유지 관리 | `sidebar:groups.maintenance` |
| Translation Memory | Translation Memory | 번역 메모리 | no sidebar group — it is the sidebar *item*. In the guide rail it sits over its identically named only child, an exact equality that is **licensed** because English writes the identical pair |
| Page | Page | 페이지 | `sidebar:groups.page` has no `strings:guide` counterpart |

**Why `groupTranslate` is 번역 작업.** `Sidebar.tsx` renders `sidebar:groups.*` as a heading
with the `strings:tabs.*` items nested underneath, and the first item under *Translate* is
`strings:tabs.strings` — “번역”. A bare 번역 for the heading would put an identical string
directly above its own child, which is the one thing the co-render rule never licenses. The
proper-prefix pair 번역 작업 / 번역 is licensed on structure: a heading over its own child.
The same argument covers 검토 over its four members and 용어 over 용어집.

**One heading rendering recurs inside a sentence and that is licensed.** The sidebar's
번역 작업 and the noun in `logs:translation.queued` are painted at the same time (the rail is
always visible, the console can be). One is a navigation heading, the other is a noun inside
a narrated sentence, and no reader confuses them — which is also why the log line was
reworded to “번역 {{total}}건” rather than keeping 작업 there.

## The numeral-agreement guard, and what it can and cannot see here

`node scripts/i18n-preflight.mjs ko` reports **204 raw / 64 after the token axis / 64
uncleared**, because `ko` has no word-axis calibration. **All 64 are correct**, and they are
correct for a grammatical reason rather than an unfinished calibration: *Korean nouns do not
inflect for number at all*, so no numeral can force a wrong form. Every survivor is a
counter (개, 건, 자, 초, 번째, 점, 배, 바이트), a unit noun (토큰), or an ordinary noun after a
non-numeric token (`config:instances.instanceOf` “{{base}} 인스턴스”).

That makes `ko` the third member of the class `tr` and `ja` already occupy — see
`NUMERAL_WORD_AXIS_INAPPLICABLE_LOCALES` in that script. **It is filed as a finding against
the tool, not worked around in the strings**, and it must not be answered with a per-word
exemption list: 개, 건, 자 and every other counter sit in the same position and are equally
invariant, so a word list would need extending on every future round and would imply the
axis still has work to do here.

**Korean's real placeholder hazard is a different one, and no regex in this repo checks it:**
the particle chosen by an interpolated value's final sound. See "Placeholders" above. It is
the same shape as the Turkish welded-suffix hazard that `WELDED_SUFFIX_LOCALES` exists for,
and Korean would be a candidate for that check **except** that the check's premise —
"a letter immediately after `}}` is suspect" — would fire on every correct
`{{count}}개`, which is the commonest shape in this locale. Filed as an observation, not a
request.

## The six register and typography sweeps

Instantiate each from this file. All six run clean on the finished Korean.

| Sweep | Korean instance | Command |
| --- | --- | --- |
| the pronoun the guide bans | 당신 | `grep -r '당신' packages/frontend/src/locales/ko` |
| the register the guide bans mid-file | 합니다체 (`합니다`, `하십시오`, `하시기`) | `grep -rE '합니다\|하십시오\|하시기' packages/frontend/src/locales/ko` |
| straight quotes where the guide sets 큰따옴표 | `\"` and `'` inside a value | `grep -rE '\\\\"' packages/frontend/src/locales/ko` |
| doubled spaces | `  ` | `grep -rE '[^ ] {2}[^ ]' packages/frontend/src/locales/ko` |
| three-dot ellipses instead of the single character | `...` for `…` | `grep -rF '...' packages/frontend/src/locales/ko` |
| hyphens used as dashes | ` - ` for ` — ` | `grep -rE ' - ' packages/frontend/src/locales/ko` |

A seventh, Korean-specific: **a sound-selected particle written directly against a token** —
`grep -rE '\}\}(이\|가\|은\|는\|을\|를\|와\|과\|로\|으로)' packages/frontend/src/locales/ko`
returns nothing, and must keep returning nothing. It is the only mechanical check that
covers the hazard in "Placeholders".

**The genitive 의 is deliberately not in that list, and the exclusion was derived rather
than assumed.** The first version of this sweep included it and returned four hits — the
four `stage-details:chatQuickPrompts.*` values, all of the shape “{{focus}}의 …”. 의 does not
alternate on the preceding syllable's final sound the way the nine above do, so it is safe
welded to a token and those four are correct. Adding it to the pattern would have produced
four standing false positives that a later round would eventually "fix" into worse Korean.
