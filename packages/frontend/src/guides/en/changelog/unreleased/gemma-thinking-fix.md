Translations routed to Google's Gemma models no longer fail and fall back to another model.

- Gemma requests now leave out a thinking setting these models don't support, so they run the first time.
- Gemma models no longer show a reasoning effort choice that they can't use.
- Translation error logs now name the model involved.
