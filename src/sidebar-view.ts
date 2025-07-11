import { ItemView, WorkspaceLeaf, Notice, moment, TFile } from "obsidian";
import {
	VIEW_TYPE_HABIT_TRACKER,
	TIME_SPANS,
	HabitData,
	HabitStats,
} from "./types";
import { HabitDataProcessor } from "./data-processor";
import {
	calculateHabitStats,
	getSuccessClass,
	formatNumericHabit,
} from "./utils";
import type HabitTrackerPlugin from "./main";

export class HabitSidebarView extends ItemView {
	plugin: HabitTrackerPlugin;
	dataProcessor: HabitDataProcessor;
	habitData: HabitData = {};
	isLoading = false;

	constructor(leaf: WorkspaceLeaf, plugin: HabitTrackerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.dataProcessor = new HabitDataProcessor(this.app, plugin.settings);
	}

	getViewType(): string {
		return VIEW_TYPE_HABIT_TRACKER;
	}

	getDisplayText(): string {
		return "Habit Tracker";
	}

	async onOpen() {
		await this.refresh();
	}

	async onClose() {
		// Cleanup if needed
	}

	async refresh() {
		if (this.isLoading) return;

		this.isLoading = true;
		try {
			this.habitData = await this.dataProcessor.extractHabitData(
				this.plugin.settings.selectedTimeSpan
			);
			this.render();
		} catch (error) {
			console.error("[Habit Tracker] Error refreshing data:", error);
			new Notice("Error loading habit data");
		} finally {
			this.isLoading = false;
		}
	}

	private render() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("habit-tracker-view");

		// Header
		this.renderHeader(contentEl);

		// Timespan selector
		this.renderTimeSpanSelector(contentEl);

		// Active habits
		const activeHabits = this.plugin.settings.trackedHabits
			.filter((habit) => !habit.ignored)
			.sort((a, b) => a.order - b.order);

