'use client';

import { forwardRef, useMemo } from 'react';
import {
  computePerformance,
  formatCourseLabel,
  formatDisplayDate,
  performanceLabel
} from '@/lib/daily-progress';

function practiceSummary(entry) {
  const items = [
    entry.newDarsPractice ? 'New' : null,
    entry.juzDarsPractice ? 'Juz' : null,
    entry.oldDarsPractice ? 'Old' : null
  ].filter(Boolean);
  return items.length ? items.join(', ') : '—';
}

const DailyReportPdfSheet = forwardRef(function DailyReportPdfSheet({
  date,
  className,
  students,
  entriesByStudent
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

  const stats = useMemo(() => {
    const performances = students.map((student) => {
      const entry = entriesByStudent[String(student.id)] || {};
      return computePerformance(entry);
    });
    const presentCount = students.filter((student) => entriesByStudent[String(student.id)]?.attendance !== false).length;
    const scoreMap = { excellent: 100, very_good: 85, good: 70, average: 55, fail: 30 };
    const averageScore = performances.length
      ? performances.reduce((sum, value) => sum + (scoreMap[value] || 0), 0) / performances.length
      : 0;
    const overallLabel = averageScore >= 90 ? 'EXCELLENT' : averageScore >= 75 ? 'VERY GOOD' : averageScore >= 60 ? 'GOOD' : averageScore >= 45 ? 'AVERAGE' : 'NEEDS IMPROVEMENT';

    return {
      total: students.length,
      present: presentCount,
      absent: students.length - presentCount,
      averageScore: averageScore.toFixed(2),
      overallLabel
    };
  }, [entriesByStudent, students]);

  const teacherName = students.find((student) => student.teacher)?.teacher || '—';
  const primaryCourse = students.length ? formatCourseLabel(students[0].course) : 'GENERAL';
  const classLabel = className || students.find((student) => student.className)?.className || 'All Classes';

  return (
    <div className="daily-report-pdf-sheet-wrap" aria-hidden="true">
      <div className="daily-report-pdf-sheet" ref={ref}>
        <div className="pdf-sheet-top">
          <div className="pdf-brand">NOORUL ACADEMY</div>
          <div className="pdf-title-block">
            <h1>DAILY CLASS REPORT ({classLabel})</h1>
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
          <div><span>Date</span><strong>{formatDisplayDate(date)}</strong></div>
        </div>

        <div className="pdf-body-grid">
          <div className="pdf-table-wrap">
            {Object.entries(groupedStudents).map(([courseLabel, courseStudents]) => (
              <div key={courseLabel} className="pdf-course-block">
                <div className="pdf-course-heading">🔸 {courseLabel} 🔸</div>
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>STUDENT</th>
                      <th>SUBJECT</th>
                      <th>STATUS</th>
                      <th>JUZ</th>
                      <th>AYATS</th>
                      <th>TARGET</th>
                      <th>ACHIEVED</th>
                      <th>PRACTICE</th>
                      <th>PERFORMANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseStudents.map((student) => {
                      const entry = entriesByStudent[String(student.id)] || {};
                      const performance = computePerformance(entry);
                      return (
                        <tr key={student.id}>
                          <td><strong>{student.name}</strong></td>
                          <td>{courseLabel}</td>
                          <td className={entry.attendance === false ? 'pdf-absent' : 'pdf-present'}>
                            {entry.attendance === false ? 'ABSENT' : 'PRESENT'}
                          </td>
                          <td>{entry.currentJuz || '—'}</td>
                          <td>{entry.ayatsLearned || 0}</td>
                          <td>{entry.targetLines || 0}</td>
                          <td>{entry.achievedLines || 0}</td>
                          <td>{practiceSummary(entry)}</td>
                          <td>
                            <div className="pdf-performance-cell">
                              <span className={`pdf-performance pdf-performance-${performance}`}>{performanceLabel(performance)}</span>
                            </div>
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
              <div className="pdf-stat"><span>Present</span><strong>{stats.present}</strong></div>
              <div className="pdf-stat"><span>Absent</span><strong>{stats.absent}</strong></div>
              <div className="pdf-stat"><span>Overall Score</span><strong>{stats.averageScore}%</strong></div>
            </div>
            <div className="pdf-sidebar-card">
              <h3>Legend</h3>
              <div className="pdf-legend"><i className="pdf-dot excellent" /> Excellent</div>
              <div className="pdf-legend"><i className="pdf-dot very-good" /> Very Good</div>
              <div className="pdf-legend"><i className="pdf-dot good" /> Good</div>
              <div className="pdf-legend"><i className="pdf-dot average" /> Average</div>
              <div className="pdf-legend"><i className="pdf-dot fail" /> Fail / Absent</div>
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

export default DailyReportPdfSheet;
