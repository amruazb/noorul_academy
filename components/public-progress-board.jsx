'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  aggregateEntries,
  endOfMonth,
  endOfWeek,
  flattenLocalDailyProgress,
  formatCourseLabel,
  formatDisplayDate,
  mergeDailyEntries,
  performanceLabel,
  startOfMonth,
  startOfWeek,
  todayIsoDate
} from '@/lib/daily-progress';
import { loadJson } from '@/lib/storage';

function StudentProgressCard({ student, dailyEntries, progressByStudent, rangeBounds }) {
  const studentEntries = dailyEntries.filter((entry) => String(entry.studentId) === String(student.id));
  const totals = aggregateEntries(studentEntries, rangeBounds);
  const juzProgress = progressByStudent[String(student.id)]?.juz || {};
  const completedJuz = Object.values(juzProgress).filter((state) => state === 'completed').length;
  const recentEntries = studentEntries
    .filter((entry) => entry.progressDate >= rangeBounds.from && entry.progressDate <= rangeBounds.to)
    .sort((left, right) => right.progressDate.localeCompare(left.progressDate));
  const todayEntry = studentEntries.find((entry) => entry.progressDate === todayIsoDate());

  return (
    <article className="parent-student-card">
      <div className="parent-student-head">
        <div>
          <h3>{student.name}</h3>
          <p>{formatCourseLabel(student.course)} · {student.className || 'Class not set'} · Teacher: {student.teacher || '—'}</p>
        </div>
        <span className={`performance-badge performance-${todayEntry?.performance || 'average'}`}>
          {todayEntry ? performanceLabel(todayEntry.performance || 'average') : 'NO REPORT'}
        </span>
      </div>

      <div className="parent-metrics-grid">
        <div className="parent-metric"><span>Ayats learned</span><strong>{totals.ayatsLearned}</strong></div>
        <div className="parent-metric"><span>Lines achieved</span><strong>{totals.achievedLines}</strong></div>
        <div className="parent-metric"><span>Attendance</span><strong>{totals.attendanceRate}%</strong></div>
        <div className="parent-metric"><span>Juz completed</span><strong>{completedJuz}/30</strong></div>
      </div>

      <div className="parent-progress-bar-wrap">
        <div className="progress-bar" style={{ width: `${Math.round((completedJuz / 30) * 100)}%` }} />
      </div>

      {todayEntry ? (
        <div className="today-progress-row">
          <span>Today</span>
          <span>{todayEntry.attendance ? 'Present' : 'Absent'}</span>
          <span>{todayEntry.ayatsLearned || 0} ayats</span>
          <span>{todayEntry.achievedLines || 0} lines</span>
        </div>
      ) : null}

      <div className="parent-recent-list">
        <h4>Recent Daily Reports</h4>
        {recentEntries.length ? recentEntries.slice(0, 5).map((entry) => (
          <div key={`${student.id}-${entry.progressDate}`} className="parent-recent-row">
            <div>
              <strong>{formatDisplayDate(entry.progressDate)}</strong>
              <span>{entry.attendance ? 'Present' : 'Absent'} · {entry.ayatsLearned || 0} ayats · {entry.achievedLines || 0} lines</span>
            </div>
            <span className={`performance-badge performance-${entry.performance || 'average'}`}>
              {performanceLabel(entry.performance || 'average')}
            </span>
          </div>
        )) : (
          <p className="empty-state">No daily reports recorded yet for this period.</p>
        )}
      </div>
    </article>
  );
}

