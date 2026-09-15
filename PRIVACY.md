# Privacy and permissions

CubeLab Linker has no telemetry, advertising, analytics, account system, or background network requests.

- HTTP/HTTPS content-script access lets it inspect page text locally and insert links. Chrome displays a broad site-access warning because it runs on ordinary websites.
- `storage` stores enabled/disabled status, hostname-specific size/dialect preferences, destination templates and colour-scheme settings locally in Chrome. It does not use Chrome Sync.
- `contextMenus` provides “Open selection in CubeLab”.
- `activeTab` lets the popup identify the current site following your toolbar interaction.
- The background worker only opens a destination tab when you invoke the selection action.

Editable fields and existing hyperlinks are excluded from automatic scanning. Page content is not retained in extension storage. Selected text is processed only when you invoke the context menu.

When you click a link, its algorithm/state is included in the destination URL fragment. A fragment is not part of the HTTP request sent to the server, but the destination page's scripts can read it, and it can appear in browser history. Custom destination templates may put data in the query/path instead; those portions are sent to that destination server. The destination controls its own processing.

Disable the extension globally or for individual hostnames in the popup. Removing the extension removes its locally stored settings according to Chrome's normal behavior.
