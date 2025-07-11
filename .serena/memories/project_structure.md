# Project Structure and Architecture

## Current Directory Structure
```
property2habit/
├── .serena/                 # Serena configuration
├── src/                     # Source directory (currently empty)
├── .editorconfig           # Editor configuration
├── .eslintignore           # ESLint ignore patterns
├── .eslintrc               # ESLint configuration
├── .gitignore              # Git ignore patterns  
├── .npmrc                  # NPM configuration
├── esbuild.config.mjs      # Build configuration
├── LICENSE                 # MIT license
├── manifest.json           # Obsidian plugin manifest
├── package-lock.json       # NPM lock file
├── package.json            # NPM package configuration
├── README.md               # Project documentation
├── styles.css              # Plugin styles (empty)
├── tsconfig.json           # TypeScript configuration
├── version-bump.mjs        # Version management script
└── versions.json           # Plugin version history
```

## Expected Source Structure (to be created)
```
src/
├── main.ts                 # Main plugin class
├── settings.ts             # Plugin settings interface
├── components/             # UI components
├── utils/                  # Utility functions
└── types/                  # TypeScript type definitions
```

## Key Configuration Files

### manifest.json
- Plugin metadata for Obsidian
- Contains ID, name, version, description
- Specifies minimum Obsidian version

### esbuild.config.mjs
- Entry point: main.ts
- Output: main.js (bundled)
- External dependencies: obsidian, electron, codemirror
- Development: watch mode, source maps
- Production: minified output

### tsconfig.json
- Base URL points to src/
- Strict TypeScript configuration
- ES6 target with ESNext modules

## Build Output
- `main.js` - Bundled plugin code
- Generated from main.ts entry point
- Excluded from git (built for releases)

## Architecture Notes
- Plugin follows Obsidian plugin architecture
- Uses esbuild for fast development builds
- TypeScript for type safety
- Modular structure with separate concerns