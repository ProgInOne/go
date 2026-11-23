import {
  addDays,
  startOfLocalDay,
  type DayBoundary,
  type EngineDeps,
  type Goal,
  type LessonEstimate,
  type LessonTiming,
} from '@proginone/learning-engine';
import type { GoalView } from '@proginone/shared';
import {
  type ContentRepository,
  type CourseLessonEstimate,
  type LessonKind,
} from '../../db/content/repository.ts';
import type { Orm } from '../../db/user/connection.ts';
import { currentGoal, goalHistory, type GoalRow } from '../../db/user/goals.ts';
import { listItems } from '../../db/user/practice-sets.ts';
import {
  listCompletedLessonTimes,
  listLessonProgress,
  type LessonProgressRow,
} from '../../db/user/progress.ts';
import { progressOf } from '../practice/views.ts';

// Inputs of the planning functions (goals, pace, today's plan) read from user.db/content.db.

/** The current goal as the engine sees it (defaults when none is set). */
export function engineGoal(engine: EngineDeps, row: GoalRow | null): Goal {
  return row
    ? {
        dailyMinutes: row.dailyMinutes,
        weeklyDays: row.weeklyDays,
        targetCourseId: row.targetCourseId,
        targetDate: row.targetDate,
      }
    : {
        dailyMinutes: engine.config.goals.defaultDailyMinutes,
        weeklyDays: engine.config.goals.defaultWeeklyDays,
        targetCourseId: null,
        targetDate: null,
      };
}

export function loadGoal(engine: EngineDeps, orm: Orm, learnerId: string) {
  const row = currentGoal(orm, learnerId);
  return { row, goal: engineGoal(engine, row) };
}

export function goalView(repo: ContentRepository, row: GoalRow | null, goal: Goal): GoalView {
  const course = goal.targetCourseId === null ? null : repo.getCourse(goal.targetCourseId);
  return {
    dailyMinutes: goal.dailyMinutes,
    weeklyDays: goal.weeklyDays,
    targetCourse:
      goal.targetCourseId === null
        ? null
        : { id: goal.targetCourseId, title: course?.title ?? goal.targetCourseId },
    targetDate: goal.targetDate,
    effectiveFrom: row?.effectiveFrom.getTime() ?? null,
    isDefault: row === null,
  };
}

/**
 * The goal that applied on each learner-local date: the latest goal started before the end of
 * that day (defaults before the first goal).
 */
export function goalOnDate(
  engine: EngineDeps,
  orm: Orm,
  learnerId: string,
  dayBoundary: DayBoundary,
) {
  const history = goalHistory(orm, learnerId);
  return (date: string) => {
    const end = startOfLocalDay(addDays(date, 1), dayBoundary);
    const row = history.filter((g) => g.effectiveFrom.getTime() < end).at(-1) ?? null;
    const goal = engineGoal(engine, row);
    return { dailyMinutes: goal.dailyMinutes, weeklyDays: goal.weeklyDays };
  };
}

/**
 * Engine lesson estimate from the content estimate and the learner's progress. Project lessons
 * (milestone progress) need Go execution and are not served yet (G-001).
 */
export function lessonEstimate(
  orm: Orm,
  lesson: CourseLessonEstimate,
  progress: LessonProgressRow | undefined,
): LessonEstimate {
  let practiceProgress = 0;
  if (progress?.status === 'practicing' && progress.practiceSetId) {
    const p = progressOf(listItems(orm, progress.practiceSetId));
    practiceProgress = p.total === 0 ? 0 : (p.answered + p.skipped) / p.total;
  }
  return {
    lessonId: lesson.id,
    estimatedMinutes: lesson.estimatedMinutes,
    readMinutes: lesson.readMinutes,
    status: progress?.status ?? 'not_started',
    readProgress: progress?.readProgress ?? 0,
    practiceProgress,
  };
}

/**
 * Every lesson of a course with the learner's progress, in reading order. `kinds` as in
 * `listCourseLessons` (lessons only by default: the pace).
 */
export function courseLessonEstimates(
  repo: ContentRepository,
  orm: Orm,
  learnerId: string,
  courseId: string,
  kinds?: readonly LessonKind[],
) {
  const lessons = repo.listCourseLessons(courseId, kinds);
  const progress = new Map(
    listLessonProgress(
      orm,
      learnerId,
      lessons.map((l) => l.id),
    ).map((p) => [p.lessonId, p]),
  );
  return lessons.map((lesson) => ({
    lesson,
    progress: progress.get(lesson.id),
    estimate: lessonEstimate(orm, lesson, progress.get(lesson.id)),
  }));
}

/**
 * Estimated and actual minutes of every completed lesson with a recorded time, in any course
 * (FR-GOAL-02): the calibration reflects the learner's speed, not one course. Only `kind: lesson`
 * units count, like the pace itself; lessons gone from content.db are left out.
 */
export function completedLessonTimings(
  repo: ContentRepository,
  orm: Orm,
  learnerId: string,
): LessonTiming[] {
  const times = listCompletedLessonTimes(orm, learnerId);
  const estimates = repo.getLessonEstimates(times.map((t) => t.lessonId));
  return times.flatMap((t) => {
    const lesson = estimates.get(t.lessonId);
    if (lesson?.kind !== 'lesson') return [];
    return [{ estimatedMinutes: lesson.estimatedMinutes, actualMinutes: t.activeMs / 60_000 }];
  });
}
