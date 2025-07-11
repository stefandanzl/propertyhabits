import { App, moment, TAbstractFile, TFile } from "obsidian";
import { HabitConfig, HabitData, PluginSettings, TIME_SPANS } from "./types";
import {
	handleError,
	processPropertyValue,
	getFilesInDateRange,
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
			return {};
		}

		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(endDate.getDate() - timeSpan.days + 1);

		const allFiles = this.app.vault.getFiles();
		const relevantFiles = getFilesInDateRange(
			startDate,
			endDate,
			this.settings,
			allFiles
		);

		const habitData: HabitData = {};

		// Initialize dates with null values for missing files
		const current = moment(startDate);
		const end = moment(endDate);

		while (current.isSameOrBefore(end)) {
			const dateStr = current.format("YYYY-MM-DD");
			habitData[dateStr] = {};

			// Initialize all tracked habits as null (missing)
			this.settings.trackedHabits.forEach((habit) => {
				habitData[dateStr][habit.propertyName] = null;
			});

			current.add(1, "day");
		}

		// Process existing files
		for (const filePath of relevantFiles) {
			const file = allFiles.find((f) => f.path === filePath);
			if (!file) continue;

			try {
				const dateStr = this.extractDateFromPath(filePath);
				if (!dateStr) continue;

				const metadata = this.app.metadataCache.getFileCache(file);
				if (!metadata?.frontmatter) continue;

				// Process each tracked habit
				for (const habit of this.settings.trackedHabits) {
					const rawValue = metadata.frontmatter[habit.propertyName];
					const processedValue = processPropertyValue(
						habit.widget,
						rawValue
					);

					if (habitData[dateStr]) {
						habitData[dateStr][habit.propertyName] = processedValue;
					}
				}
			} catch (error) {
				handleError(`Error processing file ${filePath}`, error);
			}
		}

		return habitData;
	}

	private extractDateFromPath(filePath: string): string | null {
		try {
			// Remove base directory and .md extension
			const relativePath = filePath
				.replace(`${this.settings.baseDirectory}/`, "")
				.replace(".md", "");

			// Try to parse the date using the configured format
			const parsedDate = moment(
				relativePath,
				this.settings.dateFormatPattern,
				true
			);

			if (parsedDate.isValid()) {
				return parsedDate.format("YYYY-MM-DD");
			}
		} catch (error) {
			handleError(`Could not extract date from path: ${filePath}`, error);
		}

		return null;
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
						info.widget === "checkbox" || info.widget === "number"
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
			file.path.endsWith(".md")
		);
	}
}
