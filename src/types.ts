// Types and interfaces for the Habit Tracker plugin

export interface HabitConfig {
	propertyName: string;
	displayName: string;
	widget: 'checkbox' | 'number';
	target?: number;
	isTotal: boolean;
	order: number;
	ignored: boolean;
}

export interface PluginSettings {
	baseDirectory: string;
	dateFormatPattern: string;
	selectedTimeSpan: string;
	trackedHabits: HabitConfig[];
	showStreaks: boolean;
	refreshInterval: number;
}

export interface HabitData {
	[date: string]: {
		[habitName: string]: boolean | number | null;
	};
}

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
	{ label: "90 Days", days: 90, key: "quarter" }
];

export const DEFAULT_SETTINGS: PluginSettings = {
	baseDirectory: "Journal",
	dateFormatPattern: "YYYY/YYYY-MM/YYYY-MM-DD dddd",
	selectedTimeSpan: "21days",
	trackedHabits: [],
	showStreaks: true,
	refreshInterval: 1000
};

export const VIEW_TYPE_HABIT_TRACKER = "habit-tracker-view";
