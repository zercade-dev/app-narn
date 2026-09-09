Provider API keys are now consistently kept in the credential vault, for every provider.

- Saving a key into a provider's settings is refused, the same way it already was for DeepL.
- Eight providers previously accepted a key there, and used it in preference to the one in your vault.
- Keys already stored that way are hidden from the settings screens and stripped from exports.
