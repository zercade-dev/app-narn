Imports now stop with a clear message if your account has a string limit and the file would take you past it.

- The message says how many strings you already have, what the limit is, and how many the import would add, so you know how much to clear out.
- Nothing is written when an import is refused, so there is never a half-finished import to undo.
- Re-importing a file that only updates strings you already have is never refused, even when you are right at the limit.
- The preview refuses too, so it can no longer show you a summary of an import that would then fail.
- Accounts with no limit set, including narn running on your own machine, are unaffected.
