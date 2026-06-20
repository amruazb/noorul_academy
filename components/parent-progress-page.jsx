'use client';

import { useMemo, useState } from 'react';
import {
  aggregateEntries,
  endOfMonth,
  endOfWeek,
  formatDisplayDate,
  performanceLabel,
  startOfMonth,
  startOfWeek,
  todayIsoDate
} from '@/lib/daily-progress';

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export default function ParentProgressPage({ students, progressByStudent }) {
  const [phone, setPhone] = useState('');
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [reportRange, setReportRange] = useState('weekly');
  const [dailyEntries, setDailyEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const matchedStudents = useMemo(() => {
    const query = normalizePhone(submittedPhone);
    if (!query) return [];
    return students.filter((student) => normalizePhone(student.phone).includes(query));
  }, [students, submittedPhone]);

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

  function handleLookup(event) {
    event.preventDefault();
    const trimmedPhone = phone.trim();
    setSubmittedPhone(trimmedPhone);
    setLookupError(null);
    setLoading(true);

    fetch(`/api/daily-progress?phone=${encodeURIComponent(trimmedPhone)}`)
      .then(async (response) => {
        const payload = response.ok ? await response.json() : null;
        const remoteEntries = Array.isArray(payload?.entries) ? payload.entries : [];
        if (remoteEntries.length) {
          setDailyEntries(remoteEntries);
          return;
        }

        const localCache = typeof window !== 'undefined'
          ? JSON.parse(window.localStorage.getItem('na_daily_progress') || '{}')
          : {};
        const localEntries = Object.entries(localCache).flatMap(([progressDate, entriesByStudent]) => (
          Object.entries(entriesByStudent).map(([studentId, entry]) => ({
            ...entry,
            studentId: Number(studentId),
            progressDate
          }))
        ));
        setDailyEntries(localEntries);
      })
      .catch(() => {
        setDailyEntries([]);
        setLookupError('Could not load progress data. Please try again.');
      })
      .finally(() => setLoading(false));
  }

  return (
    <section className="parent-progress-page">
      <div className="parent-progress-shell">
        <SectionIntro
          label="Parent Portal"
          title="Track Your Child's Progress"
          subtitle="Enter the phone number used during enrolment to view daily, weekly, and monthly learning progress."
        />

        <form className="parent-lookup-form" onSubmit={handleLookup}>
          <label className="form-field">
            <span>Parent / Guardian Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. +91 89438 38168"
            />
          </label>
          <button className="btn-primary" type="submit">View Progress</button>
        </form>

        {loading ? <div className="alert alert-info">Loading progress data…</div> : null}
        {lookupError ? <div className="alert alert-error">{lookupError}</div> : null}

        {submittedPhone && !loading && !matchedStudents.length ? (
          <div className="alert alert-error">No students found for this phone number. Please check the number and try again.</div>
        ) : null}

        {matchedStudents.length ? (
          <>
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
            <p className="report-range-caption">
              {reportRange.charAt(0).toUpperCase() + reportRange.slice(1)} view for {formatDisplayDate(rangeBounds.from)}
              {rangeBounds.from !== rangeBounds.to ? ` to ${formatDisplayDate(rangeBounds.to)}` : ''}
            </p>

            <div className="parent-student-grid">
              {matchedStudents.map((student) => {
                const studentEntries = dailyEntries.filter((entry) => String(entry.studentId) === String(student.id));
                const totals = aggregateEntries(studentEntries, rangeBounds);
                const juzProgress = progressByStudent[String(student.id)]?.juz || {};
                const completedJuz = Object.values(juzProgress).filter((state) => state === 'completed').length;
                const recentEntries = studentEntries
                  .filter((entry) => entry.progressDate >= rangeBounds.from && entry.progressDate <= rangeBounds.to)
                  .sort((left, right) => right.progressDate.localeCompare(left.progressDate));

                return (
                  <article key={student.id} className="parent-student-card">
                    <div className="parent-student-head">
                      <div>
                        <h3>{student.name}</h3>
                        <p>{student.course} · {student.className || 'Class not set'} · Teacher: {student.teacher || '—'}</p>
                      </div>
                      <span className="badge badge-green">{student.status || 'Active'}</span>
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

                    <div className="parent-recent-list">
                      <h4>Recent Daily Reports</h4>
                      {recentEntries.length ? recentEntries.slice(0, 7).map((entry) => (
                        <div key={`${student.id}-${entry.progressDate}`} className="parent-recent-row">
                          <div>
                            <strong>{formatDisplayDate(entry.progressDate)}</strong>
                            <span>{entry.attendance ? 'Present' : 'Absent'} · {entry.ayatsLearned || 0} ayats</span>
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
              })}
            </div>
          </>
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
