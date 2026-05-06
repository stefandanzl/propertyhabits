# Property Habits

An Obsidian plugin for tracking habits stored as frontmatter properties in your daily notes.

## What it's for

If you use daily notes and record things like workouts, mood, water intake, or any other routine data as YAML frontmatter properties, this plugin gives you a visual overview of that data over time — without any extra logging step.

It reads directly from your existing notes, so there's nothing new to fill in. You write your daily note as usual, and the sidebar shows you how you've been doing.

## Habit types

- **Checkbox** — tracks yes/no properties (e.g. `exercise: true`)
- **Number** — tracks numeric values against a daily or cumulative target (e.g. `water: 8`)
- **Multitext** — tracks list properties and shows frequency of each value over time (e.g. `mood: [focused, tired]`)

## Features

- Sidebar view with a compact timeline of the last N days
- Configurable time spans (7 days, 30 days, etc.)
- Per-habit targets with success/failure coloring
- Streak tracking
- Status bar indicators for quick glance without opening the sidebar
- Battery-style display option for number habits

## Setup

1. Install the plugin
2. Go to Settings → Property Habits
3. Add the frontmatter property names you want to track
4. Make sure your daily notes are in a consistent folder with a consistent date format (configured in plugin settings)
