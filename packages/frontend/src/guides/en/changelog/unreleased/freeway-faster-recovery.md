Freeway runs now pick work back up much sooner after a provider hits its limits, instead of waiting for the whole run to finish.

- Strings that were waiting on free quota restart as soon as their own wait is over, even while the rest of the run is still going.
- The "resumes at" time shown for a waiting run is always the next real restart time, never one that has already passed.
- Short per-minute limits now wait only as long as the provider asks, so work resumes in seconds rather than a full minute or more.
- Requests to small-allowance models are spread across the minute instead of being sent all at once.
- Work moved to another model now waits its turn there and is split to that model's batch size.
- The activity log shows one summary line per batch for strings that came out longer than allowed, instead of one line per string.
