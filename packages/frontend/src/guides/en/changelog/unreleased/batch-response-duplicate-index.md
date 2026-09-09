A batch of translations that comes back with confused numbering is now rejected instead of being saved against the wrong entries.

- Some AI models answer a batch by numbering each translation; when two of them carried the same number, the first translation was quietly saved onto the second entry as well.
- Those batches are now reported as failed, so the entries stay in Activity for a retry instead of gaining a translation that belongs to a different string.
- Replies that number their translations sensibly — in any order, and whether they start at zero or one — keep working exactly as before.