export default function PublicProgressBoard({ students, progressByStudent, compact = false }) {
  const [dailyEntries, setDailyEntries] = useState([]);
  const [reportRange, setReportRange] = useState(compact ? 'daily' : 'weekly');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [loading, setLoading] = useState(true);

  const activeStudents = useMemo(() => (
    students.filter((student) => student.status !== 'Inactive')
  ), [students]);

  const courseOptions = useMemo(() => {
    const values = [...new Set(activeStudents.map((student) => formatCourseLabel(student.course)))];
    return values.sort();
  }, [activeStudents]);

  const referenceDate = todayIsoDate();
  const rangeBounds = useMemo(() => {
    if (reportRange === 'monthly') {
      return { from: startOfMonth(referenceDate), to: endOfMonth(referenceDate) };
    }
    if (reportRange === 'daily') {
      return { from: referenceDate, to: referenceDate };
    }
    return { from: startOfWeek(referenceDate), to: endOfWeek(referenceDate) };
  }, [referenceDate, reportRange]);

  useEffect(() => {
    let cancelled = false;

    async function loadProgress() {
      setLoading(true);
      const localEntries = flattenLocalDailyProgress(loadJson('na_daily_progress', {}));

      try {
        const response = await fetch('/api/daily-progress');
        const payload = response.ok ? await response.json() : null;
        const remoteEntries = Array.isArray(payload?.entries) ? payload.entries : [];
        if (!cancelled) {
          setDailyEntries(mergeDailyEntries(remoteEntries, localEntries));
        }
      } catch {
        if (!cancelled) setDailyEntries(localEntries);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, []);

  const groupedStudents = useMemo(() => {
    const filtered = activeStudents.filter((student) => (
      !selectedCourse || formatCourseLabel(student.course) === selectedCourse
    ));
    const groups = {};
    for (const student of filtered) {
      const label = formatCourseLabel(student.course);
      if (!groups[label]) groups[label] = [];
      groups[label].push(student);
    }
    return groups;
  }, [activeStudents, selectedCourse]);

  return (
    <section className={`parent-progress-page ${compact ? 'compact-progress-board' : ''}`}>
      <div className="parent-progress-shell">
        {!compact ? (
          <SectionIntro
            label="Student Progress"
            title="Daily Learning Dashboard"
            subtitle="Parents can view every student's daily, weekly, and monthly progress here — no sign-in required."
          />
        ) : null}

        <div className="public-progress-toolbar">
          <div className="report-range-tabs parent-range-tabs">
            {['daily', 'weekly', 'monthly'].map((range) => (
              <button
                key={range}
                type="button"
                className={`report-range-tab ${reportRange === range ? 'active' : ''}`}
                onClick={() => setReportRange(range)}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          {!compact ? (
            <label className="form-field compact course-filter-field">
              <span>COURSE</span>
              <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}>
                <option value="">All courses</option>
                {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
              </select>
            </label>
          ) : null}
        </div>

        <p className="report-range-caption">
          {reportRange.charAt(0).toUpperCase() + reportRange.slice(1)} view for {formatDisplayDate(rangeBounds.from)}
          {rangeBounds.from !== rangeBounds.to ? ` to ${formatDisplayDate(rangeBounds.to)}` : ''}
        </p>

        {loading ? <div className="alert alert-info">Loading student progress…</div> : null}

        {!loading && !activeStudents.length ? (
          <div className="alert alert-info">No enrolled students yet. Progress will appear here after daily reports are saved.</div>
        ) : null}

        {Object.entries(groupedStudents).map(([courseLabel, courseStudents]) => (
          <div key={courseLabel} className="course-progress-section">
            <div className="course-progress-heading">
              <span className="course-progress-badge">{courseLabel}</span>
              <span>{courseStudents.length} student{courseStudents.length === 1 ? '' : 's'}</span>
            </div>
            <div className="parent-student-grid">
              {courseStudents.map((student) => (
                <StudentProgressCard
                  key={student.id}
                  student={student}
                  dailyEntries={dailyEntries}
                  progressByStudent={progressByStudent}
                  rangeBounds={rangeBounds}
                />
              ))}
            </div>
          </div>
        ))}

        {!compact && !loading && activeStudents.length ? (
          <div className="public-progress-footnote">
            <button className="btn-outline" type="button" onClick={() => window.location.reload()}>Refresh Progress</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SectionIntro({ label, title, subtitle }) {
  return (
    <div>
      <span className="section-label">{label}</span>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="section-sub">{subtitle}</p> : null}
      <div className="section-divider" />
    </div>
  );
}
