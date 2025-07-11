# Tech Stack and Dependencies

## Core Technologies
- **Language**: TypeScript
- **Runtime**: Node.js (minimum v16)
- **Build System**: esbuild
- **Target**: ES6/ES2018

## Key Dependencies
- **obsidian**: Latest (Obsidian API)
- **typescript**: 4.7.4  
- **esbuild**: 0.17.3
- **tslib**: 2.4.0

## Development Dependencies
- **ESLint**: TypeScript ESLint plugin 5.29.0
- **@types/node**: ^16.11.6
- **builtin-modules**: 3.3.0

## Build Configuration
- **Entry Point**: main.ts (not yet created)
- **Output**: main.js (bundled)
- **Build Tool**: esbuild with custom config
- **Source Maps**: Inline for development, none for production
- **Module Format**: CommonJS
- **External Dependencies**: obsidian, electron, codemirror packages

## TypeScript Configuration
- **Base URL**: src/
- **Target**: ES6
- **Module**: ESNext
- **Module Resolution**: node
- **Strict Null Checks**: Enabled
- **No Implicit Any**: Enabled