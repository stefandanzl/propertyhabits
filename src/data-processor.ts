import { App, moment, TFile } from "obsidian";
import { HabitData, PluginSettings, TIME_SPANS, Habits } from "./types";
import {
	handleError,
	processPropertyValue,
	generateDailyNotePath,
} from "./utils";

export class HabitDataProcessor {
	app: App;
	settings: PluginSettings;

	constructor(app: App, settings: PluginSettings) {
		this.app = app;
		this.settings = settings;
	}

	async extractHabitData(timeSpanKey: string): Promise<HabitData> {
		const timeSpan = TIME_SPANS.find((ts) => ts.key === timeSpanKey);
		if (!timeSpan) {
			handleError(`Invalid timespan: ${timeSpanKey}`);
			return [];
		}

		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(endDate.getDate() - timeSpan.days + 1);

		// const filePaths: string[] = [];
		const current = moment(startDate);
		const end = moment(endDate);

		const habitData: HabitData = [];

		// Initialize all tracked habits as null (missing)
		const defaultHabits: Habits = {};
		this.settings.trackedHabits.forEach((habit) => {
			defaultHabits[habit.propertyName] = null;
		});

		while (current.isSameOrBefore(end)) {
			const expectedPath = generateDailyNotePath(
				current.toDate(),
				this.settings
			);
			// filePaths.push(expectedPath);
			const dateStr = current.format("YYYY-MM-DD");

			const fileHandler = this.app.vault.getFileByPath(expectedPath);

			const currHabits = { ...defaultHabits };

			let fileExists = false;
			if (fileHandler && fileHandler instanceof TFile) {
				fileExists = true;

				try {
					const metadata =
						this.app.metadataCache.getFileCache(fileHandler);
					if (metadata?.frontmatter) {
						// Process each tracked habit
						for (const habit of this.settings.trackedHabits) {
							const rawValue =
								metadata.frontmatter[habit.propertyName];
							const processedValue = processPropertyValue(
								habit.widget,
								rawValue
							);

							currHabits[habit.propertyName] = processedValue;
						}
					}
				} catch (error) {
					handleError(`Error processing file ${expectedPath}`, error);
				}
			}

			habitData.push({
				date: dateStr,
				filePath: expectedPath,
				exists: fileExists,
				habits: currHabits,
			});

			current.add(1, "day");
		}
		// this.plugin.habitData = habitData; // Store in plugin for later use
		return habitData;
	}

	getAvailableProperties(): Array<{ name: string; type: string }> {
		try {
			// @ts-ignore - getAllPropertyInfos exists but is missing from API documentation
			const allProperties = this.app.metadataCache.getAllPropertyInfos();

			// Debug: log all properties to see what we're getting
			console.log("[Habit Tracker] All properties found:", allProperties);
			console.log(
				"[Habit Tracker] Property entries:",
				Object.entries(allProperties)
			);

			const filtered = Object.entries(allProperties)
				.filter(([_, info]: [string, any]) => {
					console.log(
						`[Habit Tracker] Property ${_}: type="${info.widget}"`
					);
					return (
						info.widget === "checkbox" || info.widget === "number" || info.widget === "multitext"
					);
				})
				.map(([name, info]: [string, any]) => ({
					id: name,
					name: info.name,
					type: info.widget,
					occurrences: info.occurrences || 0,
				}));

			console.log("[Habit Tracker] Filtered properties:", filtered);
			return filtered;
		} catch (error) {
			handleError("Error getting available properties", error);
			return [];
		}
	}

	isRelevantDailyNote(file: TFile): boolean {
		return (
			file.path.startsWith(this.settings.baseDirectory) &&
			file.extension === "md"
		);
	}
}
