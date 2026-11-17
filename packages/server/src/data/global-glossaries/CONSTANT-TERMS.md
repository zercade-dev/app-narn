# Which bundled terms are constant, and why

A **constant** term is masked before translation wherever the source spells it
exactly as the glossary does (letter case included) and replaced afterwards
with its glossary translation, verbatim. The engine never sees it. Any other
spelling is sent to the engine as an ordinary glossary hint marked as a name.

That buys an exact, official form. It costs grammar: the engine cannot decline
the term or make other words agree with it (Russian cases, Korean particles,
Turkish suffixes, gender agreement), so the base form is pasted in.

A term is made constant only when all of these hold:

1. **It is a fixed name** (a person, place or product), not a description or a
   phrase the game itself declines.
2. **It is not an everyday English word.** Matching is case-sensitive, but
   titles and labels capitalise ordinary words ("Gaming Settings", "A Traveler's
   Guide"), and those would be masked too.
3. **Its translations are bare names.** No notes such as "(м)" or "（男）", and
   no long form that would be wrong inside another name.
4. **It does not sit inside other terms in a form that changes there.** A
   constant term is masked inside longer phrases too.

The community sheet has no constant column, so the flag lives only in these
JSON files. `app/scripts/sync-global-glossaries.ts` keeps every existing flag
and makes new terms of Characters and Nations constant by default, except the
everyday words listed below. The legacy `tests/tooling/csv-to-glossaries.ts`
keeps the flags too.

## Reviewed term by term (2026-11-15)

### Genshin Characters: 121 of 128 constant

Every name is constant except these 7, which are also everyday English words:
**Gaming, Amber, Razor, Sucrose, Prune, Traveler, Wanderer.**

Kept constant, with the risk noted:

- *Aether, Albedo, Dahlia, Venti*: also words (archaic "aether", the physics
  term, the flower, the coffee size), but rare in game text, and lowercase uses
  are not masked.
- *Barbara, Charlotte, Jean, Lisa, Mona, Nicole* and other ordinary first
  names: masked if the text names someone else with that name.
- Russian declines many of these names ("меч Дилюка"); a constant one stays
  in the base form ("меч Дилюк").

### Genshin Nations: 10 of 10 constant

Fontaine, Inazuma, Khaenri'ah, Liyue, Mondstadt, Natlan, Nod-Krai,
Snezhnaya, Sumeru, Teyvat: fixed place names, none an English word. Same
Russian trade-off as characters ("в Мондштадте" becomes "в Мондштадт").

### Miliastra Terms: 3 of 9 constant

- Constant: **Genshin Impact, Miliastra Sandbox, Miliastra Wonderland**
  (product names).
- Not constant:
  - *Craftsperson, Stage, Wonderland*: everyday words.
  - *Manekin, Manekina*: translations carry notes ("Манекен (м)",
    "Manekin (L)", "ドール（男）").
  - *Wonderland Manekin*: a noun phrase used in the plural (Turkish
    "Diyar Manekinleri").

### Genshin Elements: 0 of 7

Anemo, Cryo, Dendro, Electro, Geo, Hydro, Pyro appear inside creature and
stat names, where several languages use a short form ("Pháp Sư Vực Sâu Băng",
"火深渊法师") while the standalone translation is long ("Nguyên Tố Băng",
"火元素"). A constant element would paste the long form into those names.

### Not constant: phrases and everyday words

- **Creations (54) and Creation factions (16)**: descriptive names the game
  itself declines ("Крио маг Бездны", "Mitachurl mit Feueraxt"), used with
  articles and plurals.
- **Stats (31)**: ATK, CRIT Rate and the rest take case endings in sentences
  ("increases ATK" needs the Russian accusative).
- **Reactions (29), Ranks (7), Skills (5)**: everyday words (Bloom, Melt,
  Frozen, Legend, Novice, Skill).
- **Common Phrases (20), Default UI Labels (16)**: UI phrases, not names.
