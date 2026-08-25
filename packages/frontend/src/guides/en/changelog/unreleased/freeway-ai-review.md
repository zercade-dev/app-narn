NARN Freeway now reviews translations with the same routing care it brings to translating them.

- Review batches are now sized to the model actually serving them instead of a fixed size, preventing oversized requests on long text.
- Review scores now feed back into how free models are ranked, so NARN Freeway learns which model translates each language well, and it leaves out a model's score for its own translations wherever it can tell.
- When a free model hits its per-minute limit mid-review, NARN Freeway now waits briefly for the limit to reset, or moves the review to another free model, instead of failing the run.
