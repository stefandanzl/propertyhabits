import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { HabitConfig } from "./types";
import { HabitDataProcessor } from "./data-processor";
import { AddHabitModal, EditHabitModal } from "./modals";
import type HabitTrackerPlugin from "./main";

export class HabitSettingsTab extends PluginSettingTab {
	plugin: HabitTrackerPlugin;
	dataProcessor: HabitDataProcessor;

	constructor(app: App, plugin: HabitTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.dataProcessor = new HabitDataProcessor(app, plugin.settings);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("habit-settings-container");

		// Basic Settings Section
		this.renderBasicSettings(containerEl);

		// Habits Configuration Section
		this.renderHabitsSection(containerEl);
	}

	private renderBasicSettings(container: HTMLElement) {
		const section = container.createDiv("setting-section");
		const title = section.createDiv("setting-section-title");
		title.setText("Basic Settings");

		new Setting(section)
			.setName("Base Directory")
			.setDesc(
				'The directory containing your daily notes (e.g., "Journal")'
			)
			.addText((text) =>
				text
					.setPlaceholder("Journal")
					.setValue(this.plugin.settings.baseDirectory)
					.onChange(async (value) => {
						this.plugin.settings.baseDirectory = value;
						await this.plugin.saveSettings();
						console.log("Base directory updated:", value);
					})
			);

		new Setting(section)
			.setName("Date Format Pattern")
			.setDesc(
				'Moment.js format pattern for your daily note structure (e.g., "YYYY/YYYY-MM/YYYY-MM-DD dddd")'
			)
			.addText((text) =>
				text
					.setPlaceholder("YYYY/YYYY-MM/YYYY-MM-DD dddd")
					.setValue(this.plugin.settings.dateFormatPattern)
					.onChange(async (value) => {
						this.plugin.settings.dateFormatPattern = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(section)
			.setName("Show Streaks")
			.setDesc("Display current streak information for habits")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showStreaks)
					.onChange(async (value) => {
						this.plugin.settings.showStreaks = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderHabitsSection(container: HTMLElement) {
		const section = container.createDiv("setting-section");
		const title = section.createDiv("setting-section-title");
		title.setText("Tracked Habits");

		// Habits list
		const habitsList = section.createDiv("habits-list");
		this.renderHabitsList(habitsList);

		// Add habit button
		const addButton = section.createEl("button", "add-habit-btn");
		addButton.setText("+ Add New Habit");
		addButton.onclick = () => this.showAddHabitModal();
	}

	private renderHabitsList(container: HTMLElement) {
		container.empty();

		if (this.plugin.settings.trackedHabits.length === 0) {
			const emptyText = container.createDiv();
			emptyText.style.color = "red";
			emptyText.style.padding = "12px";
			emptyText.style.textAlign = "center";
			emptyText.setText(
				'No habits configured yet. Click "Add New Habit" to get started.'
			);
			return;
		}

		// Make container sortable
		this.makeSortable(container);

		this.plugin.settings.trackedHabits
			.sort((a, b) => a.order - b.order)
			.forEach((habit, index) => {
				this.renderHabitItem(container, habit, index);
			});
	}

	private makeSortable(container: HTMLElement) {
		container.addEventListener("dragover", (e) => e.preventDefault());
		container.addEventListener("drop", (e) => {
			e.preventDefault();
			const draggedId = e.dataTransfer?.getData("text/plain");
			const targetElement = (e.target as Element).closest(
				".habit-item"
			) as HTMLElement;
			if (draggedId && targetElement) {
				this.reorderHabits(
					draggedId,
					targetElement.dataset.habitId || ""
				);
			}
		});
	}

	private renderHabitItem(
		container: HTMLElement,
		habit: HabitConfig,
		index: number
	) {
		const habitItem = container.createDiv("habit-item");
		habitItem.draggable = true;
		habitItem.dataset.habitId = habit.propertyName;

		// Drag handle
		const dragHandle = habitItem.createSpan("drag-handle");
		dragHandle.setText("⋮⋮");

		// Habit info
		const habitInfo = habitItem.createDiv("habit-info");
		const propertyName = habitInfo.createDiv("habit-property-name");
		propertyName.setText(habit.displayName);

		const displayName = habitInfo.createDiv("habit-display-name");
		displayName.setText(
			`Property: ${habit.propertyName} (${habit.widget})`
		);

		if (habit.target) {
			const targetInfo = habitInfo.createDiv("habit-display-name");
			targetInfo.setText(
				`Target: ${habit.target}${
					habit.isTotal ? " (total)" : " (daily)"
				}`
			);
		}

		// Controls
		const controls = habitItem.createDiv("habit-controls");

		// Ignore checkbox
		const ignoreContainer = controls.createDiv();
		const ignoreCheckbox = ignoreContainer.createEl("input", {
			type: "checkbox",
		});
		ignoreCheckbox.addClass("habit-checkbox");
		ignoreCheckbox.checked = habit.ignored || false;
		ignoreCheckbox.addEventListener("change", async () => {
			habit.ignored = ignoreCheckbox.checked;
			await this.plugin.saveSettings();
			await this.plugin.refreshView();
		});

		const ignoreLabel = ignoreContainer.createSpan("habit-checkbox-label");
		ignoreLabel.setText(" Hide");
		ignoreLabel.onclick = () => ignoreCheckbox.click();

		// Edit button
		const editBtn = controls.createEl("button");
		editBtn.setText("Edit");
		editBtn.onclick = () => this.editHabit(index);

		// Delete button
		const deleteBtn = controls.createEl("button", "habit-delete-btn");
		deleteBtn.setText("Delete");
		deleteBtn.onclick = () => this.deleteHabit(index);

		// Drag events
		habitItem.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("text/plain", habit.propertyName);
			habitItem.addClass("dragging");
		});

		habitItem.addEventListener("dragend", () => {
			habitItem.removeClass("dragging");
		});
	}

	private async reorderHabits(draggedId: string, targetId: string) {
		const habits = this.plugin.settings.trackedHabits;
		const draggedIndex = habits.findIndex(
			(h) => h.propertyName === draggedId
		);
		const targetIndex = habits.findIndex(
			(h) => h.propertyName === targetId
		);

		if (draggedIndex !== -1 && targetIndex !== -1) {
			// Move item
			const [draggedItem] = habits.splice(draggedIndex, 1);
			habits.splice(targetIndex, 0, draggedItem);

			// Update order values
			habits.forEach((habit, index) => {
				habit.order = index;
			});

			await this.plugin.saveSettings();
			this.display(); // Refresh the settings display
			await this.plugin.refreshView();
		}
	}

	private showAddHabitModal() {
		const modal = new AddHabitModal(
			this.app,
			this.dataProcessor,
			async (result) => {
				result.order = this.plugin.settings.trackedHabits.length;
				await this.addHabit(result);
			}
		);
		modal.open();
	}

	private async addHabit(habit: HabitConfig) {
		// Check if property already exists
		const exists = this.plugin.settings.trackedHabits.find(
			(h) => h.propertyName === habit.propertyName
		);
		if (exists) {
			new Notice("This property is already being tracked");
			return;
		}

		this.plugin.settings.trackedHabits.push(habit);
		await this.plugin.saveSettings();
		this.display();
		await this.plugin.refreshView();
		new Notice(`Added habit: ${habit.displayName}`);
	}

	private editHabit(index: number) {
		const habit = this.plugin.settings.trackedHabits[index];

		const modal = new EditHabitModal(this.app, habit, async (result) => {
			// Update the habit in place
			Object.assign(habit, result);
			await this.plugin.saveSettings();
			this.display();
			await this.plugin.refreshView();
			new Notice(`Updated habit: ${result.displayName}`);
		});
		modal.open();
	}

	private async deleteHabit(index: number) {
		const habit = this.plugin.settings.trackedHabits[index];

		// Simple confirmation
		const confirmed = confirm(
			`Are you sure you want to delete the habit "${habit.displayName}"?`
		);
		if (!confirmed) return;

		this.plugin.settings.trackedHabits.splice(index, 1);

		// Update order values
		this.plugin.settings.trackedHabits.forEach((h, i) => {
			h.order = i;
		});

		await this.plugin.saveSettings();
		this.display();
		await this.plugin.refreshView();
		new Notice(`Deleted habit: ${habit.displayName}`);
	}
}
