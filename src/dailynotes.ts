import { App, TFile, moment } from "obsidian";
import { PluginSettings } from "./types";
import { generateDailyNotePath } from "./utils";

export class HabitDailyNotes {
    app: App;
    settings: PluginSettings;

    constructor(app: App, settings: PluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    /**
     * Get the TFile for a specific date's daily note
     * @param date - The date to get the note for
     * @returns The TFile if it exists, null otherwise
     */
    getDailyNote(date: Date): TFile | null {
        const expectedPath = generateDailyNotePath(date, this.settings);
        const file = this.app.vault.getFileByPath(expectedPath);

        if (file instanceof TFile) {
            return file;
        }
        return null;
    }

    /**
     * Ensure a daily note exists for the given date, creating it if necessary
     * @param date - The date to ensure the note for
     * @returns The TFile (existing or newly created)
     */
    async ensureDailyNoteExists(date: Date): Promise<TFile> {
        const existingFile = this.getDailyNote(date);

        if (existingFile) {
            return existingFile;
        }

        // Create the daily note using the template
        const expectedPath = generateDailyNotePath(date, this.settings);
        let templateContent = "---\n\n---\n\n";

        if (this.settings.dailyNoteTemplate) {
            const templateFile = this.app.vault.getAbstractFileByPath(this.settings.dailyNoteTemplate);
            if (templateFile && templateFile instanceof TFile) {
                templateContent = await this.app.vault.read(templateFile);
                templateContent = templateContent.replace(
                    `<%tp.date.now("YYYY-MM-DD") %>`,
                    moment(date).format("YYYY-MM-DD")
                );
                templateContent += `\nCreated on: ${moment().format("YYYY-MM-DD")} with Property Habits Plugin\n`;
            }
        }

        await this.app.vault.create(expectedPath, templateContent);

        // Return the newly created file
        const newFile = this.app.vault.getFileByPath(expectedPath);
        return newFile as TFile;
    }

    /**
     * Open a daily note in the editor
     * @param filePath - The path to the daily note file
     */
    async openDailyNote(filePath: string): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            await this.app.workspace.getLeaf().openFile(file);
        }
    }

    /**
     * Get today's daily note file
     * @returns The TFile for today if it exists, null otherwise
     */
    getTodaysNote(): TFile | null {
        return this.getDailyNote(new Date());
    }

    /**
     * Ensure today's daily note exists, creating it if necessary
     * @returns The TFile for today (existing or newly created)
     */
    async ensureTodaysNoteExists(): Promise<TFile> {
        return this.ensureDailyNoteExists(new Date());
    }

    /**
     * Open today's daily note in the editor
     */
    async openTodaysNote(): Promise<void> {
        const todayFile = await this.ensureTodaysNoteExists();
        if (todayFile) {
            await this.openDailyNote(todayFile.path);
        }
    }
}
