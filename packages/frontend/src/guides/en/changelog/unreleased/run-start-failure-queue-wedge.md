A translation run that fails to get started no longer blocks everything queued behind it.

- If something goes wrong while a run is being set up, the run is now marked failed instead of sitting there as "running" with no work to do.
- Previously the project's queue stalled behind it, and the only way out was to cancel the stuck run or restart the server.
- Retrying a run that was still going when the server last restarted no longer risks it being marked failed while it is running.
