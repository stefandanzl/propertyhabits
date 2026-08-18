import HabitTrackerPlugin from "main";
import { App, Notice, Platform, TFile, moment } from "obsidian";
import { HabitSettingsTab } from "settings-tab";
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
        } else {
            // Left click - default behavior
            // Ensure today's note exists, then open sidebar

            // Clicking a specific box targets that habit's property;
            // clicking anywhere else on the bar falls back to the default (no property)
            const box = (event.target as HTMLElement).closest(".habit-status-box");
            const propertyName = box?.getAttribute("data-property-name") ?? "";

            const today = window.moment();
            const expectedPath = generateDailyNotePath(today, this.settings);

            const existingFile = this.app.vault.getFileByPath(expectedPath);

            if (existingFile) {
                // Open daily note file

                this.plugin.dailyNotes.openDailyNote(expectedPath, propertyName);
            } else if (doubleClick) {
                // Create new daily note file
                this.plugin.dailyNotes.createDailyNote("", expectedPath, propertyName);
            }
        }
        this.plugin.activateView();
    }

    async updateStatusBar() {
        if (Platform.isMobile || !this.plugin.statusBarItem || !this.settings.showStatusBar) return;

        // Get active habits with targets and showInStatusBar enabled
        const habitsWithTargets = this.settings.trackedHabits.filter((h) => !h.ignored && h.target !== undefined && h.showInStatusBar);

        if (habitsWithTargets.length === 0) {
            this.plugin.statusBarItem.empty();
            return;
        }

        // Get today's date and check habits
        const today = window.moment();
        const expectedPath = generateDailyNotePath(today, this.settings);
        const file = this.app.vault.getFileByPath(expectedPath);

        this.plugin.statusBarItem.empty();

        for (const habit of habitsWithTargets) {
            const box = this.plugin.statusBarItem.createEl("span", {
                cls: "habit-status-box",
            });
            box.dataset.propertyName = habit.propertyName;

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
                box.ariaLabel = `${habit.displayName}: No daily note - Double click to create it`;
                box.setAttribute("data-tooltip-position", "top");
            } else {
                box.addClass(isDone ? "habit-done" : "habit-undone");
                box.ariaLabel = `${habit.displayName}: ${isDone ? "Done" : "Not done"}`;
                box.setAttribute("data-tooltip-position", "top");
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
