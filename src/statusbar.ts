import HabitTrackerPlugin from "main";
import { App, Platform, TFile, moment } from "obsidian";
import { HabitConfig, PluginSettings } from "types";
import { generateDailyNotePath, processPropertyValue } from "utils";

export class StatusBar {
    app: App;
    plugin: HabitTrackerPlugin;
    settings: PluginSettings;

    constructor(app: App, plugin: HabitTrackerPlugin, settings: PluginSettings) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
    }

    initStatusBar() {
        this.plugin.statusBarItem = this.plugin.addStatusBarItem();
        this.plugin.statusBarItem.addClass("habit-tracker-status-bar");
        this.plugin.statusBarItem.onclick = () => this.handleStatusBarClick();

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

    async handleStatusBarClick() {
        // Ensure today's note exists, then open sidebar
        await this.ensureTodaysNote();
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
        const expectedPath = generateDailyNotePath(today.toDate(), this.settings);
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
                box.setAttribute("title", `${habit.displayName}: No daily note`);
            } else {
                box.addClass(isDone ? "habit-done" : "habit-undone");
                box.setAttribute("title", `${habit.displayName}: ${isDone ? "Done" : "Not done"}`);
            }
        }
    }

    async ensureTodaysNote() {
        const today = moment();
        const expectedPath = generateDailyNotePath(today.toDate(), this.settings);

        const existingFile = this.app.vault.getFileByPath(expectedPath);
        if (!existingFile) {
            // Create the daily note using the template
            let templateContent = "---\n\n---\n\n";
            if (this.settings.dailyNoteTemplate) {
                const templateFile = this.app.vault.getAbstractFileByPath(this.settings.dailyNoteTemplate);
                if (templateFile && templateFile instanceof TFile) {
                    templateContent = await this.app.vault.read(templateFile);
                    // templateContent = templateContent.replace(`<%tp.date.now("YYYY-MM-DD") %>`, today.format("YYYY-MM-DD"));
                    templateContent += `\nCreated on: ${moment().format("YYYY-MM-DD")} with Property Habits Plugin\n`;
                }
            }
            await this.app.vault.create(expectedPath, templateContent);
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
