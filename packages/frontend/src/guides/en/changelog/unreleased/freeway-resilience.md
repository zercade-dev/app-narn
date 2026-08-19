Freeway free-tier translation recovers better from provider outages, restarts, and quota edge cases.

- Runs parked on free-tier quota now resume automatically after a server restart, once the credential vault is unlocked.
- Providers that keep failing back off progressively instead of retrying every 15 minutes forever.
- Google per-minute rate limits are no longer mistaken for daily quotas, so brief waits stay brief.
- Harder texts served by a relaxed quality tier are now always visible in the run's activity detail.
- Entries with empty source text no longer re-enter every run's totals.
