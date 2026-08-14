# Pseudo Test

## Panoramica

**Pseudo Test** non è una lingua vera. È una lingua di controllo qualità
gratuita e offline che riscrive il tuo testo di origine in una versione
deliberatamente alterata, così puoi caricarla nel tuo gioco e vedere quali
stringhe rompono l'interfaccia — prima ancora che esista una sola
traduzione vera.

Non costa nulla, non richiede alcuna chiave API e non invia mai nulla a un
provider.

## Cosa produce

`Save changes` diventa qualcosa come `⟦Şàvé çhàñgéş~~~~⟧`. Accadono tre
cose contemporaneamente, e ciascuna espone una diversa classe di bug:

- **Lettere accentate.** Ogni lettera viene sostituita con una simile ma
  accentata. Qualsiasi testo che continua a comparire come inglese semplice
  nel tuo gioco non è mai stato inserito nella tabella delle stringhe — è
  scritto nel codice, e nessun traduttore potrà mai raggiungerlo.
- **Riempimento.** Il testo viene allungato con caratteri `~` fino a circa
  1,4× la sua lunghezza originale, simulando lingue come il tedesco che
  tendono ad essere più lunghe. Le etichette che vanno in overflow rispetto
  ai loro pulsanti, vanno a capo male o spostano il layout emergono subito.
- **Parentesi.** Il risultato viene racchiuso tra `⟦…⟧`. Se sullo schermo
  manca una delle due parentesi, quella stringa viene troncata.

I segnaposto e i tag di formattazione nel tuo testo passano invariati,
quindi se uno di loro esce alterato, è un bug da segnalare e non un
problema di layout.

## Usarlo

1. Nella scheda **Dati**, spunta **Pseudo Test** in *Lingue di
   destinazione* e salva.
2. Esegui una traduzione come al solito. Le voci in Pseudo Test sono sempre
   gestite dal generatore pseudo incorporato — non c'è nulla da attivare,
   nessuna regola di routing da scrivere e nessun costo. I tuoi provider a
   pagamento non vedono mai queste stringhe.
3. Le tue traduzioni vere sono al sicuro: il testo di Pseudo Test è
   conservato nella propria colonna e non può mai sovrascrivere un'altra
   lingua.

## Portarlo nel tuo gioco

Nella scheda di esportazione, imposta **Esporta il testo pseudo come** su
una lingua che al momento non stai distribuendo — il tedesco, per esempio —
poi scarica il file e caricalo nel gioco con quella lingua selezionata. La
colonna della lingua scelta viene compilata con il testo di Pseudo Test
solo per quel singolo download; nulla di salvato cambia, e le traduzioni
vere sono ancora lì alla prossima esportazione.

Quando hai finito di testare, esporta di nuovo con la sostituzione
riportata su **Nessuna sostituzione**. Un'esportazione normale non contiene
mai una colonna Pseudo Test — il testo pseudo raggiunge il tuo gioco solo
tramite la sostituzione descritta sopra — quindi lasciare Pseudo Test
attivo non ha alcun effetto sui file che distribuisci.

## Quando usarlo

Esegui un passaggio pseudo presto, prima di commissionare qualsiasi
traduzione. Ogni bug di layout che trova è un bug che correggi una volta
sola, invece che quindici volte dopo l'arrivo di quindici lingue.
