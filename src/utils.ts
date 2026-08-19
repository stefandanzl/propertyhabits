import type { Moment } from "moment";
import { HabitConfig, HabitData, HabitStats, PluginSettings, MultitextValueData, DayData } from "./types";

export function handleError(message: string, context?: unknown) {
    console.error(`[Habit Tracker] ${message}`, context);
    // Note: Notice creation should be done from the plugin context
}

export function processPropertyValue(widget: string, rawValue: unknown): boolean | number | string | null {
    // Handle undefined/null values - these mean the property doesn't exist in the note
    if (rawValue === undefined || rawValue === null) {
        if (widget === "number" || widget === "multitext") {
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
            return NaN;

        case "multitext":
            // Count the number of items in the list/array
            if (Array.isArray(rawValue)) {
                return rawValue.length;
            }
            handleError(`Invalid multitext value: ${rawValue}`);
            return 0;

        case "text":
            if (typeof rawValue === "string") return rawValue.trim();
            handleError(`Invalid text value: ${rawValue}`);
            return null;

        default:
            handleError(`Unsupported widget type: ${widget}`);
            return null;
    }
}

/**
 * Counts how many of the goal values are present in the day's values
 * (verbatim, case-sensitive comparison — goal values should be picked from
 * the values that actually occur in the vault, not typed freehand)
 */
export function countGoalMatches(dayValues: string[] | undefined, goalValues: string[]): number {
    if (!dayValues || goalValues.length === 0) return 0;
    return goalValues.filter((goal) => dayValues.includes(goal)).length;
}

export function generateDailyNotePath(momentDate: Moment, settings: PluginSettings): string {
    // const momentDate = moment(date);
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

export function calculateHabitStats(habitData: HabitData, habitConfig: HabitConfig): HabitStats {
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

    // Goal-based evaluation accumulators (multitext goal mode / text habits)
    let goalRatioSum = 0;
    let goalDays = 0;

    // First pass: calculate daily success/failure going forward
    for (let i = 0; i < habitData.length; i++) {
        const value = habitData[i]?.habits[habitName];
        // const date = habitData[i]?.date;
        let isSuccess = false;

        // console.log(`[DEBUG] Day ${i} (${date}): value=${value}`);

        // if (value !== null && value !== undefined) {
        if (value !== null && value !== undefined) {
            validValues++;

            if (habitConfig.widget === "text") {
                if (habitConfig.evalMode === "notempty") {
                    // Any non-empty value counts as success
                    isSuccess = typeof value === "string" && value.length > 0;
                } else {
                    // Exact match against the configured acceptable values
                    const goalValues = habitConfig.goalValues ?? [];
                    isSuccess = goalValues.length > 0 && countGoalMatches([String(value)], goalValues) > 0;
                }
                if (isSuccess) totalValue += 1;
            } else if (habitConfig.widget === "multitext" && habitConfig.evalMode === "goal") {
                // Success = all goal values present; partial matches feed the ratio
                const goalValues = habitConfig.goalValues ?? [];
                if (goalValues.length > 0) {
                    const matched = countGoalMatches(habitData[i]?.multitextValues?.[habitName], goalValues);
                    goalRatioSum += matched / goalValues.length;
                    goalDays++;
                    totalValue += matched;
                    isSuccess = matched === goalValues.length;
                }
            } else if (habitConfig.widget === "checkbox") {
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
                    const expectedProgress = (habitConfig.target / totalDays) * daysElapsed;
                    isSuccess = forwardTotalValue >= expectedProgress;
                } else {
                    // For daily targets
                    isSuccess = numValue >= habitConfig.target;
                }
            } else if (habitConfig.widget === "multitext") {
                const numValue = value as number;
                forwardTotalValue += numValue;
                totalValue += numValue;

                if (habitConfig.target !== undefined) {
                    if (habitConfig.isTotal) {
                        // For total targets, check if we're on track so far
                        const daysElapsed = i + 1;
                        const expectedProgress = (habitConfig.target / totalDays) * daysElapsed;
                        isSuccess = forwardTotalValue >= expectedProgress;
                    } else {
                        // For daily targets
                        isSuccess = numValue >= habitConfig.target;
                    }
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
    const successRate = totalDays > 0 ? Math.round((successfulDays / totalDays) * 100) : 0;
    const averageValue = validValues > 0 ? totalValue / validValues : undefined;

    let targetAchievement: number | undefined;
    if (habitConfig.widget === "multitext" && habitConfig.evalMode === "goal" && goalDays > 0) {
        // Average share of the goal set achieved per day
        targetAchievement = Math.round((goalRatioSum / goalDays) * 100);
    } else if (habitConfig.widget === "text") {
        targetAchievement = successRate;
    } else if (habitConfig.widget === "number" && habitConfig.target) {
        if (habitConfig.isTotal) {
            targetAchievement = Math.round((totalValue / habitConfig.target) * 100);
        } else {
            targetAchievement = averageValue ? Math.round((averageValue / habitConfig.target) * 100) : 0;
        }
    } else if (habitConfig.widget === "multitext") {
        if (habitConfig.target !== undefined) {
            if (habitConfig.isTotal) {
                targetAchievement = Math.round((totalValue / habitConfig.target) * 100);
            } else {
                targetAchievement = averageValue ? Math.round((averageValue / habitConfig.target) * 100) : 0;
            }
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

export function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Extracts unique multitext values from habit data with their counts and first occurrence index
 */
export function extractMultitextValues(habitData: HabitData, propertyName: string, sortMode: "alphabetical" | "frequency" | "first_occurrence", limitValues?: number): MultitextValueData[] {
    const valueMap = new Map<string, { count: number; firstIndex: number }>();

    // First pass: collect counts and first occurrence indices
    habitData.forEach((day, index) => {
        const values = day?.multitextValues?.[propertyName];
        if (Array.isArray(values)) {
            values.forEach((value) => {
                const strValue = String(value);
                if (!valueMap.has(strValue)) {
                    valueMap.set(strValue, {
                        count: 0,
                        firstIndex: index,
                    });
                }
                const entry = valueMap.get(strValue);
                if (entry) {
                    entry.count++;
                }
            });
        }
    });

    // Convert to array and sort
    let result: MultitextValueData[] = Array.from(valueMap.entries()).map(([value, data]) => ({
        value,
        count: data.count,
        firstOccurrenceIndex: data.firstIndex,
    }));

    // Sort based on mode
    switch (sortMode) {
        case "alphabetical":
            result.sort((a, b) => a.value.localeCompare(b.value));
            break;
        case "frequency":
            result.sort((a, b) => b.count - a.count);
            break;
        case "first_occurrence":
            result.sort((a, b) => a.firstOccurrenceIndex - b.firstOccurrenceIndex);
            break;
    }

    // Apply limit if specified
    if (limitValues && limitValues > 0) {
        result = result.slice(0, limitValues);
    }

    return result;
}

/**
 * Checks if a specific multitext value is present in a day's data
 */
export function hasMultitextValue(dayData: DayData, propertyName: string, valueToCheck: string): boolean {
    const values = dayData?.multitextValues?.[propertyName];
    if (!Array.isArray(values)) {
        return false;
    }
    return values.some((v) => String(v) === valueToCheck);
}

/**
 * Extracts ordered multitext values for ordered entries mode.
 * Returns a 2D array where each day has an array of its values in order.
 */
export function extractOrderedMultitextValues(habitData: HabitData, propertyName: string): (string[] | null)[] {
    return habitData.map((day) => {
        const values = day?.multitextValues?.[propertyName];
        if (Array.isArray(values) && values.length > 0) {
            return values.map((v) => String(v));
        }
        return null;
    });
}
