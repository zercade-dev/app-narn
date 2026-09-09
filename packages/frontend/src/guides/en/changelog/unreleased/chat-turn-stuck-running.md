An AI-assistant turn that fails immediately is now recorded as failed instead of sitting in Activity as "running" forever.

- Turns that failed before they got going — an assistant pointed at a deleted connection, or a missing provider key — could leave the chat session stuck as running, sometimes without the error that caused it.
- A stuck row also counted towards the limit on how many runs you can have going at once, so unrelated translations could start being turned away.
- Both the Text Styler and the stage-details assistant are covered, and a turn that fails this way is no longer counted twice in the session's turn total.
