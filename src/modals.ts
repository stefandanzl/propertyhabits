import { App, Modal, Setting, Notice } from "obsidian";
import { HabitConfig } from "./types";
import { HabitDataProcessor } from "./data-processor";

export class AddHabitModal extends Modal {
	result: HabitConfig | null = null;
	onSubmit: (result: HabitConfig) => void;
	dataProcessor: HabitDataProcessor;

	selectedProperty = "";
	displayName = "";
	target: number | undefined;
	isTotal = false;
	availableProperties: Array<{ name: string; type: string }> = [];

	constructor(
		app: App,
		dataProcessor: HabitDataProcessor,
		onSubmit: (result: HabitConfig) => void
	) {
		super(app);
		this.dataProcessor = dataProcessor;
		this.onSubmit = onSubmit;
		this.availableProperties = this.dataProcessor.getAvailableProperties();
	}

	onOpen() {
		this.setTitle("Add New Habit");

		if (this.availableProperties.length === 0) {
			this.contentEl
				.createDiv()
				.setText(
					"No suitable properties found. Make sure you have checkbox or number properties in your daily notes."
				);

			new Setting(this.contentEl).addButton((btn) =>
				btn.setButtonText("Close").onClick(() => {
					this.close();
				})
			);
			return;
		}

		// Property selector
		new Setting(this.contentEl)
			.setName("Property")
			.setDesc("Select the property from your daily notes to track")
			.addDropdown((dropdown) => {
				this.availableProperties.forEach((prop) => {
					dropdown.addOption(
						prop.name,
						`${prop.name} (${prop.type})`
					);
				});

				dropdown.onChange((value) => {
					this.selectedProperty = value;
					this.displayName = value;
					// Update display name setting
					this.refreshDisplayName();
				});
			});

		// Display name
		new Setting(this.contentEl)
			.setName("Display Name")
			.setDesc("How this habit will appear in the tracker")
			.addText((text) => {
				text.onChange((value) => {
					this.displayName = value;
				});
			});

		// Target (for number properties)
		new Setting(this.contentEl)
			.setName("Target")
			.setDesc(
				"Target value for number properties (leave empty for checkbox properties)"
			)
			.addText((text) => {
				text.setPlaceholder("e.g., 8 for 8 hours of sleep");
				text.onChange((value) => {
					const num = Number(value);
					this.target = isNaN(num) ? undefined : num;
				});
			});

		// Checkbox target setting
		new Setting(this.contentEl)
			.setName("Checkbox Target")
			.setDesc(
				"For checkbox properties: should the target be checked (true) or unchecked (false)?"
			)
			.addToggle((toggle) => {
				toggle.setValue(true); // Default to "checked" as target
				toggle.onChange((value) => {
					// Store as 1 for checked, 0 for unchecked
					this.target = value ? 1 : 0;
				});
			});

		// Total vs Daily toggle
		new Setting(this.contentEl)
			.setName("Total target")
			.setDesc(
				"Whether the target is total over the period (vs daily target)"
			)
			.addToggle((toggle) => {
				toggle.onChange((value) => {
					this.isTotal = value;
				});
			});

		// Buttons
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Add Habit")
					.setCta()
					.onClick(() => {
						this.submitForm();
					})
			);
	}

	private refreshDisplayName() {
		// Find the display name setting and update its value
		const settings = this.contentEl.querySelectorAll(".setting-item");
		settings.forEach((setting) => {
			const nameEl = setting.querySelector(".setting-item-name");
			if (nameEl?.textContent === "Display Name") {
				const input = setting.querySelector(
					'input[type="text"]'
				) as HTMLInputElement;
				if (input) {
					input.value = this.displayName;
				}
			}
		});
	}

	private submitForm() {
		if (!this.selectedProperty || !this.displayName) {
			new Notice("Please fill in all required fields");
			return;
		}

		const selectedProp = this.availableProperties.find(
			(p) => p.name === this.selectedProperty
		);
		if (!selectedProp) {
			new Notice("Invalid property selected");
			return;
		}

		const result: HabitConfig = {
			propertyName: this.selectedProperty,
			displayName: this.displayName,
			widget: selectedProp.type as "checkbox" | "number",
			target: this.target,
			isTotal: this.isTotal,
			order: 0, // Will be set by the calling code
			ignored: false,
		};

		this.close();
		this.onSubmit(result);
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class EditHabitModal extends Modal {
	habit: HabitConfig;
	onSubmit: (result: HabitConfig) => void;

	constructor(
		app: App,
		habit: HabitConfig,
		onSubmit: (result: HabitConfig) => void
	) {
		super(app);
		this.habit = { ...habit }; // Create a copy
		this.onSubmit = onSubmit;
	}

	onOpen() {
		this.setTitle("Edit Habit");

		// Display name
		new Setting(this.contentEl)
			.setName("Display Name")
			.setDesc("How this habit will appear in the tracker")
			.addText((text) => {
				text.setValue(this.habit.displayName);
				text.onChange((value) => {
					this.habit.displayName = value;
				});
			});

		// Target (for number properties)
		new Setting(this.contentEl)
			.setName("Target")
			.setDesc("Target value for number properties")
			.addText((text) => {
				text.setValue(this.habit.target?.toString() || "");
				text.setPlaceholder("e.g., 8 for 8 hours of sleep");
				text.onChange((value) => {
					const num = Number(value);
					this.habit.target = isNaN(num) ? undefined : num;
				});
			});

		// Total vs Daily toggle
		new Setting(this.contentEl)
			.setName("Total target")
			.setDesc(
				"Whether the target is total over the period (vs daily target)"
			)
			.addToggle((toggle) => {
				toggle.setValue(this.habit.isTotal);
				toggle.onChange((value) => {
					this.habit.isTotal = value;
				});
			});

		// Buttons
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => {
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Save Changes")
					.setCta()
					.onClick(() => {
						this.submitForm();
					})
			);
	}

	private submitForm() {
		if (!this.habit.displayName) {
			new Notice("Please provide a display name");
			return;
		}

		this.close();
		this.onSubmit(this.habit);
	}

	onClose() {
		this.contentEl.empty();
	}
}
