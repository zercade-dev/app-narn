Freeway runs now pause less and finish faster, because fewer translations have to wait for the scarcest top-tier model.

- Short, everyday strings are no longer treated as the hardest text just because the target language has a length limit, so they use the plentiful models.
- Genuinely hard text, such as long or tag-heavy strings in languages like Japanese, Korean, Thai and Chinese, still goes to the strongest models.
- Another fast model now handles the hardest text, so top-tier work no longer queues behind a single model.
