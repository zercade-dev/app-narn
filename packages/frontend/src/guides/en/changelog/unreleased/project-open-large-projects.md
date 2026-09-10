Opening a large project is lighter on the server, and quicker over a slow connection.

- The full string list is now sent as it is read, rather than being assembled in one piece first — so a big project no longer makes everyone else's requests wait while it is put together.
- On the hosted service that list is now compressed on the way to you, which cuts what a project with many languages costs to download, and stops a slow link timing out part-way through.
- Nothing about the list itself changes: the same entries arrive in the same order, and orphaned entries are still left out.
