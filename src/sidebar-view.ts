import { ItemView, WorkspaceLeaf, Notice, TFile, moment, MarkdownView } from "obsidian";
import { VIEW_TYPE_HABIT_TRACKER, TIME_SPANS, HabitData, HabitStats, HabitConfig } from "./types";
import { HabitDataProcessor } from "./data-processor";
import { calculateHabitStats, getSuccessClass, extractMultitextValues, hasMultitextValue } from "./utils";
import type HabitTrackerPlugin from "./main";

export class HabitSidebarView extends ItemView {
    plugin: HabitTrackerPlugin;
    dataProcessor: HabitDataProcessor;
    habitData: HabitData = [];
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
        return "Property Habits";
    }

    getIcon(): string {
        return "calendar-check"; // Use a suitable icon for habit tracking
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
            this.habitData = await this.dataProcessor.extractHabitData(this.plugin.settings.selectedTimeSpan);
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
        const activeHabits = this.plugin.settings.trackedHabits.filter((habit) => !habit.ignored).sort((a, b) => a.order - b.order);

        if (activeHabits.length === 0) {
            this.renderEmptyState(contentEl);
        } else {
            this.renderHabits(contentEl, activeHabits);
        }
    }

    private renderHeader(container: HTMLElement) {
        const header = container.createDiv("habit-tracker-header");
        const title = header.createDiv("habit-tracker-title");
        title.setText("Property Habits");
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
        const emptyState = container.createDiv("empty-state-area");
        const icon = emptyState.createDiv("empty-state-icon");
        icon.setText("📊");

        const title = emptyState.createDiv("empty-state-title");
        title.setText("No habits configured");

        const description = emptyState.createDiv();
        description.setText("Go to Settings → Habit Tracker to add habits to track.");
    }

    private renderHabits(container: HTMLElement, habits: HabitConfig[]) {
        const timeSpan = TIME_SPANS.find((ts) => ts.key === this.plugin.settings.selectedTimeSpan);
        if (!timeSpan) return;

        const dateRange = this.generateDateRange(timeSpan.days);

        habits.forEach((habit) => {
            this.renderHabitSection(container, habit, dateRange);
        });
    }

    private renderHabitSection(container: HTMLElement, habit: HabitConfig, dateRange: string[]) {
        const section = container.createDiv("habit-section");

        // Header
        const header = section.createDiv("habit-header");
        const title = header.createDiv("habit-title");
        title.setText(habit.displayName);

        const stats = this.calculateStats(habit);
        const statsEl = header.createDiv("habit-stats");
        statsEl.addClass(getSuccessClass(stats.successRate));

        if (habit.widget === "checkbox") {
            if (habit.target !== undefined) {
                const targetText = habit.target === 0 ? "unchecked" : "checked";
                statsEl.setText(`${stats.successfulDays}/${stats.totalDays} (${stats.successRate}%) - target: ${targetText}`);
            } else {
                statsEl.setText(`${stats.successfulDays}/${stats.totalDays} (${stats.successRate}%)`);
            }
        } else if (habit.widget === "number" && habit.target) {
            if (habit.isTotal) {
                statsEl.setText(`Total: ${stats.totalValue}/${habit.target} (${stats.targetAchievement}%) - target: ${habit.target}`);
            } else {
                const avgDisplay = stats.averageValue ? stats.averageValue.toFixed(1) : "0";
                statsEl.setText(`Avg: ${avgDisplay}/${habit.target} (${stats.targetAchievement}%) - target: ${habit.target}`);
            }
        } else if (habit.widget === "multitext") {
            if (habit.target) {
                if (habit.isTotal) {
                    statsEl.setText(`Total: ${stats.totalValue}/${habit.target} items (${stats.targetAchievement}%) - target: ${habit.target}`);
                } else {
                    const avgDisplay = stats.averageValue ? stats.averageValue.toFixed(1) : "0";
                    statsEl.setText(`Avg: ${avgDisplay}/${habit.target} items (${stats.targetAchievement}%) - target: ${habit.target}`);
                }
            } else {
                if (habit.isTotal) {
                    statsEl.setText(`Total: ${stats.totalValue} items`);
                } /*else {
                    const avgDisplay = stats.averageValue ? stats.averageValue.toFixed(1) : "0";
                    statsEl.setText(`Avg: ${avgDisplay} items`);
                }*/
            }
        }

        // Timeline
        const timeline = section.createDiv("habit-timeline");

        if (habit.widget === "multitext") {
            // New table-style display for multitext
            this.renderMultitextTable(timeline, habit);
        } else {
            // Original timeline for checkbox and number
            this.renderTimeline(timeline, habit, dateRange);
        }

        // Streak info
        if (this.plugin.settings.showStreaks && stats.currentStreak > 0) {
            const streakEl = timeline.createDiv("habit-stats");
            streakEl.setText(`Current streak: ${stats.currentStreak} days`);
        }
    }

    private renderTimeline(container: HTMLElement, habit: HabitConfig, dateRange: string[]) {
        const timelineRow = container.createDiv("timeline-row");

        this.habitData.forEach((day) => {
            const indicator = timelineRow.createDiv("timeline-indicator");
            const value = day?.habits[habit.propertyName];
            const filePath = day?.filePath;

            // Add click functionality to open daily note
            indicator.style.cursor = "pointer";

            if (day.exists) {
                // Single click for existing files
                indicator.onclick = () => this.plugin.dailyNotes.openDailyNote(filePath);
            } else {
                // Double click for non-existing files (to create them)
                indicator.ondblclick = () => this.plugin.dailyNotes.createDailyNote(day.date, filePath);

                // Optionally add a different cursor style to indicate double-click required
                indicator.style.cursor = "copy"; // "cell" or "crosshair" to indicate "create"
            }

            // Handle number habits first
            if (habit.widget === "number") {
                const numValue = Number(value);
                const isNullish = value === null || value === undefined || numValue === 0 || (typeof value === "string" && value === "");
                const isInvalidNumber = isNaN(numValue);
                // Always create battery-style visualization for number habits
                indicator.addClass("battery");

                if (!day.exists) {
                    indicator.addClass("missing");
                    indicator.title = `${day.date}: No file - Double click to create note`;
                    return;
                }
                if (isInvalidNumber) {
                    // For number habits with no data or zero value, create red battery
                    indicator.addClass("bad-data");
                    const valueText = `Bad data entry: Value is ${value}`;
                    indicator.title = `${day.date}: ${valueText} - Click to open note`;
                } else if (isNullish) {
                    // For number habits with no data or zero value, create red battery
                    indicator.addClass("no-data");
                    const valueText = numValue === 0 ? "Value is 0" : "No data";
                    indicator.title = `${day.date}: ${valueText} - Click to open note`;
                } else {
                    const numValueDisplay = numValue;

                    if (habit.target) {
                        // When we have a target, show percentage-based fill
                        const percentage = Math.min((numValue / habit.target) * 100, 100);
                        const fillElement = indicator.createDiv("battery-fill");
                        fillElement.style.height = `${percentage}%`;

                        // Set fill color based on success level
                        if (percentage >= 75) {
                            fillElement.addClass("success-high");
                        } else if (percentage >= 50) {
                            fillElement.addClass("success-medium");
                        } else if (percentage >= 25) {
                            fillElement.addClass("success-partial");
                        } else {
                            fillElement.addClass("success-low");
                        }

                        indicator.title = `${day.date}: ${numValue}/${habit.target} (${Math.round(percentage)}%) - Click to open note`;
                        const targetText = habit.target ? `${habit.target}` : "no target";
                        indicator.title = `${day.date}: ${numValueDisplay} (target: ${targetText}) - Click to open note`;
                    } else {
                        // When no target or invalid value, show red battery or minimal fill
                        if (numValue > 0) {
                            indicator.addClass("raw-data");
                            indicator.setText(numValue.toString());

                            indicator.title = `${day.date}: Value ${numValueDisplay} (no target defined) - Click to open note`;
                        } else {
                            // No target and zero/invalid value - completely red
                            indicator.addClass("no-data");
                        }
                    }
                }
            } else if (habit.widget === "checkbox") {
                const boolValue = value as boolean;

                const targetIsChecked = (habit.target || 1) === 1;
                const isSuccess = boolValue === targetIsChecked;

                if (day.exists) {
                    if (isSuccess) {
                        indicator.addClass("success");
                        indicator.title = `${day.date}: ${boolValue ? "✓" : "✗"} - Click to open note`;
                    } else {
                        indicator.addClass("failure");
                        indicator.title = `${day.date}: ${boolValue ? "✓" : "✗"} - Click to open note`;
                    }
                } else {
                    indicator.addClass("missing");
                    indicator.title = `${day.date}: No file - Double click to create note`;
                }
            }
        });
    }

    private renderMultitextTable(container: HTMLElement, habit: HabitConfig) {
        // Extract unique values sorted by the configured mode
        const uniqueValues = extractMultitextValues(this.habitData, habit.propertyName, habit.sortMode || "frequency", habit.limitValues);

        if (uniqueValues.length === 0) {
            const emptyState = container.createDiv("empty-state-area");
            emptyState.setText("No values found in the selected time period.");
            return;
        }

        // Container for the table
        const tableContainer = container.createDiv("multitext-table-container");

        // Labels container (left side)
        const labelsContainer = tableContainer.createDiv("multitext-labels");

        // Timelines container (right side)
        const timelinesContainer = tableContainer.createDiv("multitext-timelines");

        // Create a row for each unique value
        uniqueValues.forEach((valueData) => {
            // Label row
            const labelCell = labelsContainer.createDiv("multitext-label");
            labelCell.setText(valueData.value);
            labelCell.title = `${valueData.value} (${valueData.count} occurrences)`;

            // Timeline row (indicators)
            const timelineRow = timelinesContainer.createDiv("timeline-row");

            this.habitData.forEach((day) => {
                const indicator = timelineRow.createDiv("timeline-indicator");
                const filePath = day?.filePath;

                // Add click functionality to open daily note
                indicator.style.cursor = "pointer";

                // Check if this value exists on this day
                const hasValue = hasMultitextValue(day, habit.propertyName, valueData.value);

                if (day.exists) {
                    indicator.onclick = () => this.plugin.dailyNotes.openDailyNote(filePath);

                    if (hasValue) {
                        indicator.addClass("success");
                        indicator.title = `${day.date}: ${valueData.value} - Click to open note`;
                    } else {
                        indicator.addClass("empty");
                        indicator.title = `${day.date}: No data - Click to open note`;
                    }
                } else {
                    indicator.ondblclick = () => this.plugin.dailyNotes.createDailyNote(day.date, filePath);
                    indicator.style.cursor = "copy";

                    indicator.addClass("missing");
                    indicator.title = `${day.date}: No file - Double click to create note`;
                }
            });
        });
    }

    private calculateStats(habitConfig: HabitConfig): HabitStats {
        const stats = calculateHabitStats(this.habitData, habitConfig);
        return stats;
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
}
