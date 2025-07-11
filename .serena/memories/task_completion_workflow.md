# Task Completion Workflow

## Before Committing Code
1. **Type Check**: Run `npm run build` to ensure TypeScript compiles without errors
2. **Lint**: Run `eslint main.ts` (or relevant files) to check code style
3. **Test Build**: Ensure the plugin builds successfully for production

## Development Workflow
1. **Start Development**: `npm run dev` for watch mode
2. **Make Changes**: Edit TypeScript files
3. **Test in Obsidian**: Reload Obsidian to test changes
4. **Type Check**: Verify no TypeScript errors
5. **Lint**: Check code style compliance

## Release Preparation
1. **Update Version**: Modify `manifest.json` version and `minAppVersion`
2. **Update Versions File**: Add entry to `versions.json`
3. **Build Production**: `npm run build` for minified output
4. **Version Bump**: `npm run version` to sync package.json
5. **Git Commit**: Add and commit all changes
6. **Create Release**: Tag and create GitHub release

## Release Assets
Include these files in GitHub releases:
- `main.js` (bundled plugin code)
- `manifest.json` (plugin metadata)
- `styles.css` (plugin styles)

## Quality Checks
- Ensure no `console.log` statements in production
- Verify all TypeScript errors are resolved
- Test plugin functionality in clean Obsidian vault
- Check plugin loads without errors in Obsidian developer console

## Git Workflow
```bash
git add .
git commit -m "descriptive commit message"
git push origin main
```

## Publishing to Obsidian Community
1. Follow [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
2. Create pull request at [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)