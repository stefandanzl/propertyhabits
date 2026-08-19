import { App, Modal, Setting, Notice, FuzzySuggestModal } from "obsidian";
import type { Moment } from "moment";
import { HabitConfig } from "./types";
import { HabitDataProcessor } from "./data-processor";
import HabitTrackerPlugin from "main";

/**
 * Renders a scrollable checkbox list of available property values for picking
 * goal values. Values are always selected from what actually occurs in the
 * vault (verbatim matching) — a filter input appears for long lists.
 */
function renderGoalValuePicker(container: HTMLElement, availableValues: string[], initial: string[], onChange: (selected: string[]) => void) {
    const selected = new Set(initial);

    if (availableValues.length === 0) {
        const empty = container.createDiv();
        empty.setText("No values found for this property yet — add some in a note first.");
        empty.addClass("mod-warning");
        return;
    }

    const picker = container.createDiv("goal-values-picker");

    let itemEls: Array<{ el: HTMLElement; value: string }> = [];
    if (availableValues.length > 15) {
        const filterInput = picker.createEl("input", { type: "text" });
        filterInput.placeholder = "Filter values…";
        filterInput.className = "goal-values-filter";
        filterInput.oninput = () => {
            const query = filterInput.value.toLowerCase();
            itemEls.forEach(({ el, value }) => {
                if (value.toLowerCase().includes(query)) {
                    el.show();
                } else {
                    el.hide();
                }
            });
        };
    }

    const list = picker.createDiv("goal-values-list");
    itemEls = availableValues.map((value) => {
        const item = list.createDiv("goal-value-item");
        const checkbox = item.createEl("input", { type: "checkbox" });
        checkbox.checked = selected.has(value);
        const label = item.createSpan();
        label.setText(value);

        const update = () => {
            if (checkbox.checked) {
                selected.add(value);
            } else {
                selected.delete(value);
            }
            onChange(Array.from(selected));
        };
        checkbox.onclick = () => update();
        item.onclick = (evt) => {
            if (evt.target === checkbox) return;
            checkbox.checked = !checkbox.checked;
            update();
        };
        return { el: item, value };
    });
}

export interface MissingNoteOption {
    action: "create" | "skip";
    label: string;
}

/**
 * Shown by the previous/next daily note commands when the adjacent day's note
 * is missing. Enter (first item) creates exactly that day; the second item
 * keeps the old skip-to-next-existing behavior. Esc cancels.
 */
export class MissingDailyNoteModal extends FuzzySuggestModal<MissingNoteOption> {
    private options: MissingNoteOption[];
    private onChooseAction: (action: "create" | "skip") => void;

    constructor(
        app: App,
        missingDate: string,
        nextExistingDate: string | null,
        direction: "previous" | "next",
        onChooseAction: (action: "create" | "skip") => void
    ) {
        super(app);
        this.onChooseAction = onChooseAction;
        this.options = [{ action: "create", label: `Create ${missingDate}` }];
        if (nextExistingDate) {
            this.options.push({
                action: "skip",
                label: `Skip to ${direction} existing note (${nextExistingDate})`,
            });
        }
        this.setPlaceholder(`No daily note for ${missingDate} — Enter to create`);
    }

    getItems(): MissingNoteOption[] {
        return this.options;
    }

    getItemText(item: MissingNoteOption): string {
        return item.label;
    }

    onChooseItem(item: MissingNoteOption): void {
        this.onChooseAction(item.action);
    }
}

export interface DailyNoteDateOption {
    date: Moment;
    exists: boolean;
    label: string;
}

/**
 * Fuzzy-searchable list of dates to open (or create) a daily note for.
 * Items are prebuilt by the caller; choosing one delegates back.
 */
export class OpenDailyNoteModal extends FuzzySuggestModal<DailyNoteDateOption> {
    private items: DailyNoteDateOption[];
    private onChooseOption: (option: DailyNoteDateOption) => void;

    constructor(app: App, items: DailyNoteDateOption[], onChooseOption: (option: DailyNoteDateOption) => void) {
        super(app);
        this.items = items;
        this.onChooseOption = onChooseOption;
        this.setPlaceholder("Open or create daily note on date…");
    }

    getItems(): DailyNoteDateOption[] {
        return this.items;
    }

    getItemText(item: DailyNoteDateOption): string {
        return item.label;
    }

    onChooseItem(item: DailyNoteDateOption): void {
        this.onChooseOption(item);
    }
}

