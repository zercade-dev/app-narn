The Strings and Compare tabs stay responsive while a run streams its log.

- Both tables used to redraw five times a second for the whole length of a run, whether or not anything on screen had changed.
- They now redraw only when something they actually show moves: a cell starting or finishing, or that run's own progress count.
- Large projects with many visible languages benefit the most, and nothing about what the tables display has changed.
