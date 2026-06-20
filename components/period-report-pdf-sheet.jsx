'use client';

import { forwardRef, useMemo } from 'react';
import {
  aggregateEntries,
  computePeriodPerformance,
  formatCourseLabel,
  formatDisplayDate,
  performanceLabel
} from '@/lib/daily-progress';

const PeriodReportPdfSheet = forwardRef(function PeriodReportPdfSheet({
  period,
  from,
  to,
  className,
  students,
  savedEntries
}, ref) {
  const groupedStudents = useMemo(() => {
    const groups = {};
    for (const student of students) {
      const label = formatCourseLabel(student.course);
      if (!groups[label]) groups[label] = [];
      groups[label].push(student);
    }
    return groups;
  }, [students]);

  const rowsByStudent = useMemo(() => {
    const map = {};
    for (const student of students) {
      const studentEntries = savedEntries.filter((entry) => String(entry.studentId) === String(student.id));
      const totals = aggregateEntries(studentEntries, { from, to });
      map[String(student.id)] = {
        totals,
        performance: computePeriodPerformance(totals)
      };
    }
    return map;
  }, [from, savedEntries, students, to]);

  const stats = useMemo(() => {
    const performances = students.map((student) => rowsByStudent[String(student.id)]?.performance || 'fail');
    const scoreMap = { excellent: 100, very_good: 85, good: 70, average: 55, fail: 30 };
    const averageScore = performances.length
      ? performances.reduce((sum, value) => sum + (scoreMap[value] || 0), 0) / performances.length
      : 0;
    const overallLabel = averageScore >= 90 ? 'EXCELLENT' : averageScore >= 75 ? 'VERY GOOD' : averageScore >= 60 ? 'GOOD' : averageScore >= 45 ? 'AVERAGE' : 'NEEDS IMPROVEMENT';
    const totalAyats = students.reduce((sum, student) => sum + (rowsByStudent[String(student.id)]?.totals.ayatsLearned || 0), 0);

    return {
      total: students.length,
      totalAyats,
      averageScore: averageScore.toFixed(2),
      overallLabel
    };
  }, [rowsByStudent, students]);

  const teacherName = students.find((student) => student.teacher)?.teacher || '—';
  const primaryCourse = students.length ? formatCourseLabel(students[0].course) : 'GENERAL';
  const classLabel = className || students.find((student) => student.className)?.className || 'All Classes';
  const periodTitle = period === 'weekly' ? 'WEEKLY CLASS REPORT' : 'MONTHLY CLASS REPORT';

  return (
    <div className="daily-report-pdf-sheet-wrap" aria-hidden="true">
      <div className="daily-report-pdf-sheet" ref={ref}>
        <div className="pdf-sheet-top">
          <div className="pdf-brand">NOORUL ACADEMY</div>
          <div className="pdf-title-block">
            <h1>{periodTitle} ({classLabel})</h1>
            <p>Noorul Academy — Online Quran &amp; Tajweed</p>
          </div>
          <div className="pdf-score-box">
            <strong>{stats.averageScore}%</strong>
            <span>{stats.overallLabel}</span>
          </div>
        </div>

        <div className="pdf-meta-row">
          <div><span>Subject</span><strong>{primaryCourse}</strong></div>
          <div><span>Class</span><strong>{classLabel}</strong></div>
          <div><span>Class Teacher</span><strong>{teacherName}</strong></div>
          <div><span>Period</span><strong>{formatDisplayDate(from)} - {formatDisplayDate(to)}</strong></div>
        </div>

        <div className="pdf-body-grid">
          <div className="pdf-table-wrap">
            {Object.entries(groupedStudents).map(([courseLabel, courseStudents]) => (
              <div key={courseLabel} className="pdf-course-block">
                <div className="pdf-course-heading">{courseLabel}</div>
                <table className="pdf-table pdf-period-table">
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>SUBJECT</th>
                      <th>DAYS</th>
                      <th>AYATS</th>
                      <th>LINES</th>
                      <th>ATTENDANCE</th>
                      <th>PRACTICE</th>
                      <th>PERFORMANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseStudents.map((student) => {
                      const row = rowsByStudent[String(student.id)] || { totals: {}, performance: 'fail' };
                      return (
                        <tr key={student.id}>
                          <td><strong>{student.name}</strong></td>
                          <td>{courseLabel}</td>
                          <td>{row.totals.days || 0}</td>
                          <td>{row.totals.ayatsLearned || 0}</td>
                          <td>{row.totals.achievedLines || 0}</td>
                          <td>{row.totals.attendanceRate || 0}%</td>
                          <td>{row.totals.practiceRate || 0}%</td>
                          <td className="pdf-col-performance">
                            <span className={`pdf-performance pdf-performance-${row.performance}`}>{performanceLabel(row.performance)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <aside className="pdf-sidebar">
            <div className="pdf-sidebar-card">
              <h3>Summary</h3>
              <div className="pdf-stat"><span>Total Students</span><strong>{stats.total}</strong></div>
              <div className="pdf-stat"><span>Total Ayats</span><strong>{stats.totalAyats}</strong></div>
              <div className="pdf-stat"><span>Overall Score</span><strong>{stats.averageScore}%</strong></div>
            </div>
            <div className="pdf-sidebar-card">
              <h3>Legend</h3>
              <div className="pdf-legend"><i className="pdf-dot excellent" /> Excellent</div>
              <div className="pdf-legend"><i className="pdf-dot very-good" /> Very Good</div>
              <div className="pdf-legend"><i className="pdf-dot good" /> Good</div>
              <div className="pdf-legend"><i className="pdf-dot average" /> Average</div>
              <div className="pdf-legend"><i className="pdf-dot fail" /> Fail</div>
            </div>
          </aside>
        </div>

        <div className="pdf-footer">
          <span>Powered By Noorul Academy</span>
          <span>WhatsApp: +91 89438 38168</span>
        </div>
      </div>
    </div>
  );
});

export default PeriodReportPdfSheet;
