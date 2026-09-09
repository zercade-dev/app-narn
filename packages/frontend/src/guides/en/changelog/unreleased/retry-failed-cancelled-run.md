Retry failed now works on a run you cancelled, instead of quietly doing nothing.

- A run that stopped because a provider rejected your API key can be retried once you fix the key, and the failed entries are genuinely sent again.
- Before this, the button reported that a retry had started and nothing happened.
- A retried cancelled run now finishes properly instead of staying stuck in progress and holding up the project's other runs.
