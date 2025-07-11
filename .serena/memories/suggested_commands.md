# Suggested Shell Commands

## Package Management Commands
```bash
# Install dependencies
npm install

# Update Obsidian API
npm update
```

## Development Commands
```bash
# Start development mode with watch
npm run dev

# Build for production
npm run build

# Run TypeScript type checking without emit
tsc -noEmit -skipLibCheck
```

## Version Management
```bash
# Bump version and update manifests
npm run version

# Individual version bumps (after updating minAppVersion in manifest.json)
npm version patch
npm version minor  
npm version major
```

## Linting and Code Quality
```bash
# Install ESLint globally (if not already installed)
npm install -g eslint

# Lint main TypeScript file
eslint main.ts

# Lint all TypeScript files in src directory
eslint .\src\

# Note: Use backslashes for Windows paths
```

## File Operations (Windows)
```bash
# List directory contents
dir

# Navigate directories
cd "directory name"

# Find files
dir *.ts /s

# View file contents
type filename.txt

# Copy files
copy source.js destination.js
```

## Git Commands
```bash
# Standard git workflow
git add .
git commit -m "commit message"
git push origin main

# Create and switch to new branch
git checkout -b feature-name
```

## Obsidian Plugin Installation
```bash
# Manual installation: Copy these files to vault\.obsidian\plugins\property2habit\
# - main.js
# - manifest.json  
# - styles.css
```