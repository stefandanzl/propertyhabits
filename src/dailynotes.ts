import { App, MarkdownView, Notice, TFile, moment } from "obsidian";
import { PluginSettings } from "./types";
import { generateDailyNotePath } from "./utils";
import HabitTrackerPlugin from "main";

export class DailyNotes {
    app: App;
    plugin: HabitTrackerPlugin;
    settings: PluginSettings;
    MAX_SEARCH_ATTEMPTS = 10;

    constructor(app: App, plugin: HabitTrackerPlugin, settings: PluginSettings) {
        this.app = app;
        this.plugin = plugin;
        this.settings = settings;
    }

    /**
     * Get the TFile for a specific date's daily note
     * @param date - The date to get the note for
     * @returns The TFile if it exists, null otherwise
     */
    async getDailyNote(date: moment.Moment): Promise<TFile | null> {
        const expectedPath = generateDailyNotePath(date, this.settings);
        console.log("getDailyNote - date:", date.format("YYYY-MM-DD"), "expectedPath:", expectedPath);
        const file = this.app.vault.getFileByPath(expectedPath);
        console.log("getDailyNote - file:", file);

        if (file instanceof TFile) {
            return file;
        }
        return null;
    }

    // /**
    //  * Ensure a daily note exists for the given date, creating it if necessary
    //  * @param date - The date to ensure the note for
    //  * @returns The TFile (existing or newly created)
    //  */
    // async ensureDailyNoteExists(date: Date): Promise<TFile> {
    //     const existingFile = this.getDailyNote(date);

    //     if (existingFile) {
    //         return existingFile;
    //     }

    //     // Create the daily note using the template
    //     const expectedPath = generateDailyNotePath(date, this.settings);
    //     let templateContent = "---\n\n---\n\n";

    //     if (this.settings.dailyNoteTemplate) {
    //         const templateFile = this.app.vault.getAbstractFileByPath(this.settings.dailyNoteTemplate);
    //         if (templateFile && templateFile instanceof TFile) {
    //             templateContent = await this.app.vault.read(templateFile);
    //             templateContent = templateContent.replace(`<%tp.date.now("YYYY-MM-DD") %>`, moment(date).format("YYYY-MM-DD"));
    //             templateContent += `\nCreated on: ${moment().format("YYYY-MM-DD")} with Property Habits Plugin\n`;
    //         }
    //     }

    //     await this.app.vault.create(expectedPath, templateContent);

    //     // Return the newly created file
    //     const newFile = this.app.vault.getFileByPath(expectedPath);
    //     return newFile as TFile;
    // }

    /**
     * Open a daily note in the editor
     * @param filePath - The path to the daily note file
     */
    async openDailyNote(filePath: string) {
        // File exists, open it
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && file instanceof TFile) {
            await this.app.workspace.getLeaf().openFile(file as TFile);

            setTimeout(() => {
                // this.app.workspace.activeEditor?.editor?.scrollTo(0);
                this.app.workspace.getActiveViewOfType(MarkdownView)?.setEphemeralState({ scroll: 0 });
                console.log("SCROLLING TO TOP");
            }, this.plugin.settings.scrollToTopInterval);
        }
    }

    async createDailyNote(date: string, filepath: string) {
        try {
            let templateContent = "---\n\n---\n\n";
            if (this.plugin.settings.dailyNoteTemplate) {
                const templateFile = this.app.vault.getAbstractFileByPath(this.plugin.settings.dailyNoteTemplate);
                if (templateFile && templateFile instanceof TFile) {
                    templateContent = await this.app.vault.read(templateFile);
                    // Replace date placeholders in the template
                    /*templateContent = templateContent.replace(
                        // /{{date}}/g,
                        `<%tp.date.now("YYYY-MM-DD") %>`,
                        date
                    );
*/
                    templateContent += `\nCreated on: ${moment().format("YYYY-MM-DD")} with Property Habits Plugin\n`;
                }
            }
            await this.app.vault.create(filepath, templateContent);
            new Notice(`Daily note created: ${filepath}`);
            // Open the newly created daily note
            this.plugin.dailyNotes.openDailyNote(filepath);
            this.plugin.refreshView();
        } catch (error) {
            console.error(`Failed to create daily note ${filepath} :`, error);
            throw error;
        }
    }

    /**
     * Get today's daily note file
     * @returns The TFile for today if it exists, null otherwise
     */
    // getTodaysNote(): TFile | null {
    //     return this.getDailyNote(new Date());
    // }

    /**
     * Ensure today's daily note exists, creating it if necessary
     * @returns The TFile for today (existing or newly created)
     */
    // async ensureTodaysNoteExists(): Promise<TFile> {
    //     return this.ensureDailyNoteExists(new Date());
    // }

    /**
     * Open today's daily note in the editor
     */
    // async openTodaysNote(): Promise<void> {
    //     const todayFile = await this.ensureTodaysNoteExists();
    //     if (todayFile) {
    //         await this.openDailyNote(todayFile.path);
    //     }
    // }

    async goToPreviousDailyNote(newTab = false) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }
        if (!activeFile.path.startsWith(this.settings.baseDirectory)) {
            new Notice("Active file is not in the daily notes directory.");
            return;
        }
        const currentFileDate = moment(activeFile.path, this.settings.dateFormatPattern);
        if (!currentFileDate.isValid()) {
            return;
        }
        for (let i = 1; i <= this.MAX_SEARCH_ATTEMPTS; i++) {
            const previousDate = currentFileDate.clone().subtract(i, "days");
            const dailyNote = await this.getDailyNote(previousDate);
            if (dailyNote) {
                await this.app.workspace.getLeaf(newTab).openFile(dailyNote);
                return;
            }
        }
    }

    async goToNextDailyNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

        if (!activeFile.path.startsWith(this.settings.baseDirectory)) {
            return;
        }

        const currentFileDate = moment(activeFile.path, this.settings.dateFormatPattern);
        if (!currentFileDate.isValid()) {
            return;
        }

        for (let i = 1; i <= this.MAX_SEARCH_ATTEMPTS; i++) {
            const nextDate = currentFileDate.clone().add(i, "days");
            const dailyNote = await this.getDailyNote(nextDate);
            if (dailyNote) {
                await this.app.workspace.getLeaf().openFile(dailyNote);
                return;
            }
        }
    }
}
