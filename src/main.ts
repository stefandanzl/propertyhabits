import { Plugin, WorkspaceLeaf, Notice, TFile, moment, debounce, Platform } from "obsidian";
import { DEFAULT_SETTINGS, PluginSettings, VIEW_TYPE_HABIT_TRACKER, HabitConfig } from "./types";
import { HabitSidebarView } from "./sidebar-view";
import { HabitSettingsTab } from "./settings-tab";
import { HabitDataProcessor } from "./data-processor";
import { DailyNotes } from "dailynotes";
import { StatusBar } from "statusbar";

export default class HabitTrackerPlugin extends Plugin {
    settings: PluginSettings;
    dataProcessor: HabitDataProcessor;
    dailyNotes: DailyNotes;
    statusBar: StatusBar;
    debouncedRefresh: () => void;
    debouncedUpdateStatusBar: () => void;
    statusBarItem: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        // Initialize data processor
        this.dataProcessor = new HabitDataProcessor(this.app, this.settings);
        this.dailyNotes = new DailyNotes(this.app, this, this.settings);
        this.statusBar = new StatusBar(this.app, this, this.settings);

        // Create debounced refresh function
        this.debouncedRefresh = debounce(() => this.refreshView(), this.settings.refreshInterval);

        // Create debounced status bar update (with longer delay to ensure cache is updated)
        this.debouncedUpdateStatusBar = debounce(() => this.statusBar.updateStatusBar(), 500);

        // Register sidebar view
        this.registerView(VIEW_TYPE_HABIT_TRACKER, (leaf) => new HabitSidebarView(leaf, this));

        // Add ribbon icon
        /** this.addRibbonIcon("calendar-check", "Habit Tracker", () => {
			this.activateView();
		}); */

        this.addRibbonIcon("arrow-left", "Go to previous daily note", (evt: MouseEvent) => {
            if (evt.button === 2) {
                evt.preventDefault();
                this.dailyNotes.goToNextDailyNote();
                return;
            } else if (evt.button === 1) {
                evt.preventDefault();
                this.app.workspace.openPopoutLeaf;
                this.dailyNotes.goToPreviousDailyNote(true);
            } else {
                this.dailyNotes.goToPreviousDailyNote();
            }
        });

        // Register settings tab
        this.addSettingTab(new HabitSettingsTab(this.app, this));

        // Initialize status bar (not available on mobile)
        if (!Platform.isMobile) {
            this.statusBar.initStatusBar();
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
            callback: () => this.dailyNotes.goToPreviousDailyNote(),
        });

        this.addCommand({
            id: "go-to-next-daily-note",
            name: "Go to next daily note",
            callback: () => this.dailyNotes.goToNextDailyNote(),
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
        this.debouncedUpdateStatusBar = debounce(() => this.statusBar.updateStatusBar(), 500);
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
}
