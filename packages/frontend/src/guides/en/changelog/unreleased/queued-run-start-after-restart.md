A translation still waiting in the queue when the app restarts now runs properly when you press Start now.

- Starting one that way used to leave it without access to your unlocked vault, so every string failed with a missing-credentials error.
- It now runs under the session you started it from, exactly like any other run.
- Nothing reached an AI provider in that state, so a run caught by this never cost anything — retrying its failed strings was always enough.
