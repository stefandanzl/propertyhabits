import { moment } from "obsidian";
import { HabitConfig, HabitData, HabitStats, PluginSettings } from "./types";

export function handleError(message: string, context?: unknown) {
	console.error(`[Habit Tracker] ${message}`, context);
	// Note: Notice creation should be done from the plugin context
}

export function processPropertyValue(
	widget: string,
	rawValue: unknown
): boolean | number | null {
	// Handle undefined/null values - these mean the property doesn't exist in the note
	if (rawValue === undefined || rawValue === null) {
		if (widget === "number") {
			return 0;
		}
		return null;
	}

	switch (widget) {
		case "checkbox":
			if (typeof rawValue === "boolean") return rawValue;
			if (rawValue === "true") return true;
			if (rawValue === "false") return false;
			handleError(`Invalid checkbox value: ${rawValue}`);
			return null;

		case "number":
			// eslint-disable-next-line no-case-declarations
			const num = Number(rawValue);
			if (!isNaN(num)) return num;
			handleError(`Invalid number value: ${rawValue}`);
			return null;

		default:
			handleError(`Unsupported widget type: ${widget}`);
			return null;
	}
}

export function generateDailyNotePath(
	date: Date,
	settings: PluginSettings
): string {
	const momentDate = moment(date);
	const formattedPath = momentDate.format(settings.dateFormatPattern);
	return `${settings.baseDirectory}/${formattedPath}.md`;
}

export function getSuccessColor(percentage: number): string {
	if (percentage >= 90) return "#22c55e"; // Green-500
	if (percentage >= 75) return "#65a30d"; // Lime-600
	if (percentage >= 50) return "#eab308"; // Yellow-500
	if (percentage >= 25) return "#f97316"; // Orange-500
	return "#ef4444"; // Red-500
}

export function getSuccessClass(percentage: number): string {
	if (percentage >= 75) return "success-high";
	if (percentage >= 50) return "success-medium";
	return "success-low";
}

export function formatNumericHabit(value: number, target: number): string {
	const percentage = Math.round((value / target) * 100);
	return `${value}/${target} (${percentage}%)`;
}

export function calculateHabitStats(
	habitData: HabitData,
	habitConfig: HabitConfig
): HabitStats {
	const habitName = habitConfig.propertyName;
	const totalDays = habitData.length;
	let successfulDays = 0;
	let currentStreak = 0;
	let longestStreak = 0;
	let tempStreak = 0;
	let totalValue = 0;
	let validValues = 0;

	// Calculate forward for proper total accumulation, then backward for streaks
	let forwardTotalValue = 0;
	const dailySuccessResults: boolean[] = new Array(habitData.length);

	// First pass: calculate daily success/failure going forward
	for (let i = 0; i < habitData.length; i++) {
		const value = habitData[i]?.habits[habitName];
		// const date = habitData[i]?.date;
		let isSuccess = false;

		// console.log(`[DEBUG] Day ${i} (${date}): value=${value}`);

		// if (value !== null && value !== undefined) {
		if (value !== null && value !== undefined) {
			validValues++;

			if (habitConfig.widget === "checkbox") {
				const boolValue = value as boolean;
				const targetIsChecked = (habitConfig.target || 1) === 1;
				isSuccess = boolValue === targetIsChecked;
				totalValue += isSuccess ? 1 : 0;
			} else if (habitConfig.widget === "number" && habitConfig.target) {
				const numValue = value as number;
				forwardTotalValue += numValue;
				totalValue += numValue;

				if (habitConfig.isTotal) {
					// For total targets, check if we're on track so far
					const daysElapsed = i + 1;
					const expectedProgress =
						(habitConfig.target / totalDays) * daysElapsed;
					isSuccess = forwardTotalValue >= expectedProgress;
				} else {
					// For daily targets
					isSuccess = numValue >= habitConfig.target;
				}
			}
		}

		dailySuccessResults[i] = isSuccess;
		// console.debug(`[DEBUG] Day ${i} (${date}): isSuccess=${isSuccess}`);
		if (isSuccess) {
			successfulDays++;
		}
	}

	// Second pass: calculate streaks going backward
	for (let i = habitData.length - 1; i >= 0; i--) {
		const isSuccess = dailySuccessResults[i];

		if (isSuccess) {
			tempStreak++;
			if (i === habitData.length - 1) {
				currentStreak = tempStreak;
			}
		} else {
			if (i === habitData.length - 1) {
				currentStreak = 0;
			}
			longestStreak = Math.max(longestStreak, tempStreak);
			tempStreak = 0;
		}
	}

	longestStreak = Math.max(longestStreak, tempStreak);
	const successRate =
		totalDays > 0 ? Math.round((successfulDays / totalDays) * 100) : 0;
	const averageValue = validValues > 0 ? totalValue / validValues : undefined;

	let targetAchievement: number | undefined;
	if (habitConfig.widget === "number" && habitConfig.target) {
		if (habitConfig.isTotal) {
			targetAchievement = Math.round(
				(totalValue / habitConfig.target) * 100
			);
		} else {
			targetAchievement = averageValue
				? Math.round((averageValue / habitConfig.target) * 100)
				: 0;
		}
	}

	return {
		habitName,
		totalDays,
		successfulDays,
		successRate,
		currentStreak,
		longestStreak,
		averageValue,
		totalValue,
		targetAchievement,
	};
}

export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(this, args), wait);
	};
}
