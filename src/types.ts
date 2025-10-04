// Types and interfaces for the Habit Tracker plugin

export interface HabitConfig {
	propertyName: string;
	displayName: string;
	widget: "checkbox" | "number" | "multitext";
	target?: number;
	isTotal: boolean;
	order: number;
	ignored: boolean;
}

export interface PluginSettings {
	baseDirectory: string;
	dateFormatPattern: string;
	dailyNoteTemplate: string;
	selectedTimeSpan: string;
	trackedHabits: HabitConfig[];
	showStreaks: boolean;
	refreshInterval: number;
	scrollToTop: boolean;
	scrollToTopInterval: number;
}

export interface Habits {
	[habitName: string]: boolean | number | null;
}

export interface DayData {
	date: string;
	filePath: string;
	exists: boolean;
	habits: Habits;
}

export type HabitData = Array<DayData>;

export interface HabitStats {
	habitName: string;
	totalDays: number;
	successfulDays: number;
	successRate: number;
	currentStreak: number;
	longestStreak: number;
	averageValue?: number;
	totalValue?: number;
	targetAchievement?: number;
}

export interface TimeSpanOption {
	label: string;
	days: number;
	key: string;
}

export const TIME_SPANS: TimeSpanOption[] = [
	{ label: "7 Days", days: 7, key: "week" },
	{ label: "21 Days", days: 21, key: "21days" },
	{ label: "30 Days", days: 30, key: "month" },
	// { label: "90 Days", days: 90, key: "quarter" }
];

export const DEFAULT_SETTINGS: PluginSettings = {
	baseDirectory: "Journal",
	dateFormatPattern: "YYYY/YYYY-MM/YYYY-MM-DD dddd",
	dailyNoteTemplate: "",
	selectedTimeSpan: "21days",
	trackedHabits: [],
	showStreaks: true,
	refreshInterval: 1000,
	scrollToTop: true,
	scrollToTopInterval: 0,
};

export const VIEW_TYPE_HABIT_TRACKER = "habit-tracker-view";
