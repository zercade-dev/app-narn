AI review runs are now more resilient to provider rate limits and stalls.

- AI review no longer sizes batches too large for reasoning models to answer in one request.
- Review runs recover faster after hitting a provider rate limit.
- A review that somehow still stalls now fails cleanly with partial results instead of hanging indefinitely.
