# ado-inkwell.md

**inkwell.md for Azure DevOps Wiki** — brings the full [inkwell.md](https://github.com/jhofer/vscode-markdown-editor) rich markdown editor experience to Azure DevOps Wiki pages.

## Features

- **Rich text editing** — Bold, italic, headings, lists, tables, code blocks, quotes and more.
- **PlantUML diagrams** — Write PlantUML in fenced code blocks and see live SVG previews rendered via the public plantuml.com server.
- **Block menu** — `/`-triggered block menu for quick insertion of any block type.
- **Image upload** — Drag-and-drop images; they are uploaded as ADO wiki attachments automatically.
- **Auto-save** — Changes are debounced and saved back to the ADO Wiki REST API one second after the last keystroke.
- **Toolbar action** — An *"Edit with inkwell.md"* button is added to every wiki page toolbar so you can open any page directly.

## Architecture

The editor component is **not copied**. Instead, `package.json` references `inkwell-md` via a git dependency:

```json
"inkwell-md": "github:jhofer/vscode-markdown-editor"
```

Webpack compiles the TypeScript source files from the package and bundles them together with the ADO-specific adapters defined in this repository:

| File | Purpose |
|------|---------|
| `src/hub/hub.tsx` | Hub root — SDK init, URL-hash param parsing, wiki/page picker |
| `src/hub/adoEditorHost.tsx` | Wraps the `Editor` from `inkwell-md` with ADO callbacks |
| `src/hub/adoWikiClient.ts` | REST client for reading/writing ADO wiki pages and attachments |
| `src/hub/plantUmlClient.ts` | Browser-side PlantUML renderer via the public plantuml.com server |
| `src/hub/adoTheme.ts` | ADO CSS-variable-based theme for the editor |
| `src/toolbar/index.tsx` | Toolbar menu action — navigates to the hub with the current page |

## Installation

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [tfx-cli](https://github.com/microsoft/tfs-cli): `npm install -g tfx-cli`
- A Personal Access Token with **Marketplace (Publish)** scope.

### Build

```bash
npm install
npm run build
```

The compiled assets are written to `dist/`.

### Package & publish

```bash
npm run package
# Produces ado-inkwell-md-<version>.vsix

tfx extension publish --token <your-PAT>
```

Or upload the `.vsix` directly on [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage).

## Usage

1. Install the extension in your Azure DevOps organisation.
2. Navigate to any ADO Wiki page.
3. Click **"Edit with inkwell.md"** in the page toolbar — you will be taken directly to the rich editor for that page.
4. Alternatively, open the **inkwell.md** hub from the wiki navigation panel and pick a wiki/page manually.
5. Edits are auto-saved one second after you stop typing. The save indicator in the toolbar confirms the status.

## PlantUML

Write PlantUML inside a fenced code block tagged with `plantuml`:

````markdown
```plantuml
Alice -> Bob: hello
Bob -> Alice: hi
```
````

The diagram is rendered live using <https://www.plantuml.com/plantuml>. No local Java installation is required.

## Development

```bash
npm run watch    # rebuild on change
```

Then publish your own dev version of the extension to a private marketplace listing to test it in a real ADO environment.

## License

ISC
