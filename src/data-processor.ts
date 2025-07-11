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
			// Since getAllPropertyInfos may not be available in all Obsidian versions,
			// we'll scan through existing daily notes to find properties
			const allFiles = this.app.vault.getFiles();
			const properties = new Map<string, string>();
			
			// Look through recent daily notes to find properties
			for (const file of allFiles.slice(0, 50)) { // Check last 50 files
				if (this.isRelevantDailyNote(file)) {
					const metadata = this.app.metadataCache.getFileCache(file);
					if (metadata?.frontmatter) {
						Object.entries(metadata.frontmatter).forEach(([key, value]) => {
							if (typeof value === 'boolean') {
								properties.set(key, 'checkbox');
							} else if (typeof value === 'number') {
								properties.set(key, 'number');
							}
						});
					}
				}
			}
			
			return Array.from(properties.entries()).map(([name, type]) => ({ name, type }));
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
