NARN Freeway now recovers from dead models and provider outages instead of failing entries.
- A batch that fails wholesale on a retired or unavailable model is retried on another free provider automatically, and the dead model is sidelined until its quota day resets.
- Providers whose daily quota is exhausted are set aside until the quota returns, instead of being retried every minute.
- A translation that hits a temporary provider hiccup ("high demand", timeouts) is retried once before ever being marked failed.
- Freeway spends fewer free-tier requests on failing providers — one attempt per call instead of three.
- A demanding entry that would otherwise wait a long time for its preferred quality tier is translated on the next tier down instead, so it never stalls for the rest of the day.
