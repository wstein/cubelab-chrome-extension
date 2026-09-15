# Project notes

## Quality checks

Run `npm run format`, `npm run lint`, and `npm test` before each commit.
Use `npm run format:check` to verify formatting without modifying files.
Development tools are local dependencies and are not loaded by the extension.

The starting test baseline is 34 passing tests: 27 detector tests and seven DOM
integration tests. There was no configured coverage threshold. Keep these cases
and add regression tests alongside behavior changes.

## Review implementation

Changes are grouped into separately verified, conventional commits:

1. Quality tooling and consistent formatting.
2. Settings updates that preserve concurrent changes.
3. Repeated move groups and permutation disambiguation.
4. Incremental scanning, stable DOM nodes, and inline visibility.
5. Browser smoke tests and updated validation documentation.

### Quality tooling

Prettier formats source, tests, configuration, and documentation. ESLint checks
JavaScript with its recommended rules. Formatting is kept separate from behavior
changes so later commits can be reviewed on their own.

The Node engine range matches jsdom's supported versions: 22.22.2+, 24.15.0+,
or 26+. This corrects the previous overly broad `>=22` requirement.
