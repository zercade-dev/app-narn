Freeway runs now pause less and finish faster, because fewer translations have to wait for the scarcest top-tier model.

- Short, ordinary strings no longer count as hard just because the target language has a length limit, so they use the plentiful models.
- Only strings that are long enough to risk overrunning the limit are treated as hard text.
- Another fast model now handles the hardest text, so top-tier work no longer queues behind a single model.
