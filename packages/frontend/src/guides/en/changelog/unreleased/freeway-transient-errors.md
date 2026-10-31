NARN Freeway now retries a provider's brief outage after a minute or two instead of waiting 15 minutes.

- When a provider reports it is busy or briefly down, Freeway tries the same model again after a minute or two.
- If the failures continue, it waits longer each time, up to the next daily reset. A long outage costs one more attempt than before.
- Requests that time out still wait 15 minutes, as they did before.
- The Activity tab now says when a run is waiting for a provider, rather than for free quota.