export class AddHabitModal extends Modal {
    result: HabitConfig | null = null;
    onSubmit: (result: HabitConfig) => void;
    dataProcessor: HabitDataProcessor;
    plugin: HabitTrackerPlugin;

    selectedProperty = "";
    selectedPropertyType = "";
    displayName = "";
    target: number | undefined;
    isTotal = false;
    showInStatusBar = true;
    sortMode: "alphabetical" | "frequency" | "first_occurrence" = "frequency";
    limitValues: number | undefined;
    multitextNoLabel = false;
    evalMode: "count" | "goal" | "notempty" = "count";
    goalValues: string[] = [];
    availableProperties: Array<{ name: string; type: string }> = [];

    // Container for dynamic fields
    dynamicFieldsContainer: HTMLElement | null = null;
    // Reference to sort mode setting for enable/disable
    sortModeSetting: Setting | null = null;

    constructor(app: App, dataProcessor: HabitDataProcessor, plugin: HabitTrackerPlugin, onSubmit: (result: HabitConfig) => void) {
        super(app);
        this.dataProcessor = dataProcessor;
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.availableProperties = this.dataProcessor.getAvailableProperties();
    }

    onOpen() {
        this.setTitle("Add New Habit");

        if (this.availableProperties.length === 0) {
            this.contentEl
                .createDiv()
                .setText("No suitable properties found. Make sure you have checkbox, number, or list properties in your daily notes.");

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
                // Filter out already tracked habits and sort alphabetically
                const untrackedProperties = this.availableProperties
                    .filter((prop) => !this.plugin.settings.trackedHabits.some((habit) => habit.propertyName === prop.name))
                    .sort((a, b) => a.name.localeCompare(b.name));

                untrackedProperties.forEach((prop) => {
                    dropdown.addOption(prop.name, `${prop.name} (${prop.type})`);
                });

                // Set initial selection to first item
                if (untrackedProperties.length > 0) {
                    this.selectedProperty = untrackedProperties[0].name;
                    this.selectedPropertyType = untrackedProperties[0].type;
                    this.displayName = untrackedProperties[0].name;
                    this.evalMode = this.selectedPropertyType === "text" ? "notempty" : "count";
                    dropdown.setValue(untrackedProperties[0].name);
                }

                this.refreshDisplayName();

                dropdown.onChange((value) => {
                    this.selectedProperty = value;
                    this.displayName = value;
                    // Goal values belong to the previously selected property
                    this.goalValues = [];
                    // Reset the evaluation mode to the new property's default
                    this.evalMode = this.selectedPropertyType === "text" ? "notempty" : "count";
                    // Find the selected property type
                    const selectedProp = untrackedProperties.find((p) => p.name === value);
                    if (selectedProp) {
                        this.selectedPropertyType = selectedProp.type;
                    }
                    // Update display name setting
                    this.refreshDisplayName();
                    this.renderDynamicFields();
                });
            });

        // Display name
        new Setting(this.contentEl)
            .setName("Display Name")
            .setDesc("How this habit will appear in the tracker")
            .addText((text) => {
                text.setValue(this.displayName);
                text.onChange((value) => {
                    this.displayName = value;
                });
            });

        // Create container for dynamic fields
        this.dynamicFieldsContainer = this.contentEl.createDiv();
        this.renderDynamicFields();

        // Show in status bar (common setting for all habits)
        new Setting(this.contentEl)
            .setName("Show in status bar")
            .setDesc("Display this habit in the status bar indicator")
            .addToggle((toggle) => {
                toggle.setValue(this.showInStatusBar);
                toggle.onChange((value) => {
                    this.showInStatusBar = value;
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
                const input = setting.querySelector('input[type="text"]') as HTMLInputElement;
                if (input) {
                    input.value = this.displayName;
                }
            }
        });
    }

