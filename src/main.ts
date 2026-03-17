import { Plugin, WorkspaceLeaf, Notice, TFile, moment, debounce, Platform } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings, VIEW_TYPE_HABIT_TRACKER, HabitConfig } from "./types";
import { HabitSidebarView } from "./sidebar-view";
import { HabitSettingsTab } from "./settings-tab";
import { HabitDataProcessor } from "./data-processor";
import { generateDailyNotePath, processPropertyValue } from "./utils";
import { goToPreviousDailyNote, goToNextDailyNote } from "./navigation-commands";

export default class HabitTrackerPlugin extends Plugin {
    settings: PluginSettings;
    dataProcessor: HabitDataProcessor;
    debouncedRefresh: () => void;
    debouncedUpdateStatusBar: () => void;
    statusBarItem: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        // Initialize data processor
        this.dataProcessor = new HabitDataProcessor(this.app, this.settings);

        // Create debounced refresh function
        this.debouncedRefresh = debounce(() => this.refreshView(), this.settings.refreshInterval);

        // Create debounced status bar update (with longer delay to ensure cache is updated)
        this.debouncedUpdateStatusBar = debounce(() => this.updateStatusBar(), 500);

        // Register sidebar view
        this.registerView(VIEW_TYPE_HABIT_TRACKER, (leaf) => new HabitSidebarView(leaf, this));

        // Add ribbon icon
        /** this.addRibbonIcon("calendar-check", "Habit Tracker", () => {
			this.activateView();
		}); */

        this.addRibbonIcon("arrow-left", "Go to previous daily note", (evt: MouseEvent) => {
            if (evt.button === 2) {
                evt.preventDefault();
                goToNextDailyNote(this.app, this.settings);
                return;
            } else if (evt.button === 1) {
                evt.preventDefault();
                this.app.workspace.openPopoutLeaf;
                goToPreviousDailyNote(this.app, this.settings, true);
            } else {
                goToPreviousDailyNote(this.app, this.settings);
            }
        });

        // Register settings tab
        this.addSettingTab(new HabitSettingsTab(this.app, this));

        // Initialize status bar (not available on mobile)
        if (!Platform.isMobile) {
            this.initStatusBar();
        }

        // Register file modification events for real-time updates
        this.registerEvent(
            this.app.vault.on("modify", (file) => {
                if (file instanceof TFile && this.dataProcessor.isRelevantDailyNote(file)) {
                    this.debouncedRefresh();
                    this.debouncedUpdateStatusBar();
                }
            })
        );

        // Auto-activate view on startup if not already visible
        this.app.workspace.onLayoutReady(() => {
            this.debouncedUpdateStatusBar();
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HABIT_TRACKER);
            if (leaves.length === 0) {
                this.activateView();
            }
        });

        this.addCommand({
            id: "go-to-previous-daily-note",
            name: "Go to previous daily note",
            callback: () => goToPreviousDailyNote(this.app, this.settings),
        });

        this.addCommand({
            id: "go-to-next-daily-note",
            name: "Go to next daily note",
            callback: () => goToNextDailyNote(this.app, this.settings),
        });
    }

    onunload() {
        // Cleanup
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);

        // Update data processor with new settings
        this.dataProcessor = new HabitDataProcessor(this.app, this.settings);

        // Update debounced refresh interval
        this.debouncedRefresh = debounce(() => this.refreshView(), this.settings.refreshInterval);
        this.debouncedUpdateStatusBar = debounce(() => this.updateStatusBar(), 500);
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_HABIT_TRACKER);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({
                type: VIEW_TYPE_HABIT_TRACKER,
                active: true,
            });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async refreshView() {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_HABIT_TRACKER);

        for (const leaf of leaves) {
            const view = leaf.view as HabitSidebarView;
            if (view && view.refresh) {
                await view.refresh();
            }
        }
    }

    // Helper method to show notices from utility functions
    showNotice(message: string) {
        new Notice(message);
    }

    // Also exclude 0
    checkNaN(num: number) {
        if (num === 0) return true;
        if (isNaN(num)) {
            new Notice(`Value is not a number!`);
            return true;
        } else {
            return false;
        }
    }

    initStatusBar() {
        this.statusBarItem = this.addStatusBarItem();
        this.statusBarItem.addClass("habit-tracker-status-bar");
        this.statusBarItem.onclick = () => this.handleStatusBarClick();

        // Initial update - respect the setting
        if (this.settings.showStatusBar) {
            // this.updateStatusBar();
            // this.debouncedUpdateStatusBar();
        } else {
            this.statusBarItem.hide();
        }
    }

    toggleStatusBar(enabled: boolean) {
        if (this.statusBarItem) {
            if (enabled) {
                this.statusBarItem.show();
                this.updateStatusBar();
            } else {
                this.statusBarItem.hide();
            }
        }
    }

    async handleStatusBarClick() {
        // Ensure today's note exists, then open sidebar
        await this.ensureTodaysNote();
        await this.activateView();
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
                    templateContent = templateContent.replace(`<%tp.date.now("YYYY-MM-DD") %>`, today.format("YYYY-MM-DD"));
                    templateContent += `\nCreated on: ${moment().format("YYYY-MM-DD")} with Property Habits Plugin\n`;
                }
            }
            await this.app.vault.create(expectedPath, templateContent);
        }
    }

    async updateStatusBar() {
        if (Platform.isMobile || !this.statusBarItem || !this.settings.showStatusBar) return;

        // Get active habits with targets
        const habitsWithTargets = this.settings.trackedHabits.filter((h) => !h.ignored && h.target !== undefined);

        if (habitsWithTargets.length === 0) {
            this.statusBarItem.empty();
            return;
        }

        // Get today's date and check habits
        const today = moment();
        const expectedPath = generateDailyNotePath(today.toDate(), this.settings);
        const file = this.app.vault.getFileByPath(expectedPath);

        this.statusBarItem.empty();

        for (const habit of habitsWithTargets) {
            const box = this.statusBarItem.createEl("span", {
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
