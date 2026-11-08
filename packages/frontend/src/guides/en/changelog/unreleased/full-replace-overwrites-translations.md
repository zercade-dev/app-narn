A "Full replace" CSV import now updates translations that changed in your file, even where AI or a manual edit wrote them.

- Previously only rows new to the project picked up the file's text, and AI or manually edited translations stayed as they were.
- The replaced text is kept in each translation's version history, and the pre-import snapshot can still roll the whole import back.
- Empty cells in the file never erase a stored translation.
- "Add & update" imports keep AI and manual translations untouched, as before.
