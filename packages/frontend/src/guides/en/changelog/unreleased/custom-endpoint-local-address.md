Custom AI endpoints on the hosted service can no longer point at an address on the server itself.

- On the hosted service, a custom endpoint set to `localhost` or `127.0.0.1` is now refused with a clear message — that address is the service's own machine, never yours.
- Running your own copy is unchanged: a local model such as Ollama or LM Studio on `localhost` keeps working exactly as before.
- A shared instance hosted with a model running alongside it can re-permit that address with a single operator setting.
