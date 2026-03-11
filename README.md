# Appello SDLC

Software Development Lifecycle hub for Appello — work packages, pipeline, roadmap, and releases — hosted via GitHub Pages.

## Usage

### Adding a new document

1. Place your canvas HTML file in the `docs/` folder
2. Add a card entry to `index.html` inside the `doc-grid` div (and hide the empty state)
3. Commit and push — GitHub Pages deploys automatically

### Structure

```
appello-sdlc/
├── index.html          # Landing page listing all work packages
├── pipeline.html       # Kanban pipeline board
├── roadmap.html        # Gantt-style roadmap
├── releases.html       # Release milestone management
├── docs/               # Individual work package HTML files
│   └── example.html
└── README.md
```

### URL format

Once deployed, documents are accessible at:

```
https://useanzen.github.io/appello-sdlc/              → Index
https://useanzen.github.io/appello-sdlc/docs/xyz.html → Individual document
```

### Custom domain (optional)

To use a custom domain like `sdlc.useappello.com`:

1. Add a `CNAME` file to the repo root with the domain name
2. Configure a CNAME DNS record pointing to `useanzen.github.io`
3. Enable "Enforce HTTPS" in the repo's GitHub Pages settings
