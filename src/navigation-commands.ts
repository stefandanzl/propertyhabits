import { TFile, App, moment, Notice } from "obsidian";
import { PluginSettings } from "./types";

const MAX_SEARCH_ATTEMPTS = 10;

async function getDailyNote(
	app: App,
	date: moment.Moment,
	settings: PluginSettings
): Promise<TFile | null> {
	const dateFormat = settings.dateFormatPattern;
	const dailyNotePath = settings.baseDirectory;
	const fileName = date.format(dateFormat);
	const filePath = `${dailyNotePath}/${fileName}.md`;
	const file = app.vault.getAbstractFileByPath(filePath);

	if (file instanceof TFile) {
		return file;
	}
	return null;
}

export async function goToPreviousDailyNote(
	app: App,
	settings: PluginSettings,
	newTab = false
) {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		return;
	}

	if (!activeFile.path.startsWith(settings.baseDirectory)) {
		new Notice("Active file is not in the daily notes directory.");
		return;
	}

	const currentFileDate = moment(activeFile.path, settings.dateFormatPattern);
	if (!currentFileDate.isValid()) {
		return;
	}

	for (let i = 1; i <= MAX_SEARCH_ATTEMPTS; i++) {
		const previousDate = currentFileDate.clone().subtract(i, "days");
		const dailyNote = await getDailyNote(app, previousDate, settings);
		if (dailyNote) {
			await app.workspace.getLeaf(newTab).openFile(dailyNote);
			return;
		}
	}
}

export async function goToNextDailyNote(app: App, settings: PluginSettings) {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		return;
	}

	if (!activeFile.path.startsWith(settings.baseDirectory)) {
		return;
	}

	const currentFileDate = moment(activeFile.path, settings.dateFormatPattern);
	if (!currentFileDate.isValid()) {
		return;
	}

	for (let i = 1; i <= MAX_SEARCH_ATTEMPTS; i++) {
		const nextDate = currentFileDate.clone().add(i, "days");
		const dailyNote = await getDailyNote(app, nextDate, settings);
		if (dailyNote) {
			await app.workspace.getLeaf().openFile(dailyNote);
			return;
		}
	}
}
