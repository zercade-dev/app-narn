Restarting or updating the app now lets whatever it was already doing finish, instead of cutting it off the moment the shutdown starts.

- Exports, downloads and other requests that were already under way now complete rather than failing partway through.
- The app used to close its database connection the instant a shutdown began, so anything still in progress failed immediately.
- Live activity and log streams are now closed properly, so a restart finishes on its own instead of having to be forced.
