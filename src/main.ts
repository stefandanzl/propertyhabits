import { Plugin, WorkspaceLeaf, Notice, TFile } from "obsidian";
import {
	DEFAULT_SETTINGS,
	PluginSettings,
	VIEW_TYPE_HABIT_TRACKER,
} from "./types";
import { HabitSidebarView } from "./sidebar-view";
import { HabitSettingsTab } from "./settings-tab";
import { HabitDataProcessor } from "./data-processor";
import { debounce } from "./utils";

export default class HabitTrackerPlugin extends Plugin {
	settings: PluginSettings;
	dataProcessor: HabitDataProcessor;
	debouncedRefresh: () => void;

	async onload() {
		await this.loadSettings();

		// Initialize data processor
		this.dataProcessor = new HabitDataProcessor(this.app, this.settings);

		// Create debounced refresh function
		this.debouncedRefresh = debounce(
			() => this.refreshView(),
			this.settings.refreshInterval
		);

		// Register sidebar view
		this.registerView(
			VIEW_TYPE_HABIT_TRACKER,
			(leaf) => new HabitSidebarView(leaf, this)
		);

		// Add ribbon icon
		/** this.addRibbonIcon("calendar-check", "Habit Tracker", () => {
			this.activateView();
		}); */

		// Register settings tab
		this.addSettingTab(new HabitSettingsTab(this.app, this));

		// Register file modification events for real-time updates
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (
					file instanceof TFile &&
					this.dataProcessor.isRelevantDailyNote(file)
				) {
					this.debouncedRefresh();
				}
			})
		);

		// Auto-activate view on startup if not already visible
		this.app.workspace.onLayoutReady(() => {
			const leaves = this.app.workspace.getLeavesOfType(
				VIEW_TYPE_HABIT_TRACKER
			);
			if (leaves.length === 0) {
				this.activateView();
			}
		});
	}

	onunload() {
		// Cleanup
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);

		// Update data processor with new settings
		this.dataProcessor = new HabitDataProcessor(this.app, this.settings);

		// Update debounced refresh interval
		this.debouncedRefresh = debounce(
			() => this.refreshView(),
			this.settings.refreshInterval
		);
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
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_HABIT_TRACKER
		);

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
}
