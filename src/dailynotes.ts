import type { Moment } from "moment";
import { App, Notice, TFile, WorkspaceLeaf, moment } from "obsidian";
import { PluginSettings } from "./types";
import { generateDailyNotePath } from "./utils";
import { MissingDailyNoteModal, OpenDailyNoteModal, DailyNoteDateOption } from "./modals";
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
    async getDailyNote(date: Moment): Promise<TFile | null> {
        const expectedPath = generateDailyNotePath(date, this.settings);
        const file = this.app.vault.getFileByPath(expectedPath);

        if (file instanceof TFile) {
            return file;
        }
        return null;
    }

    /**
     * Open a daily note in the editor
     * @param filePath - The path of the daily note file
     * @param propertyName - Optional property to focus/flash after opening
     */
    async openDailyNote(filePath: string, propertyName = "") {
        // File exists, open it
        const file = this.app.vault.getFileByPath(filePath);
        if (!file) return;

        // Try to reuse a tab that already shows this note — getLeaf() would
        // otherwise open a new tab when the active one is pinned
        const existingLeaf = this.app.workspace
            .getLeavesOfType("markdown")
            .find((l) => (l.view.getState() as { file?: string })?.file === filePath);

        let leaf: WorkspaceLeaf;
        if (existingLeaf) {
            this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
            this.app.workspace.revealLeaf(existingLeaf);
            leaf = existingLeaf;
        } else {
            leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
        }

        // Fallback behaviour
        if (propertyName === "") {
            console.log("No property name was provided");
            leaf.setEphemeralState({
                // Triggers the 'setState' branch to focus the PROPERTIES UI
                focusMetadata: true,
            });
            return;
        }
        setTimeout(() => {
            leaf.setEphemeralState({
                propertyMatches: [{ key: propertyName }],
                focus: true,
            });
        }, this.plugin.settings.scrollToTopInterval);

        const propertyKey = propertyName.toLowerCase();
        // Find the element using the data-attribute
        const propertyElement = document.querySelector(`.metadata-property[data-property-key="${propertyKey}"]`);

        if (propertyElement) {
            // Add the class to trigger the CSS animation
            propertyElement.classList.add("is-flashing");

            // Remove it after it's done so it can be triggered again later
            setTimeout(() => {
                propertyElement.classList.remove("is-flashing");
            }, 300);
        } else {
            console.log("Property element not found. Make sure the Properties view is visible!");
        }
    }

    /**
     * Create a daily note for the given date (defaults to today)
     * @param date - The date of the note as "YYYY-MM-DD" ("" = today)
     * @param filepath - The path to create the note at
     * @param propertyName - Optional property to focus/flash after opening
     */
    async createDailyNote(date: string, filepath: string, propertyName = "") {
        // If the note already exists, just open it
        if (this.app.vault.getFileByPath(filepath)) {
            this.openDailyNote(filepath, propertyName);
            return;
        }

        const targetDate = date ? window.moment(date, "YYYY-MM-DD") : window.moment();
        const isToday = targetDate.isSame(window.moment(), "day");

        let templateContent = "---\n\n---\n\n";
        if (this.settings.dailyNoteTemplate) {
            const templateFile = this.app.vault.getAbstractFileByPath(this.settings.dailyNoteTemplate);
            if (templateFile && templateFile instanceof TFile) {
                templateContent = await this.app.vault.read(templateFile);
                // Stamp the real creation date, independent of any moment override
                templateContent += `\nCreated on: ${window.moment().format("YYYY-MM-DD")} with Property Habits Plugin\n`;
            }
        }

        try {
            // The Templater wait must run INSIDE the override: vault.create()
            // resolves before Templater's async trigger-on-creation executes,
            // so moment.now has to stay shifted until the templates are done
            const createAndSync = async () => {
                // Register the listener BEFORE creating the file so the
                // event isn't missed (no-op resolves quickly if Templater is absent)
                const templaterDone = this.waitForTemplater();
                await this.app.vault.create(filepath, templateContent);
                await templaterDone;
            };

            // For past dates, shift moment.now to the target day so Templater's
            // trigger-on-creation renders the note's date correctly
            if (isToday) {
                await createAndSync();
            } else {
                await this.withTimeOverride(targetDate, createAndSync);
            }

            new Notice(`Daily note created: ${filepath}`);
            this.openDailyNote(filepath, propertyName);
            this.plugin.refreshView();
        } catch (error) {
            console.error(`Failed to create daily note ${filepath}:`, error);
            throw error;
        }
    }

    /**
     * Runs `fn` with moment.now globally shifted to the target day at 01:23
     * (symbolic placeholder time to avoid midnight/timezone edge cases).
     * Always restores the original moment.now afterwards.
     */
    private async withTimeOverride(targetDate: Moment, fn: () => Promise<void>): Promise<void> {
        const target = targetDate.clone().startOf("day").add(1, "hour").add(23, "minute");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const momentAny = moment as any;
        const originalNow = momentAny.now;
        try {
            momentAny.now = () => target.valueOf();
            await fn();
        } finally {
            momentAny.now = originalNow;
        }
    }

    /**
     * Waits for Templater to finish processing newly created files. Must be
     * invoked BEFORE creating the file so the event isn't missed. If Templater
     * isn't active, resolves after a short tick. Resolves on the
     * `templater:all-templates-executed` event or a 30s safety timeout.
     */
    private waitForTemplater(): Promise<void> {
        return new Promise<void>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const templater = (this.app as any).plugins?.getPlugin?.("templater-obsidian");
            if (!templater) {
                setTimeout(resolve, 50);
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const workspace: any = this.app.workspace;
            let done = false;
            const handler = () => {
                if (done) return;
                done = true;
                workspace.off("templater:all-templates-executed", handler);
                resolve();
            };
            workspace.on("templater:all-templates-executed", handler);
            setTimeout(handler, 30000);
        });
    }

    /**
     * Create (or open, if it already exists) the daily note for a specific date
     * @param date - The day to create the note for (defaults to today when omitted)
     * @param propertyName - Optional property to focus/flash after opening
     */
    async createDailyNoteForDate(date?: Moment, propertyName = "") {
        const targetDate = date ?? window.moment();
        const path = generateDailyNotePath(targetDate, this.settings);
        await this.createDailyNote(targetDate.format("YYYY-MM-DD"), path, propertyName);
    }

    /**
     * Create tomorrow's daily note — the moment override makes Templater
     * render tomorrow's date during creation
     */
    async createTomorrowDailyNote() {
        await this.createDailyNoteForDate(window.moment().add(1, "day"));
    }

    /**
     * Opens a fuzzy-searchable modal of dates (today back one year, plus a
     * month ahead). Existing dates open; missing ones are created via the
     * backfill path with correct Templater dates.
     */
    openDailyNoteModal() {
        const today = window.moment().startOf("day");
        const items: DailyNoteDateOption[] = [];

        const addDay = (date: Moment, marker = "") => {
            const path = generateDailyNotePath(date, this.settings);
            const exists = this.app.vault.getFileByPath(path) instanceof TFile;
            items.push({
                date,
                exists,
                label: `${date.format("YYYY-MM-DD")} (${date.format("dddd")})${marker ? ` - ${marker}` : ""}${exists ? "" : " - missing, Enter to create"}`,
            });
        };

        // Today first (Enter on empty query opens today), then back a year,
        // then a month ahead for creating future notes
        addDay(today.clone(), "TODAY");
        for (let offset = 1; offset <= 365; offset++) {
            addDay(today.clone().subtract(offset, "days"), offset === 1 ? "YESTERDAY" : "");
        }

        // How many days into the future should be shown:
        for (let offset = 1; offset <= 30; offset++) {
            addDay(today.clone().add(offset, "days"), offset === 1 ? `TOMORROW (+${offset})` : `(+${offset})`);
        }

        new OpenDailyNoteModal(this.app, items, (item) => {
            if (item.exists) {
                this.openDailyNote(generateDailyNotePath(item.date, this.settings));
            } else {
                this.createDailyNoteForDate(item.date);
            }
        }).open();
    }

    async goToPreviousDailyNote(newTab = false) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }
        if (!activeFile.path.startsWith(this.settings.baseDirectory)) {
            new Notice("Active file is not in the daily notes directory.");
            return;
        }
        const currentFileDate = window.moment(activeFile.path, this.settings.dateFormatPattern);
        if (!currentFileDate.isValid()) {
            return;
        }

        const previousDate = currentFileDate.clone().subtract(1, "day");
        const adjacentNote = await this.getDailyNote(previousDate);
        if (adjacentNote) {
            await this.app.workspace.getLeaf(newTab).openFile(adjacentNote);
            return;
        }

        // Adjacent day is missing — find the next existing note, then ask
        let nextExisting: TFile | null = null;
        let nextExistingDate: Moment | null = null;
        for (let i = 2; i <= this.MAX_SEARCH_ATTEMPTS; i++) {
            const date = currentFileDate.clone().subtract(i, "days");
            const dailyNote = await this.getDailyNote(date);
            if (dailyNote) {
                nextExisting = dailyNote;
                nextExistingDate = date;
                break;
            }
        }

        new MissingDailyNoteModal(
            this.app,
            previousDate.format("YYYY-MM-DD"),
            nextExistingDate?.format("YYYY-MM-DD") ?? null,
            "previous",
            async (action) => {
                if (action === "create") {
                    await this.createDailyNoteForDate(previousDate);
                } else if (nextExisting) {
                    await this.app.workspace.getLeaf(newTab).openFile(nextExisting);
                }
            }
        ).open();
    }

    async goToNextDailyNote() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            return;
        }

        if (!activeFile.path.startsWith(this.settings.baseDirectory)) {
            return;
        }

        const currentFileDate = window.moment(activeFile.path, this.settings.dateFormatPattern);
        if (!currentFileDate.isValid()) {
            return;
        }

        const nextDate = currentFileDate.clone().add(1, "day");
        const adjacentNote = await this.getDailyNote(nextDate);
        if (adjacentNote) {
            await this.app.workspace.getLeaf().openFile(adjacentNote);
            return;
        }

        // Adjacent day is missing — find the next existing note, then ask
        let nextExisting: TFile | null = null;
        let nextExistingDate: Moment | null = null;
        for (let i = 2; i <= this.MAX_SEARCH_ATTEMPTS; i++) {
            const date = currentFileDate.clone().add(i, "days");
            const dailyNote = await this.getDailyNote(date);
            if (dailyNote) {
                nextExisting = dailyNote;
                nextExistingDate = date;
                break;
            }
        }

        new MissingDailyNoteModal(
            this.app,
            nextDate.format("YYYY-MM-DD"),
            nextExistingDate?.format("YYYY-MM-DD") ?? null,
            "next",
            async (action) => {
                if (action === "create") {
                    await this.createDailyNoteForDate(nextDate);
                } else if (nextExisting) {
                    await this.app.workspace.getLeaf().openFile(nextExisting);
                }
            }
        ).open();
    }
}