    private renderDynamicFields() {
        if (!this.dynamicFieldsContainer) return;

        // Clear existing fields
        this.dynamicFieldsContainer.empty();

        if (this.selectedPropertyType === "checkbox") {
            // Checkbox habits always have target = 1 (checked for success)
            this.target = 1;
        } else if (this.selectedPropertyType === "text") {
            // Text habits: success by any non-empty value or by exact goal values
            new Setting(this.dynamicFieldsContainer)
                .setName("Success evaluation")
                .setDesc("How success is determined for this habit")
                .addDropdown((dropdown) => {
                    dropdown.addOption("notempty", "Not empty (any value)");
                    dropdown.addOption("goal", "Actual goal values");
                    dropdown.setValue(this.evalMode === "goal" ? "goal" : "notempty");
                    dropdown.onChange((value) => {
                        this.evalMode = value as "notempty" | "goal";
                        this.renderDynamicFields();
                    });
                });

            if (this.evalMode === "goal") {
                new Setting(this.dynamicFieldsContainer)
                    .setName("Goal values")
                    .setDesc("The day counts as done when the property matches one of the selected values (verbatim)");
                renderGoalValuePicker(this.dynamicFieldsContainer, this.dataProcessor.getAvailablePropertyValues(this.selectedProperty), this.goalValues, (selected) => {
                    this.goalValues = selected;
                });
            }
        } else if (this.selectedPropertyType === "number") {
            // Number-specific fields
            new Setting(this.dynamicFieldsContainer)
                .setName("Target")
                .setDesc("Target value for this number property")
                .addText((text) => {
                    text.setPlaceholder("e.g., 8 for 8 hours of sleep");
                    text.onChange((value) => {
                        const num = Number(value);
                        this.target = this.plugin.checkNaN(num) ? undefined : num;
                    });
                });

            new Setting(this.dynamicFieldsContainer)
                .setName("Total target")
                .setDesc("Whether the target is total over the period (vs daily target)")
                .addToggle((toggle) => {
                    toggle.setValue(this.isTotal);
                    toggle.onChange((value) => {
                        this.isTotal = value;
                    });
                });
        } else if (this.selectedPropertyType === "multitext") {
            // Multitext-specific fields — display settings first, evaluation last
            // Sort mode setting (create first so we can reference it)
            this.sortModeSetting = new Setting(this.dynamicFieldsContainer)
                .setName("Sort mode")
                .setDesc("How to sort the values in the table view")
                .addDropdown((dropdown) => {
                    dropdown.addOption("alphabetical", "Alphabetical");
                    dropdown.addOption("frequency", "Frequency");
                    dropdown.addOption("first_occurrence", "First occurrence");
                    dropdown.setValue(this.sortMode);
                    dropdown.onChange((value) => {
                        this.sortMode = value as "alphabetical" | "frequency" | "first_occurrence";
                    });
                });

            // Ordered entries toggle
            new Setting(this.dynamicFieldsContainer)
                .setName("Disable labels and show values directly")
                .setDesc("Values are displayed in order without a label column. Best suited for short values.")
                .addToggle((toggle) => {
                    toggle.setValue(this.multitextNoLabel);
                    toggle.onChange((value) => {
                        this.multitextNoLabel = value;
                        // Disable sort mode setting when ordered entries is enabled
                        if (this.sortModeSetting) {
                            this.sortModeSetting.setDisabled(value);
                        }
                    });
                });

            // Set initial disabled state
            if (this.multitextNoLabel && this.sortModeSetting) {
                this.sortModeSetting.setDisabled(true);
            }

            new Setting(this.dynamicFieldsContainer)
                .setName("Limit values")
                .setDesc("Maximum number of unique values to show (leave empty for no limit)")
                .addText((text) => {
                    text.setPlaceholder("10");
                    text.onChange((value) => {
                        const num = Number(value);
                        this.limitValues = this.plugin.checkNaN(num) || value === "" ? undefined : num;
                    });
                });

            // How success is determined: by item count or by a required value set
            new Setting(this.dynamicFieldsContainer)
                .setName("Success evaluation")
                .setDesc("How success is determined for this habit")
                .addDropdown((dropdown) => {
                    dropdown.addOption("count", "Value count");
                    dropdown.addOption("goal", "Actual goal values");
                    dropdown.setValue(this.evalMode === "goal" ? "goal" : "count");
                    dropdown.onChange((value) => {
                        this.evalMode = value as "count" | "goal";
                        this.renderDynamicFields();
                    });
                });

            if (this.evalMode === "goal") {
                new Setting(this.dynamicFieldsContainer)
                    .setName("Goal values")
                    .setDesc("The day is done when ALL selected values are present (verbatim)");
                renderGoalValuePicker(this.dynamicFieldsContainer, this.dataProcessor.getAvailablePropertyValues(this.selectedProperty), this.goalValues, (selected) => {
                    this.goalValues = selected;
                });
            } else {
                new Setting(this.dynamicFieldsContainer)
                    .setName("Target")
                    .setDesc("Minimum number of list items required (leave empty for no target), e.g. '3' for 3 list items")
                    .addText((text) => {
                        text.setPlaceholder("3");
                        text.setValue(this.target?.toString() || "");
                        text.onChange((value) => {
                            const num = Number(value);
                            this.target = this.plugin.checkNaN(num) ? undefined : num;
                        });
                    });

                new Setting(this.dynamicFieldsContainer)
                    .setName("Total target")
                    .setDesc("Whether the target is total over the period (vs daily target)")
                    .addToggle((toggle) => {
                        toggle.setValue(this.isTotal);
                        toggle.onChange((value) => {
                            this.isTotal = value;
                        });
                    });
            }
        }
    }

