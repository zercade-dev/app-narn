Server log lines now hide a provider key that the provider's own error text echoed back.

- The log panel and the server console already masked any stored key that turned up in a log entry's details, but not one that turned up in the line's own wording.
- A failed model-list request to a provider that quotes the rejected key back in its reply could put that key straight into the line, where it stayed readable.
- The wording of every log line is now checked the same way its details already were, so the key is masked wherever it appears.
