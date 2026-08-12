# NARN terminology — Thai (`th`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/th.md`](../style/th.md) — how Thai is written here: register, punctuation,
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
| project | โปรเจกต์ | Transliteration, the spelling Thai software tooling uses. Rejected โครงการ: that is *project* in the civil-engineering and business-initiative sense and would read as a funded undertaking rather than a container of text. |
| workspace | เวิร์กสเปซ | Transliteration, deliberately unlike the project word so the two never converge. Rejected พื้นที่ทำงาน (*work area*), which is used for a window layout in Thai desktop UIs and would read as a screen region rather than a scope above the project. |
| entry | รายการ | The canonical term. It is also the natural Thai classifier for a listed item, so a count reads naturally as number then classifier with no plural marking. Reserved for the content unit only; it is NOT free for a glossary term, a log line or a release. Batch 1 already needed a different classifier twice: แถว for a CSV row and ชุด for a glossary. |
| source text | ข้อความต้นฉบับ | ต้นฉบับ is the settled Thai localization word for the source/original. Bare ต้นฉบับ is used where the sentence already says *text*. |
| translation | คำแปล | The produced text. The act of translating is การแปล and the verb is แปล. |
| source label | ป้ายกำกับแหล่งที่มา | Shortened to แหล่งที่มา for the routing column heading, which English also shortens to *Sources*. **Thai uses three different words for English *source*** and that is deliberate: ต้นทาง for source language, ต้นฉบับ for source text, แหล่งที่มา for the origin an entry was imported from. One word for all three would make the three terms indistinguishable, which is what the shared lexicon's *Not* list warns about. |
| achievement | ความสำเร็จ | The word Thai game platforms ship for a player achievement. Used attributively without a linker: ชื่อความสำเร็จ, คำอธิบายความสำเร็จ. |
| inline tag | แท็กในข้อความ | Literally *tag inside the text*, which is the whole point of the term — it names markup living in the content, not metadata about it. |
| placeholder | ตัวแทนค่า | Literally *value stand-in*. Deliberately NOT used for the input-hint sense of the English word: an empty-state hint on a control is ข้อความตัวอย่าง. Thai would otherwise happily use one word for both, which the shared lexicon forbids. |
| translator context | บริบทสำหรับผู้แปล | Explicitly *context for the translator*, because Thai would otherwise use one word for all three things English calls context. The entry-metadata bundle keeps the bare noun (the CSV export column), and a model's context window takes a transliteration — see the model rows. |
| source language | ภาษาต้นทาง | Pairs with the target-language row below; ต้นทาง and ปลายทาง are a fixed Thai pair and read correctly side by side. |
| target language | ภาษาปลายทาง | Thai does not mark number, so the plural label and the singular label are the same phrase. That is a licensed same-rendering collision, not drift. |
| reference language | ภาษาอ้างอิง | A reading aid only. Never built on ต้นทาง, which would imply the app translates through it. |
| writable language |  |  |
| Pseudo Test | ทดสอบเทียม | เทียม is *artificial* in the productive Thai sense (ดาวเทียม, ฟันเทียม), so pseudo text is ข้อความเทียม from the same root. Rejected จำลอง (*simulated*) and any transliteration: จำลอง is the mock/dummy reading the shared lexicon rules out. The language code itself is never translated. |
| run | รอบการทำงาน | Always a noun, never a verb — Thai verbs for what starts one are แปล, เริ่ม, สร้าง. Shortened to รอบ inside a phrase where the sentence has already established what is running (รอบการแปล). Rejected งาน, which is the *job* reading the shared lexicon reserves against. |
| revert | ย้อนกลับ | Rolls back everything one run wrote. Three separate verbs are kept apart here and all three can be on screen at once: this one, เลิกทำ for *undo* (one earlier version of one cell) and กู้คืน for *restore* (a backup, and restoring an earlier version from the undo dialog). The badge takes the same verb plus แล้ว. Batch 2 had to move the bulk-bar back button off this word for the same reason. |
| Activity | กิจกรรม | The tab and the guide topic take this word alone; the page title expands it with the translation word, exactly as English expands *Activity* to *Translation Activity*. Never ล็อก or ประวัติ. |
| log | ล็อก | Transliteration, so the live server-log panel can never be confused with กิจกรรม (the run history) or with the changelog. *Log entry* and *log stream* build on the same word rather than taking one of their own. |
| batch | แบตช์ | Transliteration, chosen because both natural Thai candidates are already spoken for: ชุด is the classifier this locale uses for a glossary and other bundles, and กลุ่ม is the head of the rule-group term. A loanword keeps *batch* unmistakable in ขนาดแบตช์, โหมดแบตช์ and การจัดกลุ่มแบตช์. |
| batch grouping | การจัดกลุ่มแบตช์ | Shares the morpheme กลุ่ม with the rule-group term, which is a shared root and not a collision: the heads differ (a *grouping* against a *group*) and nothing in the UI contrasts the two. |
| AI review | รีวิวด้วย AI | รีวิว is a loanword and carries the *opinion* sense in Thai, which is exactly right for a model's judgement. Deliberately NOT การตรวจสอบ, this locale's word for a deterministic LQA check — the shared lexicon forbids rendering this term with the check word, and Thai has three distinct words available. The two named tabs specialise it with the translation and source words. |
| judge | ประเมิน | The evaluative sense only, as a verb in explanatory copy. Never ตัดสิน or ผู้พิพากษา, which are the legal readings. No noun *the judge* is introduced, matching English. |
| source review | รีวิวต้นฉบับ | รีวิว (loanword) is reserved for a model's opinion and is kept apart from การตรวจสอบ, which is the deterministic LQA check, and from ตรวจทาน, which is a person reading. Thai has three separate words here where English has one, so the split is forced rather than chosen. |
| finding | ประเด็นที่พบ | Literally *the point that was found*. Kept apart from ปัญหา, the machine verdict an LQA check files, because both are listed on the same entry. Counted with the classifier ข้อ. |
| suggestion | ข้อเสนอแนะ | One word across the judge panel, the glossary generator and the category generator. The action on it is นำไปใช้ (*apply*) — including at `strings:runs.judgeApproveAll`, where the English says *Approve* for the same action and must not be followed. |
| discard | ยกเลิกการแก้ไข / ทิ้ง | Two senses, two words, as the shared lexicon requires — and both now ship. The first is the ghost button beside Save (`config:discard`, `strings:editor.discard`): it cancels an edit the user made, so it is phrased as cancelling. The second refuses something the app offered (`strings:runs.judgeDiscard`) and destroys nothing of the user's, so it is the bare *throw away* verb. Check the call site: a Save button beside it means the first. |
| needs review | ต้องตรวจทาน | The same wording in the filter, the badge and the flag-all action. Thai has no case, so the deliberately lowercase cell badge and the sentence-case filter label are the identical string — the casing distinction the shared lexicon protects does not exist here, and nothing is lost. It is a verb phrase and carries no gender, so the agreement question raised for es/fr does not arise. |
| flag |  |  |
| ignore / ignored | ละเว้น | The action and the state share the verb; Thai marks the state by context, not by a participle. Kept apart from ข้าม (*skip*), which is the per-run routing outcome. Note that where an LQA check *flags* something, this locale writes รายงาน (*reports*) rather than the review-queue flag verb — see that row. |
| Review (the sidebar group) | การตรวจ | The bare root nominalized, chosen so the umbrella is not derived from any one of its four members: its children take รีวิว (a model's opinion), ตรวจทาน (a person reading) and การตรวจสอบ (deterministic rules), and ตรวจ is the root all three share without being any of them. As shipped it is a substring of no child label, so nothing in the sidebar reads as a heading repeating its own child. |
| review queue |  |  |
| back-translation |  |  |
| module | โมดูล | Transliteration. The canonical term for the thing every picker selects. |
| module instance | อินสแตนซ์โมดูล | Shortened to อินสแตนซ์ once โมดูล is established in the sentence, exactly as English shortens it. The instance id itself is never translated. |
| provider | ผู้ให้บริการ | The outside company behind a module. The three English strings that label a module picker *Provider* are translated as written with this word, per the shared lexicon, and that does not drag the module row toward it. |
| model | โมเดล | Transliteration. This is the reason the template row below cannot use the obvious Thai word for a pattern or a model. |
| prompt | พรอมต์ | Transliteration. Kept apart from คำขอ, which is an HTTP request, and from การค้นหา, which is a search query. |
| reasoning effort | ระดับการให้เหตุผล | The provider's own parameter, phrased as a *level of reasoning* rather than as effort expended, so it cannot be read as work done or as a run's cost. |
| routing rule | กฎการจ่ายงาน | จ่ายงาน is *to hand work out*, which is content routing. Rejected every candidate built on เส้นทาง (*route*, *path*): all of them read as network routing, which the shared lexicon rules out. |
| rule group | กลุ่มกฎ | Kept apart from หมวดหมู่ (*category*) and from เทมเพลต. See the batch-grouping row for why sharing กลุ่ม is not a collision. |
| credential vault | ตู้นิรภัยข้อมูลรับรอง | Shortened to ตู้นิรภัย wherever the context is unambiguous, which is most of the app; the full noun phrase ships at `strings:guide.topicVault`. All four required phrasings were checked before deciding — the full noun phrase, ตู้นิรภัยถูกล็อก, ปลดล็อกตู้นิรภัย and รหัสผ่านตู้นิรภัย all read naturally. Rejected every keychain/wallet word; ตู้นิรภัย is the ordinary Thai word for a physical vault and carries the right weight. |
| credential | ข้อมูลรับรอง | Usually plural in English, unmarked in Thai. The vault key names themselves are literal identifiers and stay in Latin. |
| LQA | LQA | Kept as the industry acronym. Thai localization practice uses the English acronym; no established Thai form exists, and inventing one would leave the filter chip and the check list disagreeing with every other Thai CAT tool. |
| quality gate | เกณฑ์คุณภาพ | เกณฑ์ is a *criterion / threshold*, which is the process-control sense. Every physical-door word (ประตู, ด่านตรวจ) was rejected — and ด่าน in particular is already the *stage* term. |
| check | การตรวจสอบ | One word across *quality check*, *LQA checks* and each individual check name. It is a compound on ตรวจ, which is also the root of the sidebar Review group and of ตรวจทาน; the three are distinguished by their second element, which is what makes the umbrella work rather than a collision. |
| issue | ปัญหา | The machine verdict an LQA check files. Kept apart from ข้อผิดพลาด (*error*) and from whatever a source-review finding takes, since both are listed on the same entry. |
| severity | ระดับ | *Level*, which is the only form batch 1 needed — every occurrence there sits in a sentence that has already named the check, so the fuller phrasing would be padding. Where a bare column or label has to carry the term alone it extends with the Thai word for severity, and that form ships with the quality namespace in a later batch. The two values are fixed by the check row: ปิดกั้น and คำเตือน. |
| notification severity |  |  |
| assertion | ข้อยืนยัน | A genuinely fourth word, as the shared lexicon requires: เงื่อนไข is taken by routing conditions, การตรวจสอบ by the LQA checks and กฎ by routing rules. |
| pattern | รูปแบบ | The regex sense only. Free to take this word precisely because the template row went to a transliteration; in Thai รูปแบบ would otherwise be the obvious word for a template too. |
| overflow | การล้น | Attributive in อัตราส่วนการล้น; the check itself is named ความยาวล้น. Kept clearly apart from the length-limit row — one is a ratio against the source, the other an absolute cap from the game. |
| length limit | ขีดจำกัดความยาว | Absolute, set by the game editor. Never reuses the overflow word. |
| pass rate |  |  |
| glossary | อภิธานศัพท์ | The established Thai term. Long (11 characters) but correct, and it is not reused for translation memory. |
| glossary term | คำศัพท์ | Never รายการ, which is reserved for a content entry — the two are counted in adjacent strings. |
| constant |  |  |
| match | ตรงกัน / จับคู่ | Batch 1 met only the verb: ตรงกัน for *matches* in a condition or a search, จับคู่ for the act of matching a glossary term against source text. Both are built on the same idea deliberately, so the noun settled in a later batch can stay on this root. |
| translation memory | หน่วยความจำการแปล | Always the full phrase. Bare หน่วยความจำ is RAM in Thai, which is exactly the confusion the shared lexicon warns about, and this app has a log line that genuinely means RAM. |
| approve | อนุมัติ | Promotion into translation memory. Kept apart from นำไปใช้ (*apply* a suggestion), บันทึก (*save*) and the mark-as-reviewed phrasing — all four appear in one bulk bar. |
| category | หมวดหมู่ | Not reused for the rule-group or source-label rows. |
| tone | น้ำเสียง | The register a piece of text is written in. Rejected โทน: this product also ships a colour tool, and a bare โทน beside colour swatches reads as a colour tone. Rejected โทนเสียง, which is acoustic. |
| orphan | รายการกำพร้า | Built on the entry word plus *orphaned*, because an orphan is literally an entry in that state. The same phrase serves the tab title, the count chip, the confirm dialog and the log lines. |
| relink | เชื่อมใหม่ | One verb for the row button, the dialog title, the confirm step and the import warning. |
| backup | ข้อมูลสำรอง | A noun; the verb is สร้างข้อมูลสำรอง. Kept apart from ส่งออก (*export*) and from the snapshot row. Restoring one is กู้คืน. |
| snapshot | สแนปช็อต | Transliteration, so it can never be mistaken for the backup term in the sentences that use both. |
| template | เทมเพลต | Transliteration. The obvious Thai words — แบบ, รูปแบบ, ต้นแบบ — are either already taken by the pattern row or read as a physical mould. |
| omit (from an export) | ไม่รวม | A third verb, distinct from both discard senses: nothing is destroyed and nothing is refused, only left out of a generated file. Met in batch 1, in the export checkbox, exactly as the shared lexicon predicts. |
| collaborator |  |  |
| member |  |  |
| nickname |  |  |
| claim |  |  |
| invite |  |  |
| revoke |  |  |
| recording | การบันทึกการแก้ไข | Names the capture, not the captured rows. It has to be the full nominal phrase rather than the bare verb, because that verb alone is this locale's word for *save* — the bare form would make a paused audit read as a paused save. Never รายการ (an entry) and never ล็อก. The three English words for this one feature — audit, record, track — all take this term. |
| stage | ด่าน | A playable level, the word Thai gaming uses. Never ขั้นตอน or ระยะ, which are exactly the process readings the shared lexicon calls the most likely mistranslation in the app. ด่าน is also why the quality-gate term avoids every checkpoint word. |
| Text Styler | ตัวแต่งข้อความ | A product surface name, translated once and repeated in the sidebar item, the tab label and the tool's own title. แต่ง is *to style or adorn*, not *to edit*, so it does not read as a text editor. |
| element |  |  |
| assistant | ผู้ช่วย | A role — literally *the one who helps* — and not the abstract noun for assistance, which is the near-miss the shared lexicon warns a locale ships first. Decided at the run-type labels, where the word appears before any chat surface does. Thai compounds with no linking form, so the chat compound needs no adjustment. |
| theme |  |  |
| guide | คู่มือ | One word for every *read the guide* link, the sidebar item and the guide topics. Never ช่วยเหลือ, which is the help sense. |
| release |  |  |
| changelog |  |  |
| dismiss |  |  |
