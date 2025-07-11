# Code Style and Conventions

## Editor Configuration (.editorconfig)
- **Charset**: UTF-8
- **Line Endings**: LF
- **Insert Final Newline**: true
- **Indent Style**: Tabs
- **Indent Size**: 4 spaces
- **Tab Width**: 4

## ESLint Configuration
- **Parser**: @typescript-eslint/parser
- **Environment**: Node.js
- **Extends**: 
  - eslint:recommended
  - @typescript-eslint/eslint-recommended
  - @typescript-eslint/recommended

## Custom ESLint Rules
- `no-unused-vars`: off (handled by TypeScript)
- `@typescript-eslint/no-unused-vars`: error (args: none)
- `@typescript-eslint/ban-ts-comment`: off
- `no-prototype-builtins`: off
- `@typescript-eslint/no-empty-function`: off

## File Structure Conventions
- Source files should be in `src/` directory (currently empty)
- Main entry point: `main.ts` in root
- TypeScript files use `.ts` extension
- Configuration files in root directory

## TypeScript Style
- Use strict null checks
- No implicit any
- Prefer modern ES6+ features
- Use type annotations where beneficial