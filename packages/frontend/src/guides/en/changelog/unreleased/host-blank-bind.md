Setting HOST to an empty value no longer starts the server on every network interface by mistake.

- A blank or whitespace-only `HOST` now means the all-interfaces address it really binds, not the loopback-only default.
- A hosted instance refuses to start on that setting unless it has been configured deliberately.
- A `HOST` written with stray spaces around it is trimmed, instead of failing to start at all.
