import { describe, it, expect } from 'vitest';
import { getMonthGridWeeks } from '../../src/lib/monthGrid';

describe('getMonthGridWeeks', () => {
	it('pads the first week with leading nulls to the 1st weekday', () => {
		// 2026-01-01 is a Thursday (getDay 4)
		const weeks = getMonthGridWeeks(2026, 0);
		expect(weeks[0]).toEqual([null, null, null, null, 1, 2, 3]);
	});

	it('needs no padding when the month starts on Sunday', () => {
		// 2026-02-01 is a Sunday, 28 days -> exactly 4 full weeks
		const weeks = getMonthGridWeeks(2026, 1);
		expect(weeks).toHaveLength(4);
		expect(weeks[0][0]).toBe(1);
		expect(weeks.flat().every((d) => d !== null)).toBe(true);
	});

	it('every row has 7 cells and the days appear once, in order', () => {
		for (let month = 0; month < 12; month++) {
			const weeks = getMonthGridWeeks(2026, month);
			const daysInMonth = new Date(2026, month + 1, 0).getDate();
			for (const week of weeks) {
				expect(week).toHaveLength(7);
			}
			const days = weeks.flat().filter((d): d is number => d !== null);
			expect(days).toEqual(Array.from({ length: daysInMonth }, (_, i) => i + 1));
		}
	});
});