    private submitForm() {
        if (!this.selectedProperty || !this.displayName) {
            new Notice("Please fill in all required fields");
            return;
        }

        const selectedProp = this.availableProperties.find((p) => p.name === this.selectedProperty);
        if (!selectedProp) {
            new Notice("Invalid property selected");
            return;
        }

        const result: HabitConfig = {
            propertyName: this.selectedProperty,
            displayName: this.displayName,
            widget: selectedProp.type as "checkbox" | "number" | "multitext" | "text",
            target: this.target,
            isTotal: this.isTotal,
            order: 0, // Will be set by the calling code
            ignored: false,
            showInStatusBar: this.showInStatusBar,
            sortMode: this.sortMode,
            limitValues: this.limitValues,
            multitextNoLabel: this.multitextNoLabel,
            goalValues: this.goalValues,
            evalMode:
                this.selectedPropertyType === "multitext"
                    ? this.evalMode === "goal"
                        ? "goal"
                        : "count"
                    : this.evalMode === "goal"
                      ? "goal"
                      : "notempty",
        };

        this.close();
        this.onSubmit(result);
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class EditHabitModal extends Modal {
    plugin: HabitTrackerPlugin;
    habit: HabitConfig;
    onSubmit: (result: HabitConfig) => void;

    // Reference to sort mode setting for enable/disable
    sortModeSetting: Setting | null = null;

    constructor(app: App, plugin: HabitTrackerPlugin, habit: HabitConfig, onSubmit: (result: HabitConfig) => void) {
        super(app);
        this.plugin = plugin;
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

        // Show in status bar — placement varies by widget: before the
        // evaluation settings for multitext/text, at the bottom for others
        const renderShowInStatusBar = () => {
            new Setting(this.contentEl)
                .setName("Show in status bar")
                .setDesc("Display this habit in the status bar indicator")
                .addToggle((toggle) => {
                    toggle.setValue(this.habit.showInStatusBar);
                    toggle.onChange((value) => {
                        this.habit.showInStatusBar = value;
                    });
                });
        };

        // Rebuilds the modal content when the evaluation mode changes
        const rebuild = () => {
            this.contentEl.empty();
            this.onOpen();
        };

        // Render fields based on widget type
        if (this.habit.widget === "checkbox") {
            // Checkbox habits always have target = 1 (checked for success)
            // Ensure target is set to 1 if it's not already
            if (this.habit.target === undefined) {
                this.habit.target = 1;
            }
        } else if (this.habit.widget === "text") {
            renderShowInStatusBar();

            new Setting(this.contentEl)
                .setName("Success evaluation")
                .setDesc("How success is determined for this habit")
                .addDropdown((dropdown) => {
                    dropdown.addOption("notempty", "Not empty (any value)");
                    dropdown.addOption("goal", "Actual goal values");
                    dropdown.setValue(this.habit.evalMode || "goal");
                    dropdown.onChange((value) => {
                        this.habit.evalMode = value as "notempty" | "goal";
                        rebuild();
                    });
                });

            if (this.habit.evalMode !== "notempty") {
                new Setting(this.contentEl)
                    .setName("Goal values")
                    .setDesc("The day counts as done when the property matches one of the selected values (verbatim)");
                renderGoalValuePicker(this.contentEl, this.plugin.dataProcessor.getAvailablePropertyValues(this.habit.propertyName), this.habit.goalValues ?? [], (selected) => {
                    this.habit.goalValues = selected;
                });
            }
        } else if (this.habit.widget === "number") {
            // Number-specific fields
            new Setting(this.contentEl)
                .setName("Target")
                .setDesc("Target value for this number property, e.g. '8' for 8 hours of sleep")
                .addText((text) => {
                    text.setValue(this.habit.target?.toString() || "");
                    text.setPlaceholder("8");
                    text.onChange((value) => {
                        const num = Number(value);
                        this.habit.target = this.plugin.checkNaN(num) ? undefined : num;
                    });
                });

            new Setting(this.contentEl)
                .setName("Total target")
                .setDesc("Whether the target is total over the period (vs daily target)")
                .addToggle((toggle) => {
                    toggle.setValue(this.habit.isTotal);
                    toggle.onChange((value) => {
                        this.habit.isTotal = value;
                    });
                });
        } else if (this.habit.widget === "multitext") {
            // Multitext-specific fields — display settings first, evaluation last
            // Sort mode setting (create first so we can reference it)
            this.sortModeSetting = new Setting(this.contentEl)
                .setName("Sort mode")
                .setDesc("How to sort the values in the table view")
                .addDropdown((dropdown) => {
                    dropdown.addOption("alphabetical", "Alphabetical");
                    dropdown.addOption("frequency", "Frequency");
                    dropdown.addOption("first_occurrence", "First occurrence");
                    dropdown.setValue(this.habit.sortMode || "frequency");
                    dropdown.onChange((value) => {
                        this.habit.sortMode = value as "alphabetical" | "frequency" | "first_occurrence";
                    });
                });

            // Ordered entries toggle
            new Setting(this.contentEl)
                .setName("Disable labels and show values directly")
                .setDesc("Values are displayed in order without a label column. Best suited for short values.")
                .addToggle((toggle) => {
                    toggle.setValue(this.habit.multitextNoLabel || false);
                    toggle.onChange((value) => {
                        this.habit.multitextNoLabel = value;
                        // Disable sort mode setting when ordered entries is enabled
                        if (this.sortModeSetting) {
                            this.sortModeSetting.setDisabled(value);
                        }
                    });
                });

            // Set initial disabled state
            if (this.habit.multitextNoLabel && this.sortModeSetting) {
                this.sortModeSetting.setDisabled(true);
            }

            new Setting(this.contentEl)
                .setName("Limit values")
                .setDesc("Maximum number of unique values to show (leave empty for no limit)")
                .addText((text) => {
                    text.setPlaceholder("10");
                    text.setValue(this.habit.limitValues?.toString() || "");
                    text.onChange((value) => {
                        const num = Number(value);
                        this.habit.limitValues = this.plugin.checkNaN(num) || value === "" ? undefined : num;
                    });
                });

            renderShowInStatusBar();

            // How success is determined: by item count or by a required value set
            new Setting(this.contentEl)
                .setName("Success evaluation")
                .setDesc("How success is determined for this habit")
                .addDropdown((dropdown) => {
                    dropdown.addOption("count", "Value count");
                    dropdown.addOption("goal", "Actual goal values");
                    dropdown.setValue(this.habit.evalMode || "count");
                    dropdown.onChange((value) => {
                        this.habit.evalMode = value as "count" | "goal";
                        rebuild();
                    });
                });

            if (this.habit.evalMode === "goal") {
                new Setting(this.contentEl)
                    .setName("Goal values")
                    .setDesc("The day is done when ALL selected values are present (verbatim)");
                renderGoalValuePicker(this.contentEl, this.plugin.dataProcessor.getAvailablePropertyValues(this.habit.propertyName), this.habit.goalValues ?? [], (selected) => {
                    this.habit.goalValues = selected;
                });
            } else {
                new Setting(this.contentEl)
                    .setName("Target")
                    .setDesc("Minimum number of list items required (leave empty for no target)")
                    .addText((text) => {
                        text.setValue(this.habit.target?.toString() || "");
                        text.setPlaceholder("3");
                        text.onChange((value) => {
                            if (value == undefined) return;
                            const num = Number(value);
                            this.habit.target = this.plugin.checkNaN(num) ? undefined : num;
                        });
                    });

                new Setting(this.contentEl)
                    .setName("Total target")
                    .setDesc("Whether the target is total over the period (vs daily target)")
                    .addToggle((toggle) => {
                        toggle.setValue(this.habit.isTotal);
                        toggle.onChange((value) => {
                            this.habit.isTotal = value;
                        });
                    });
            }
        }

        // Show in status bar (common setting for checkbox/number habits)
        if (this.habit.widget === "checkbox" || this.habit.widget === "number") {
            renderShowInStatusBar();
        }

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
