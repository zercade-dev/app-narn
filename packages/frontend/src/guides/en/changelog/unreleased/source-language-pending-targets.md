Changing a project's source language now keeps the target-language ticks you had not saved yet.

- Previously the change quietly ignored those unsaved ticks, then left them staged, so pressing Save afterwards could add the new source language back to the target list — a combination the project should never be in.
- The source-language change now saves your staged target list along with it, minus the language you just promoted to source, and the unsaved-changes prompt clears once it is stored.
