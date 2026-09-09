Building the review order for a very large project no longer freezes the server for everyone using it.

- The similarity pre-sort now caps how much of its index it searches per step, not just how many neighbours it keeps.
- On a large project where one word appears in almost every string, that search could previously run for minutes while the server answered nothing at all.
- The resulting order can differ slightly on projects of that size, since fewer candidates are compared. Ordinary projects are unaffected.
