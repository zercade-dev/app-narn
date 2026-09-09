Each AI provider connection now keeps its own request pacing and parallel-request limit.

- A connection set to run one request at a time now really does, even while another connection to the same provider is busy.
- Two named connections to one provider no longer take turns in a single queue, so one can't hold up the other.
- Your requests-per-second setting now paces only your own translations.
