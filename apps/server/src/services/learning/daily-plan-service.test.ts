import { describe, expect, it } from 'vitest';
import { courseSearchOrder } from './daily-plan-service.ts';

describe('courseSearchOrder', () => {
  const ids = ['html', 'css', 'go-basics'];

  it('looks in the latest course first, then the following ones, then the earlier ones', () => {
    expect(courseSearchOrder(ids, 'html')).toEqual(['html', 'css', 'go-basics']);
    expect(courseSearchOrder(ids, 'css')).toEqual(['css', 'go-basics', 'html']);
    expect(courseSearchOrder(ids, 'go-basics')).toEqual(['go-basics', 'html', 'css']);
  });

  it('starts from the first course without a known start', () => {
    expect(courseSearchOrder(ids, null)).toEqual(ids);
    expect(courseSearchOrder(ids, 'gone')).toEqual(ids);
    expect(courseSearchOrder([], null)).toEqual([]);
  });
});
