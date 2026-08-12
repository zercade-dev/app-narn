# NARN terminology — Brazilian Portuguese (`pt-br`)

Your locale's rendering of every term in the shared lexicon. **This file is yours alone** —
no other locale's file is touched by your work, and nobody else writes rows here.

Read it alongside two other files:

- [`../terminology.md`](../terminology.md) — what each term *means*, its part of speech,
  an example key, and what it must not be confused with. It is **frozen** for the duration
  of the backfill: you read it, you never edit it. See the freeze notice at its top.
- [`../style/pt-br.md`](../style/pt-br.md) — how Brazilian Portuguese is written here: register, punctuation,
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
| project | projeto | |
| workspace | espaço de trabalho | Deliberately a phrase rather than one word, so it can never be confused with *projeto*. `config:workspaceSettingsTitle` is “Configurações do espaço de trabalho”. |
| entry | entrada | Canonical. The `logs` namespace narrates about the same object with the English word *string*; it takes this rendering there too. The one exception is `logs:translation.queued`, which counts jobs rather than entries — see english-review-notes.md and the *run* row below. The word is claimed on the noun naming a unit of content and nothing else: *entrada de log* and the input-token column header are other senses and stay free. |
| source text | texto de origem | `review:sourceText` is “Texto de origem”. *origem* is the shared root for source text, source language and source label. |
| translation | tradução | The plural is the tab label: `strings:tabs.strings` is “Traduções”. |
| source label | rótulo de origem | `generation:fieldSources` is “Rótulos de origem”. The routing column shortens it the way English does: `config:routing.labelSources` is “Origens”. |
| achievement | conquista | The settled word in Brazilian game platforms. Not *troféu*, which is PlayStation-specific. |
| inline tag | tag inline | *tag* alone where the sentence already places it inside the text (`logs:translation.maskMismatch`). Kept apart from *rótulo*, which is the source-label word. |
| placeholder | placeholder | Kept as the loanword — it is what Brazilian developers say, and it is what the LQA check name has to match. The input-hint sense of the same English word is a different word here (*texto de exemplo* / *dica*) and never this one. |
| translator context | contexto do tradutor | `strings:compare.editContext` is “Editar contexto do tradutor”. Never the same phrase as a model's context window, which is *janela de contexto* (`config:models.confidenceReason.prompt-near-context`). |
| source language | idioma de origem | *idioma* everywhere, never *língua* — it has to pair with the two rows below. |
| target language | idioma de destino | |
| reference language | idioma de referência | |
| writable language | idioma editável | *editável* is fixed across all three surfaces: `collab:sharing.columnLanguages` is “Idiomas editáveis”, and the lock messages repeat it. Never alternate with *permitido* or *concedido*. |
| Pseudo Test | Pseudo Test | Proper noun, left untranslated: it names a synthetic language, and the language code is never translated either. Two words, so the identical-value guard does not see it. |
| run | execução | Always the noun; the verbs are *traduzir*, *iniciar*, *gerar*. Not *tarefa* nor *processo*. **A job is not a run:** one entry into one target language is a *trabalho*, which is what `logs:translation.queued` counts. |
| revert | reverter | *desfazer* is deliberately held for undo (`strings:compare.undo`), because both controls can be on screen at once. *restaurar* is the backup verb and is spoken for. |
| Activity | Atividade | The page title is longer than the tab on purpose: `strings:runs.title` is “Atividade de tradução”. |
| log | log | Kept as the loanword, which is what Brazilian server tooling says. *registro* is spent on recording below, and *histórico* would collide with Activity. A single line is *linha de log* (`console:empty`), built from the same word rather than a second term. |
| batch | lote | |
| batch grouping | agrupamento de lote | Distinct from batch mode, which is `config:module.batchMode` — “Modo de lote”. Also distinct from *operação em massa*, the bulk-bar wording. |
| AI review | revisão por IA | Never the *verificação* word, which belongs to the deterministic LQA checks. Note the two review tabs are named surfaces built on it, not this term reused verbatim. |
| judge | avaliar | The evaluative sense only. *julgar* and *juiz* are the legal reading and are wrong here; the feature is still named with the *revisão por IA* term, and no noun *o juiz* is introduced. |
| source review | revisão da origem | |
| finding | constatação | The audit sense, kept apart from *problema* (issue) because the two are listed against the same entry. *achado* and *apontamento* were both rejected: the first reads as a discovery, the second as a note. |
| suggestion | sugestão | The action on one is *aplicar* — and `strings:runs.judgeApproveAll` takes it too, against its own English: “Aplicar todas as sugestões”. Never *aprovar*, which is reserved below. |
| discard | descartar | **Sense 1 only** — unsaved edits, beside a Save button (`config:discard`, `strings:editor.discard`, `vault:discard`). Sense 2, refusing something the app offered, is *recusar*: `strings:runs.judgeDiscard` is “Recusar”. Two words are genuinely needed; the first destroys nothing the user made. |
| needs review | precisa de revisão | A verb phrase, so it carries no gender in any of its three surfaces. The row badge stays lowercase by design: `strings:compare.cellNeedsReviewBadge` is “precisa de revisão”. |
| flag | sinalizar | The review disposition, and only that. English also writes *flag* for a state marker (the new-import flag, the needs-review flag); those take *marcação* instead — see `strings:filters.clearNewFlags` — so one verb never both sets and clears the same state. |
| ignore / ignored | ignorar / Ignorada | The state badge agrees with *entrada*, hence feminine. Brazilian Portuguese has no verb for *unignore* either, so the negation is built rather than coined: `strings:row.unignoreAction` is “Deixar de ignorar a entrada”. |
| Review (the sidebar group) | Revisão | The umbrella noun, chosen so it is a proper substring of all three review tab names and of nothing else. It is never the name of any one member. |
| review queue | Fila de revisão | Built on the same root as *precisa de revisão*, so a reader sees one feature. |
| back-translation | retrotradução | The established Portuguese term of art, not a literal compound of *de volta* and *tradução* — a literal compound would name an action the product does not offer. `review:backTranslationTitle` is “Retrotradução (apenas referência)”. |
| module | módulo | |
| module instance | instância de módulo | Shortened to *instância* once *módulo* is established in the sentence. The instance id itself is a literal identifier and is never translated. |
| provider | provedor | The outside company. The three English strings that mislabel a module picker with it are translated as written, and must not drag *módulo* toward this word anywhere else. |
| model | modelo | This word is claimed by the AI model, which is why *template* below had to move rather than this one. |
| prompt | prompt | Kept as the loanword. Distinct from *requisição* (an HTTP request) and from *pesquisa* (a search query), both of which appear in the same settings panel. |
| reasoning effort | esforço de raciocínio | |
| routing rule | regra de roteamento | *roteamento* reads as content routing here because every string around it is about content; nothing in this app is about networks. |
| rule group | grupo de regras | Never reused for *categoria* or for *agrupamento de lote*. |
| credential vault | cofre de credenciais | *cofre* is **masculine**, which settles every standalone status word attached to it: `vault:statusLocked` is “Bloqueado”. Shortened to *cofre* where the context is unambiguous. |
| credential | credencial | |
| LQA | LQA | Kept as the industry acronym, unexpanded — Brazilian localization uses it as-is. Treated as **feminine** in agreement, from *garantia de qualidade linguística*. |
| quality gate | gate de qualidade | The process-control sense; the loanword is what Brazilian delivery pipelines call it, and every door reading (*portão*, *barreira*) is wrong. Shortened to *o gate* once quality checks have been mentioned, exactly as English does. |
| check | verificação | The same word in `config:lqa.title`, in the quality-check sentences and in every individual check name. |
| issue | problema | Kept apart from *constatação* (a source-review finding), because both are listed on the same entry. |
| severity | severidade | The two values are fixed by *check* and are not re-decided here. |
| notification severity | severidade de notificação | A separate value set, but *Aviso* is not free to re-decide: it renders identically in `account:notificationsSeverity.warning` and in `config:lqa.severityWarning`. |
| assertion | asserção | A fourth word was genuinely required: *condição*, *verificação* and *regra* are all spoken for by routing conditions, LQA checks and routing rules. |
| pattern | expressão | The regex sense only. *padrão* is the obvious word and is **not** available: it is what every *Default* in the product ships as, and the two sat one dialog apart. Never *modelo*, which is the AI model. |
| overflow | estouro | Relative to the source length. Kept clearly apart from the row below, which is an absolute cap. |
| length limit | limite de comprimento | Absolute, set by the game editor. Both appear in the same checks list, so *estouro* is never reused here. |
| pass rate | taxa de aprovação | *taxa de sucesso* is the trap: `config:health.successRate` is a different metric in the same product, so the two never share a word. |
| glossary | glossário | Used for glossaries only, never for translation memory. |
| glossary term | termo | Shortened to *termo* inside the Glossary tab, as English does. Never *entrada*, which counts content. |
| constant | constante | Kept apart from the read-only flag two columns away, which is *somente leitura*. |
| match | correspondência | Noun and verb share the root: the routing condition is `config:lqa.regexModeMustMatch` — “Deve corresponder”. |
| translation memory | memória de tradução | The full phrase every time. Bare *memória* is only ever used where *da memória de tradução* has just been said; RAM is spelled out as such in `logs:vault.credentialsEvicted`. |
| approve | aprovar | Promotion into translation memory, and nothing else. Distinct from *aplicar* (a suggestion), *marcar como revisado* and *salvar* — all four sit in the same bulk bar. |
| category | categoria | |
| tone | tom | The authoring instruction, not the acoustic sense and not *estilo*, which would read as the model's writing style. |
| orphan | órfão | The literal figurative noun works in Portuguese and is used for the tab title, the count chip, the confirm dialog and the log lines alike. |
| relink | revincular | One verb for the row button, the dialog title, the confirm step and the import warning. |
| backup | backup | The loanword, which is what Brazilians say. The verb is *criar um backup*, never *fazer backup de* as a term. |
| snapshot | snapshot | Also the loanword, and deliberately a different word from *backup* because several strings use both in one sentence. *instantâneo* was rejected — the lexicon bans the instant reading. |
| template | template | *modelo* is the obvious Portuguese word and is **not available**: it is spent on the AI model, which the lexicon says outranks this row. The loanword is standard in Brazilian development. `config:templatesTitle` is “Templates de projeto”. |
| omit (from an export) | omitir | A third verb, distinct from both senses of *discard*. **Never *excluir***, which is Brazilian for delete: `config:discardUntranslatable` is “Omitir entradas que não precisam de tradução”, and nothing is deleted there. |
| collaborator | colaborador | |
| member | membro | Two distinct words are required — both appear in adjacent strings on the Sharing page. |
| nickname | apelido | Never *nome de usuário*: the account identity already exists, and giving both one name recreates the confusion the collaborator/member pair exists to prevent. |
| claim | reivindicar | Yields all four forms the UI needs, and stays clearly apart from *reservado*, which is the adjacent “that name is taken” message (`collab:errors.nickname_reserved`). |
| invite | convite | The four statuses are translated as one set of masculine participles agreeing with *convite*. |
| revoke | revogar | The infinitive and the participle differ (*Revogar* / *Revogado*), which matters because the status cell and the revoke button are adjacent columns of one table. |
| recording | registro | The manual-edit audit. English also calls it *audit* and *track*; all three keys take this word. Never the *verificação* word, and never *entrada* — `strings:runs.manualRecordingPaused` would otherwise read as if an entry had been paused. |
| stage | fase | A playable level. Brazilian gaming genuinely calls one a *fase*, so the usual warning against the process reading is satisfied by the ordinary word here — but it must never leak into a string where *stage* would mean a step. |
| Text Styler | Estilizador de texto | One rendering across `sidebar:colorText`, the tab label and `colorText:title`. |
| element | elemento / Elementos | The group heading `colorText:groupElements` is “Elementos”. The seven swatch names are game content and ship untranslated, matching what the game itself uses in Brazilian Portuguese. |
| assistant | assistente | The persona, decided at its first appearance in the run-type labels rather than at the chat surfaces. Never *assistência*, and never *ajudante* or *bot*. |
| theme | tema | The four names are byte-identical in `settings:themes` and `welcome:themeChooser.names`: Clássico, Pixel, Techno, Minimalista. |
| guide | guia | One word for the sidebar item, the guide view and every link into it. |
| release | lançamento | Never *versão*, which is the number, and never *entrada*. |
| changelog | changelog | Kept as the loanword. *histórico*, *novidades*, *notas de versão* and *atualizações* are all on the lexicon's own list of what this must not be. |
| dismiss | remover / dispensar | **Two words, because English writes one for two consequences.** `account:notificationsDismiss` deletes, so it is “Remover”; `system:restarted.dismiss` only closes a banner, so it is “Dispensar”. Checked at both call sites before deciding. |