		if (activeHabits.length === 0) {
			this.renderEmptyState(contentEl);
		} else {
			this.renderHabits(contentEl, activeHabits);
		}
	}

	private renderHeader(container: HTMLElement) {
		const header = container.createDiv("habit-tracker-header");
		const title = header.createDiv("habit-tracker-title");
		title.setText("Habit Tracker");
	}

	private renderTimeSpanSelector(container: HTMLElement) {
		const selector = container.createDiv("timespan-selector");

		TIME_SPANS.forEach((span) => {
			const button = selector.createEl("button", "timespan-button");
			if (span.key === this.plugin.settings.selectedTimeSpan) {
				button.addClass("active");
			}
			button.setText(span.label);
			button.onclick = () => this.switchTimeSpan(span.key);
		});
	}

	private renderEmptyState(container: HTMLElement) {
		const emptyState = container.createDiv("empty-state");
		const icon = emptyState.createDiv("empty-state-icon");
		icon.setText("📊");

		const title = emptyState.createDiv("empty-state-title");
		title.setText("No habits configured");

		const description = emptyState.createDiv();
		description.setText(
			"Go to Settings → Habit Tracker to add habits to track."
		);
	}

	private renderHabits(container: HTMLElement, habits: any[]) {
		const timeSpan = TIME_SPANS.find(
			(ts) => ts.key === this.plugin.settings.selectedTimeSpan
		);
		if (!timeSpan) return;

		const dateRange = this.generateDateRange(timeSpan.days);

		habits.forEach((habit) => {
			this.renderHabitSection(container, habit, dateRange);
		});
	}

	private renderHabitSection(
		container: HTMLElement,
		habit: any,
		dateRange: string[]
	) {
		const section = container.createDiv("habit-section");

		// Header
		const header = section.createDiv("habit-header");
		const title = header.createDiv("habit-title");
		title.setText(habit.displayName);

		const stats = this.calculateStats(habit, dateRange);
		const statsEl = header.createDiv("habit-stats");
		console.log(stats.successRate);
		statsEl.addClass(getSuccessClass(stats.successRate));

		if (habit.widget === "checkbox") {
			const targetText = habit.target === 0 ? "unchecked" : "checked";
			statsEl.setText(
				`${stats.successfulDays}/${stats.totalDays} (${stats.successRate}%) - target: ${targetText}`
			);
		} else if (habit.widget === "number" && habit.target) {
			if (habit.isTotal) {
				statsEl.setText(
					`Total: ${stats.totalValue}/${habit.target} (${stats.targetAchievement}%) - target: ${habit.target}`
				);
			} else {
				const avgDisplay = stats.averageValue
					? stats.averageValue.toFixed(1)
					: "0";
				statsEl.setText(
					`Avg: ${avgDisplay}/${habit.target} (${stats.targetAchievement}%) - target: ${habit.target}`
				);
			}
		}

		// Timeline
		const timeline = section.createDiv("habit-timeline");
		this.renderTimeline(timeline, habit, dateRange);

		// Streak info
		if (this.plugin.settings.showStreaks && stats.currentStreak > 0) {
			const streakEl = timeline.createDiv("habit-stats");
			streakEl.setText(`Current streak: ${stats.currentStreak} days`);
		}
	}

	private renderTimeline(
		container: HTMLElement,
		habit: any,
		dateRange: string[]
	) {
		const timelineRow = container.createDiv("timeline-row");

		dateRange.forEach((date) => {
			const indicator = timelineRow.createDiv("timeline-indicator");
			const value = this.habitData[date]?.habits[habit.propertyName];
			const filePath = this.habitData[date]?.filePath;

			// Add click functionality to open daily note
			indicator.style.cursor = "pointer";
			indicator.onclick = () => this.openDailyNote(date, filePath);

			if (value === null || value === undefined) {
				indicator.addClass("missing");
				indicator.title = `${date}: No data - Click to open note`;
			} else if (habit.widget === "checkbox") {
				const boolValue = value as boolean;
				const targetIsChecked = (habit.target || 1) === 1;
				const isSuccess = boolValue === targetIsChecked;

				if (isSuccess) {
					indicator.addClass("success");
					indicator.title = `${date}: ${
						boolValue ? "✓" : "✗"
					} - Click to open note`;
				} else {
					indicator.addClass("failure");
					indicator.title = `${date}: ${
						boolValue ? "✓" : "✗"
					} - Click to open note`;
				}
			} else if (habit.widget === "number" && habit.target) {
				const numValue = value as number;
				const percentage = (numValue / habit.target) * 100;

				if (percentage >= 100) {
					indicator.addClass("success");
				} else if (percentage >= 50) {
					indicator.addClass("partial");
				} else {
					indicator.addClass("failure");
				}

				indicator.title = `${date}: ${numValue}/${habit.target} - Click to open note`;
			}
		});

		// Progress bar for numeric habits
		if (habit.widget === "number" && habit.target) {
			const progressBar = container.createDiv("progress-bar");
			const progressFill = progressBar.createDiv("progress-fill");

			const stats = this.calculateStats(habit, dateRange);
			const percentage = stats.targetAchievement || 0;

			progressFill.style.width = `${Math.min(percentage, 100)}%`;

			if (percentage >= 90) progressFill.addClass("success-high");
			else if (percentage >= 75) progressFill.addClass("success-medium");
			else if (percentage >= 50) progressFill.addClass("success-partial");
			else if (percentage >= 25) progressFill.addClass("success-low");
			else progressFill.addClass("success-poor");
		}
	}

	private calculateStats(habit: any, dateRange: string[]): HabitStats {
		return calculateHabitStats(this.habitData, habit, dateRange);
	}

	private generateDateRange(days: number): string[] {
		const dates: string[] = [];
		const current = new Date();

		for (let i = days - 1; i >= 0; i--) {
			const date = new Date();
			date.setDate(current.getDate() - i);
			dates.push(date.toISOString().split("T")[0]);
		}

		return dates;
	}

	private async switchTimeSpan(timeSpanKey: string) {
		this.plugin.settings.selectedTimeSpan = timeSpanKey;
		await this.plugin.saveSettings();
		await this.refresh();
	}

	private async openDailyNote(date: string, filePath?: string) {
		if (filePath) {
			// File exists, open it
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file && file instanceof TFile) {
				await this.app.workspace.getLeaf().openFile(file as TFile);
			}
		}
		/** else {
			// File doesn't exist, create it
			const settings = this.plugin.settings;
			const [year, month, day] = date.split("-");
			const momentDate = moment(`${year}-${month}-${day}`);
			const expectedPath = `${settings.baseDirectory}/${momentDate.format(
				settings.dateFormatPattern
			)}.md`;

			try {
				// Create the file with basic frontmatter
				await this.app.vault.create(expectedPath, "---\n\n---\n\n");
				const file = this.app.vault.getAbstractFileByPath(expectedPath);
				if (file) {
					await this.app.workspace.getLeaf().openFile(file as any);
				}
			} catch (error) {
				console.error("Failed to create daily note:", error);
				// Try to create parent directories if they don't exist
				const pathParts = expectedPath.split("/");
				let currentPath = "";
				for (let i = 0; i < pathParts.length - 1; i++) {
					currentPath += pathParts[i];
					try {
						await this.app.vault.createFolder(currentPath);
					} catch (e) {
						// Folder might already exist, ignore error
					}
					currentPath += "/";
				}
				// Try creating the file again
				try {
					await this.app.vault.create(expectedPath, "---\n\n---\n\n");
					const file =
						this.app.vault.getAbstractFileByPath(expectedPath);
					if (file) {
						await this.app.workspace
							.getLeaf()
							.openFile(file as any);
					}
				} catch (finalError) {
					console.error(
						"Failed to create daily note after creating directories:",
						finalError
					);
				}
			}
		} */
	}
}
