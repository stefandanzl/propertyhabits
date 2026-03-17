import HabitTrackerPlugin from "main";
import { App, Notice, Platform, TFile, moment } from "obsidian";
import { HabitConfig, PluginSettings } from "types";
import { generateDailyNotePath, processPropertyValue } from "utils";

interface Commands {
    executeCommandById(id: string): boolean;
}

interface AppWithCommands extends App {
    commands: Commands;
}

export class StatusBar {
    app: AppWithCommands;
    plugin: HabitTrackerPlugin;
    settings: PluginSettings;

    constructor(app: App, plugin: HabitTrackerPlugin, settings: PluginSettings) {
        this.app = app as AppWithCommands;
        this.plugin = plugin;
        this.settings = settings;
    }

    initStatusBar() {
        this.plugin.statusBarItem = this.plugin.addStatusBarItem();
        this.plugin.statusBarItem.addClass("habit-tracker-status-bar");
        this.plugin.statusBarItem.onclick = (event: MouseEvent) => this.handleStatusBarClick(event);
        this.plugin.statusBarItem.ondblclick = (event: MouseEvent) => this.handleStatusBarClick(event, true);

        // Initial update - respect the setting
        if (this.settings.showStatusBar) {
            // this.updateStatusBar();
            // this.debouncedUpdateStatusBar();
        } else {
            this.plugin.statusBarItem.hide();
        }
    }

    toggleStatusBar(enabled: boolean) {
        if (this.plugin.statusBarItem) {
            if (enabled) {
                this.plugin.statusBarItem.show();
                this.updateStatusBar();
            } else {
                this.plugin.statusBarItem.hide();
            }
        }
    }

    async handleStatusBarClick(event: MouseEvent, doubleClick = false) {
        // Middle click - run custom command if configured
        if (this.settings.customDailyNoteCommand) {
            new Notice("Using custom DailyNote Command!");
            (this.app as AppWithCommands).commands.executeCommandById(this.settings.customDailyNoteCommand);
            return;
        }

        // Left click - default behavior
        // Ensure today's note exists, then open sidebar

        const today = moment();
        const expectedPath = generateDailyNotePath(today, this.settings);

        const existingFile = this.app.vault.getFileByPath(expectedPath);

        if (existingFile) {
            // Open daily note file

            this.plugin.dailyNotes.openDailyNote(expectedPath);
        } else if (doubleClick) {
            // Create new daily note file
            this.plugin.dailyNotes.createDailyNote("", expectedPath);
        }
        await this.plugin.activateView();
    }

    async updateStatusBar() {
        if (Platform.isMobile || !this.plugin.statusBarItem || !this.settings.showStatusBar) return;

        // Get active habits with targets
        const habitsWithTargets = this.settings.trackedHabits.filter((h) => !h.ignored && h.target !== undefined);

        if (habitsWithTargets.length === 0) {
            this.plugin.statusBarItem.empty();
            return;
        }

        // Get today's date and check habits
        const today = moment();
        const expectedPath = generateDailyNotePath(today, this.settings);
        const file = this.app.vault.getFileByPath(expectedPath);

        this.plugin.statusBarItem.empty();

        for (const habit of habitsWithTargets) {
            const box = this.plugin.statusBarItem.createEl("span", {
                cls: "habit-status-box",
            });

            let isDone = false;

            if (file && file instanceof TFile) {
                // File exists, check the actual value
                try {
                    const metadata = this.app.metadataCache.getFileCache(file);
                    const rawValue = metadata?.frontmatter?.[habit.propertyName];
                    const value = processPropertyValue(habit.widget, rawValue);

                    isDone = this.checkHabitDone(habit, value);
                } catch {
                    isDone = false;
                }
            }

            // Three states: done (green), undone (red), missing (purple)
            if (!file) {
                box.addClass("habit-missing");
                box.setAttribute("title", `${habit.displayName}: No daily note - Double click to create it`);
            } else {
                box.addClass(isDone ? "habit-done" : "habit-undone");
                box.setAttribute("title", `${habit.displayName}: ${isDone ? "Done" : "Not done"}`);
            }
        }
    }

    checkHabitDone(habit: HabitConfig, value: boolean | number | null): boolean {
        if (habit.target === undefined) return false;

        switch (habit.widget) {
            case "checkbox":
                const targetIsChecked = habit.target === 1;
                return value === targetIsChecked;

            case "number":
                const numValue = typeof value === "number" ? value : 0;
                return numValue >= habit.target;

            case "multitext":
                const countValue = typeof value === "number" ? value : 0;
                return countValue >= habit.target;

            default:
                return false;
        }
    }
}
