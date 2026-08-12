# NARN terminology — Vietnamese (`vi`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/vi.md`](../style/vi.md) — how Vietnamese is written here: register, punctuation,
  capitalization, plural and agreement rules. That one is yours to write too, for this
  locale only.

Fill a row when you meet the term, in the same change that introduces the wording — so
this file records decisions actually taken, never predictions. Use **Notes** for anything
the next translator would otherwise have to rediscover: a declension that forced a
different word, a term you deliberately left in English, an acronym you expanded, a
candidate you rejected and why.

Terms are in the order they appear in `../terminology.md`. Do not add, remove or reorder
rows: a term the lexicon lacks goes in the additive queue in [`README.md`](README.md).

| Term | Rendering | Notes |
| --- | --- | --- |
| project | dự án | Noun. The verb is *tạo* ("Xóa dự án", "Nhân bản dự án"). Never *tệp* or *thư mục*. |
| workspace | không gian làm việc | Deliberately long, and deliberately not shortened: it has to read as visibly *wider* than **dự án**, and every short candidate (*vùng làm việc*, *nơi làm việc*) reads as a region **inside** a project rather than above it. `config:workspaceSettingsTitle` is the anchor. |
| entry | mục | The counted unit of content, everywhere. Chosen over *chuỗi* (string — reserved, per the `logs` narration rule), *dòng* / *hàng* (row or line, a table artefact — kept for CSV rows only, as at `config:rowsProcessed`), *bản ghi* (record) and *khoản mục* (bureaucratic). One syllable, which matters: it is repeated in every count string in the app. |
| source text | văn bản nguồn | Shares *nguồn* with **ngôn ngữ nguồn** and **nhãn nguồn**, which reads naturally in Vietnamese because the head noun differs each time. |
| translation | bản dịch | Noun; the verb is *dịch*. Countable, and takes no plural marking after a numeral. |
| source label | nhãn nguồn | *nhãn* is reserved for this and is not reused for **danh mục** or for an inline tag. `config:routing.sourcesHint` is the anchor; the routing column shortens it to the head noun alone. |
| achievement | thành tựu | What Vietnamese game platforms use. Not *huy hiệu* (badge) or *phần thưởng* (award). |
| inline tag | thẻ nội tuyến | *thẻ* is the markup sense and is kept away from *nhãn* (**source label**), which is metadata about an entry rather than something inside the text. |
| placeholder | phần giữ chỗ | The token sense only. The input-hint sense of the same English word takes *gợi ý* instead, per this row's requirement that a language using one word for both must use two. |
| translator context | bối cảnh | *bối cảnh* is situational context, kept deliberately apart from *ngữ cảnh*, which is spent on the model context window (`config:models.confidenceReason.prompt-near-context`). Both are "context" in English and Vietnamese separates them cleanly. The full phrase naming the person is settled at `strings:compare.editContext` in batch 2; batch 1 met only the CSV column, `config:includeContext`. |
| source language | ngôn ngữ nguồn | Pairs with **ngôn ngữ đích**; the two sit side by side in `config`. |
| target language | ngôn ngữ đích | Not *bản địa* or *ngôn ngữ khu vực* — the app tracks languages, not locales, which is the confusion this row bans. |
| reference language |  |  |
| writable language |  |  |
| Pseudo Test | Pseudo Test | Kept in English as the proper name of a synthetic language, alongside the never-translated code *pseudo-test*. Vietnamese has no term for pseudo-localization, and a coined one would read as the name of a real language. |
| run | lần chạy | Noun only — Vietnamese has no bare-verb reading to confuse it with. Not *tác vụ* (task), *tiến trình* (process), *phiên* (session) or *lô* (**batch**, which a run contains). |
| revert |  |  |
| Activity |  |  |
| log |  |  |
| batch | lô | One syllable, and the only member of its family that is: **cách nhóm lô** and *chế độ lô* are both built on it. Kept clear of *hàng loạt*, which is the bulk-operation word. |
| batch grouping | cách nhóm lô | Against *chế độ lô* for batch mode — different heads (*cách* against *chế độ*), so the two settings never read as one, which this row asks for explicitly. |
| AI review |  |  |
| judge | đánh giá | The evaluative sense. *thẩm phán* and *xét xử* are the legal readings and are wrong here. Used as a verb in prose; never introduced as a noun. |
| source review | rà soát nguồn | *rà soát* is the AI-inspection root and is kept away from *kiểm tra*, which is spent on the deterministic LQA **check**. |
| finding |  |  |
| suggestion |  |  |
| discard | Bỏ thay đổi / Từ chối | Two senses, two words, as this row predicts. Sense 1 — unsaved edits, with a Save button beside it (`config:discard`) — is *bỏ thay đổi*, never bare *hủy*, which is Cancel. Sense 2 — refusing something the app offered — is *từ chối*. The third sense split out as **omit** takes a third word again. |
| needs review |  |  |
| flag |  | Settled in batch 2, where the term is actually met (`strings:compare.flagAllNeedsReview`). Batch 1 deliberately does **not** claim it: the LQA check descriptions in `config:lqa.checks.*` open with the English verb *Flags*, and that is the ordinary reporting verb, not this term — a check files an **issue**, it does not set a review disposition. Rendering those with the flag word would have imported the review-queue meaning into a machine verdict, so they use the issue term instead. |
| ignore / ignored |  |  |
| Review (the sidebar group) |  |  |
| review queue |  |  |
| back-translation |  |  |
| module | mô-đun | Hyphenated transliteration, settled once for the whole locale. The bare English form and the unhyphenated *môđun* are both attested in Vietnamese software; this locale takes the hyphenated form and does not alternate. |
| module instance | thực thể mô-đun | Vietnamese has no settled word for *instance*. *phiên bản* is the obvious candidate and is unusable — it is *version*, and this app shows version numbers. *bản sao* is *copy*, which this row bans. *thực thể* is what Vietnamese technical writing uses for a programmatic instance and is free here. Shortened to *thực thể* once *mô-đun* is established in the sentence. |
| provider | nhà cung cấp | The outside company. Three English strings label a module-instance picker "Provider"; those are translated as written and do not drag **mô-đun** toward this word anywhere else. |
| model | mô hình | The AI model. *mẫu* is deliberately spent on **template** instead, which is the collision this row warns about — Vietnamese would otherwise reach for *mô hình* for both. |
| prompt | lời nhắc | Kept apart from *yêu cầu* (request — the same settings panel carries requests-per-second) and from *truy vấn* (search query). |
| reasoning effort | mức độ suy luận | The provider's own parameter. *nỗ lực* (effort as work expended) is avoided — this row says explicitly it is not effort in that sense. |
| routing rule | quy tắc điều phối | **Not *định tuyến*.** That is the Vietnamese networking word and nothing else, and this row says to avoid any word suggesting network routing. *điều phối* — to dispatch, to allocate — is what the feature does, and is claimed by no other term. The wave-3 seed cited *định tuyến* in `style/vi.md`; it was written before this row was read, and it is corrected there rather than quietly replaced. |
| rule group | nhóm quy tắc | Not reused for **danh mục** or for **cách nhóm lô**, which is the alternation this row warns against. |
| credential vault | kho bảo mật | One phrase has to carry all four call sites and it does. *két* (a strongbox) is the literal vault and reads as furniture; *kho lưu trữ* is generic storage, which this row bans. |
| credential | thông tin xác thực | The standard Vietnamese rendering, and long — 24 characters at `config:credentialsMissingChip` against English's 19. Kept anyway: terms outrank the length budget, and every shorter candidate (*khóa*, *thông tin đăng nhập*) is a different concept this row bans. |
| LQA | LQA | Kept as the industry acronym. Vietnamese localization practice has no established expansion, and inventing one would make the filter chip and the check list read as two different systems. |
| quality gate | cổng chất lượng | The process-control sense of *cổng*, not a door. Vietnamese uses *cổng* for a checkpoint in a pipeline, so the physical reading this row warns about does not arise. |
| check | kiểm tra | The deterministic LQA rule. Held apart from *rà soát* (**AI review** and **source review**) — that separation is the point of both rows. Where a countable noun is needed, *phép kiểm tra*. |
| issue | vấn đề | Not *lỗi* (error), which this row bans and which the app uses for real failures. Distinct from *phát hiện*, the **finding** a source review reports. |
| severity | mức nghiêm trọng | The two values are fixed by **check** and do not drift here: blocking is *chặn*, warning is *cảnh báo*. |
| notification severity |  |  |
| assertion | khẳng định | A fourth word was genuinely required — *điều kiện*, *kiểm tra* and *quy tắc* are already spent on routing conditions, LQA checks and routing rules. |
| pattern | biểu thức | The regex sense only. *mẫu* is spent on **template**, which is exactly the collision this row flags. |
| overflow | tràn | The relative measure. Kept visibly different from **giới hạn độ dài**, the absolute cap — both appear in the same checks list. |
| length limit | giới hạn độ dài | The hard cap set by the game editor, and the routing condition on source length. Not built on *tràn*. |
| pass rate |  |  |
| glossary | bảng thuật ngữ | Vietnamese CAT vocabulary is unsettled; this is the common rendering and it is fixed here for the whole locale. Used for **glossary** only, never for **translation memory**. |
| glossary term | thuật ngữ | The head of **bảng thuật ngữ**, shortened once the glossary is established. Never *mục*, which is reserved for a content **entry** — this row flags that collision specifically. |
| constant |  |  |
| match |  |  |
| translation memory | bộ nhớ dịch | The established Vietnamese CAT term. Bare *bộ nhớ* is RAM and is left free for `logs:vault.credentialsEvicted`. |
| approve | chấp thuận | The only route into **bộ nhớ dịch**. Deliberately not built on *duyệt*, which carries the whole manual-review family: approve and mark-as-reviewed sit in the **same bulk bar**, so a shared root would collapse them exactly where a reader compares them. *chấp nhận* (accept) and *xác nhận* (confirm) are both banned by this row and are separate words in Vietnamese, so nothing is lost by avoiding them. |
| category | danh mục | Not *nhãn* (**source label**), *nhóm* (**rule group**) or *loại* (type). |
| tone | sắc thái | The register sense. *giọng điệu* is voice and *âm* is the acoustic reading — both banned. Vietnamese linguistics uses *sắc thái* for exactly this. |
| orphan | mồ côi | Used figuratively, as Vietnamese already does for an orphan process. The full noun phrase is *mục mồ côi*; the adjective is bare *mồ côi*. One figure across the tab title, the count chip, the confirm dialog and the log lines. |
| relink | liên kết lại | One verb for the row button, the dialog title, the confirm step and the import warning. |
| backup | sao lưu | Verb *sao lưu*, noun *bản sao lưu*. Kept apart from *xuất* (export) and from *điểm khôi phục* (**snapshot**). |
| snapshot | điểm khôi phục | English calls these restore points too, and Vietnamese has no separate word: *ảnh chụp* is a photograph and every other candidate this row bans outright. The *khôi phục* shared with the restore verb is fine — the heads differ, and the requirement is only that it stay distinguishable from **bản sao lưu**, which it plainly is. |
| template | mẫu | And **model** is *mô hình*, not *mẫu* — this is the pair this row calls dangerous, and Vietnamese has it too. |
| omit (from an export) | loại trừ | The third sense of English *discard*, and a third Vietnamese verb, matching the four locales that converged on an omit or exclude verb independently. `config:discardUntranslatable` destroys nothing and refuses nothing. |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| revoke |  |  |
| recording |  |  |
| stage |  |  |
| Text Styler |  |  |
| element |  |  |
| assistant |  |  |
| theme |  |  |
| guide |  |  |
| release |  |  |
| changelog |  |  |
| dismiss |  |  |
