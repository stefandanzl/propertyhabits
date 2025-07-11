import { moment, TFile } from 'obsidian';
import { HabitConfig, HabitData, HabitStats, PluginSettings } from './types';

export function handleError(message: string, context?: any) {
	console.error(`[Habit Tracker] ${message}`, context);
	// Note: Notice creation should be done from the plugin context
}

export function processPropertyValue(widget: string, rawValue: any): boolean | number | null {
	switch (widget) {
		case 'checkbox':
			if (typeof rawValue === 'boolean') return rawValue;
			if (rawValue === 'true') return true;
			if (rawValue === 'false') return false;
			handleError(`Invalid checkbox value: ${rawValue}`);
			return null;
			
		case 'number':
			const num = Number(rawValue);
			if (!isNaN(num)) return num;
			handleError(`Invalid number value: ${rawValue}`);
			return null;
			
		default:
			handleError(`Unsupported widget type: ${widget}`);
			return null;
	}
}

export function generateDailyNotePath(date: Date, settings: PluginSettings): string {
	const momentDate = moment(date);
	const formattedPath = momentDate.format(settings.dateFormatPattern);
	return `${settings.baseDirectory}/${formattedPath}.md`;
}

export function getFilesInDateRange(
	startDate: Date, 
	endDate: Date, 
	settings: PluginSettings, 
	allFiles: TFile[]
): string[] {
	const filePaths: string[] = [];
	const current = moment(startDate);
	const end = moment(endDate);
	
	while (current.isSameOrBefore(end)) {
		const expectedPath = generateDailyNotePath(current.toDate(), settings);
		filePaths.push(expectedPath);
		current.add(1, 'day');
	}
	
	// Filter to only existing files
	return filePaths.filter(path => 
		allFiles.some(file => file.path === path)
	);
}

export function getSuccessColor(percentage: number): string {
	if (percentage >= 90) return '#22c55e';  // Green-500
	if (percentage >= 75) return '#65a30d';  // Lime-600
	if (percentage >= 50) return '#eab308';  // Yellow-500
	if (percentage >= 25) return '#f97316';  // Orange-500
	return '#ef4444';                        // Red-500
}

export function getSuccessClass(percentage: number): string {
	if (percentage >= 75) return 'success-high';
	if (percentage >= 50) return 'success-medium';
	return 'success-low';
}

export function formatNumericHabit(value: number, target: number): string {
	const percentage = Math.round((value / target) * 100);
	return `${value}/${target} (${percentage}%)`;
}

export function calculateHabitStats(
	habitData: HabitData, 
	habitConfig: HabitConfig, 
	dateRange: string[]
): HabitStats {
	const habitName = habitConfig.propertyName;
	const totalDays = dateRange.length;
	let successfulDays = 0;
	let currentStreak = 0;
	let longestStreak = 0;
	let tempStreak = 0;
	let totalValue = 0;
	let validValues = 0;
	
	// Calculate from most recent to oldest for current streak
	for (let i = dateRange.length - 1; i >= 0; i--) {
		const date = dateRange[i];
		const value = habitData[date]?.[habitName];
		
		let isSuccess = false;
		
		if (value !== null && value !== undefined) {
			validValues++;
			
			if (habitConfig.widget === 'checkbox') {
				isSuccess = value === true;
			} else if (habitConfig.widget === 'number' && habitConfig.target) {
				const numValue = value as number;
				totalValue += numValue;
				
				if (habitConfig.isTotal) {
					// For total targets, check if we're on track
					const expectedProgress = (habitConfig.target / totalDays) * (totalDays - i);
					isSuccess = totalValue >= expectedProgress;
				} else {
					// For daily targets
					isSuccess = numValue >= habitConfig.target;
				}
			}
		}
		
		if (isSuccess) {
			successfulDays++;
			tempStreak++;
			if (i === dateRange.length - 1) {
				currentStreak = tempStreak;
			}
		} else {
			if (i === dateRange.length - 1) {
				currentStreak = 0;
			}
			longestStreak = Math.max(longestStreak, tempStreak);
			tempStreak = 0;
		}
	}
	
	longestStreak = Math.max(longestStreak, tempStreak);
	const successRate = totalDays > 0 ? Math.round((successfulDays / totalDays) * 100) : 0;
	const averageValue = validValues > 0 ? totalValue / validValues : undefined;
	
	let targetAchievement: number | undefined;
	if (habitConfig.widget === 'number' && habitConfig.target) {
		if (habitConfig.isTotal) {
			targetAchievement = Math.round((totalValue / habitConfig.target) * 100);
		} else {
			targetAchievement = averageValue ? Math.round((averageValue / habitConfig.target) * 100) : 0;
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
		targetAchievement
	};
}

export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(this, args), wait);
	};
}
