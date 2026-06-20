'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DailyReportPdfSheet from '@/components/daily-report-pdf-sheet';
import PeriodReportPdfSheet from '@/components/period-report-pdf-sheet';
import {
  aggregateEntries,
  buildPeriodReportMessage,
  buildStudyChartMessage,
  buildWhatsAppUrl,
  computePerformance,
  dailyProgressKey,
  defaultSettings,
  emptyDailyEntry,
  endOfMonth,
  endOfWeek,
  flattenLocalDailyProgress,
  formatDisplayDate,
  getCurrentJuzFromProgress,
  getPeriodBounds,
  mergeDailyEntries,
  mergeEntryWithProgress,
  performanceLabel,
  settingsKey,
  startOfMonth,
  startOfWeek,
  todayIsoDate
} from '@/lib/daily-progress';
import {
  buildPdfFilename,
  createDailyReportPdfFile,
  downloadBlobFile,
  generateDailyReportPdf,
  sharePdfToWhatsApp
} from '@/lib/generate-daily-report-pdf';
import { loadJson, saveJson } from '@/lib/storage';

const dailyProgressStorageKey = dailyProgressKey;

function PracticeToggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      className={`practice-chip ${checked ? 'done' : 'missed'}`}
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
  );
}

export default function DailyReportPanel({ students, progressByStudent = {} }) {
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [selectedClass, setSelectedClass] = useState('');
  const [entriesByStudent, setEntriesByStudent] = useState({});
  const [savedEntries, setSavedEntries] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [feedback, setFeedback] = useState(null);
  const [reportRange, setReportRange] = useState('daily');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [periodBusy, setPeriodBusy] = useState(null);
  const [showPeriodPreview, setShowPeriodPreview] = useState(false);
  const pdfSheetRef = useRef(null);
  const weeklyPdfSheetRef = useRef(null);
  const monthlyPdfSheetRef = useRef(null);

  const classOptions = useMemo(() => {
    const values = [...new Set(students.map((student) => student.className).filter(Boolean))];
    return values.sort();
  }, [students]);

  const activeStudents = useMemo(() => {
    return students
      .filter((student) => student.status !== 'Inactive')
      .filter((student) => !selectedClass || student.className === selectedClass);
  }, [selectedClass, students]);

  useEffect(() => {
    setSettings(loadJson(settingsKey, defaultSettings));
  }, []);

  useEffect(() => {
    saveJson(settingsKey, settings);
  }, [settings]);

  async function loadMergedEntries(from, to) {
    const localEntries = flattenLocalDailyProgress(loadJson(dailyProgressStorageKey, {}))
      .filter((entry) => (!from || entry.progressDate >= from) && (!to || entry.progressDate <= to));

    try {
      const query = from && to ? `?from=${from}&to=${to}` : '';
      const response = await fetch(`/api/daily-progress${query}`);
      const payload = response.ok ? await response.json() : null;
      const remoteEntries = Array.isArray(payload?.entries) ? payload.entries : [];
      return mergeDailyEntries(remoteEntries, localEntries);
    } catch {
      return localEntries;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadReportEntries() {
      const from = reportRange === 'weekly'
        ? startOfWeek(selectedDate)
        : reportRange === 'monthly'
          ? startOfMonth(selectedDate)
          : selectedDate;
      const to = reportRange === 'weekly'
        ? endOfWeek(selectedDate)
        : reportRange === 'monthly'
          ? endOfMonth(selectedDate)
          : selectedDate;

      const entries = await loadMergedEntries(from, to);
      if (!cancelled) setSavedEntries(entries);
    }

    loadReportEntries();
    return () => {
      cancelled = true;
    };
  }, [reportRange, selectedDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      const localCache = loadJson(dailyProgressStorageKey, {});
      const cachedForDate = localCache[selectedDate] || {};

      try {
        const response = await fetch(`/api/daily-progress?date=${selectedDate}`);
        const payload = response.ok ? await response.json() : null;
        const remoteEntries = Array.isArray(payload?.entries) ? payload.entries : [];

        if (cancelled) return;

        const nextEntries = {};
        for (const student of activeStudents) {
          const remote = remoteEntries.find((entry) => String(entry.studentId) === String(student.id));
          const cached = cachedForDate[String(student.id)];
          const savedEntry = remote || cached || emptyDailyEntry();
          nextEntries[String(student.id)] = mergeEntryWithProgress(
            savedEntry,
            progressByStudent[String(student.id)]
          );
        }

        setEntriesByStudent(nextEntries);
      } catch {
        if (cancelled) return;
        const nextEntries = {};
        for (const student of activeStudents) {
          const cached = cachedForDate[String(student.id)] || emptyDailyEntry();
          nextEntries[String(student.id)] = mergeEntryWithProgress(
            cached,
            progressByStudent[String(student.id)]
          );
        }
        setEntriesByStudent(nextEntries);
      }
    }

    loadEntries();
    return () => {
      cancelled = true;
    };
  }, [activeStudents, progressByStudent, selectedDate]);

  useEffect(() => {
    setEntriesByStudent((current) => {
      const next = { ...current };
      let changed = false;

      for (const student of activeStudents) {
        const studentKey = String(student.id);
        const derivedJuz = getCurrentJuzFromProgress(progressByStudent[studentKey]?.juz);
        const existing = next[studentKey] || emptyDailyEntry();

        if (derivedJuz !== '' && String(existing.currentJuz) !== String(derivedJuz)) {
          next[studentKey] = { ...existing, currentJuz: derivedJuz };
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeStudents, progressByStudent]);

  const whatsappMessage = useMemo(() => (
    buildStudyChartMessage({
      date: selectedDate,
      students: activeStudents,
      entriesByStudentId: entriesByStudent,
      settings,
      className: selectedClass
    })
  ), [activeStudents, entriesByStudent, selectedClass, selectedDate, settings]);

  const weeklyBounds = useMemo(() => getPeriodBounds(selectedDate, 'weekly'), [selectedDate]);
  const monthlyBounds = useMemo(() => getPeriodBounds(selectedDate, 'monthly'), [selectedDate]);

  const weeklyMessage = useMemo(() => (
    buildPeriodReportMessage({
      period: 'weekly',
      from: weeklyBounds.from,
      to: weeklyBounds.to,
      students: activeStudents,
      savedEntries,
      className: selectedClass,
      settings
    })
  ), [activeStudents, savedEntries, selectedClass, settings, weeklyBounds.from, weeklyBounds.to]);

  const monthlyMessage = useMemo(() => (
    buildPeriodReportMessage({
      period: 'monthly',
      from: monthlyBounds.from,
      to: monthlyBounds.to,
      students: activeStudents,
      savedEntries,
      className: selectedClass,
      settings
    })
  ), [activeStudents, savedEntries, selectedClass, settings, monthlyBounds.from, monthlyBounds.to]);

  const reportTotals = useMemo(() => {
    const from = reportRange === 'weekly'
      ? startOfWeek(selectedDate)
      : reportRange === 'monthly'
        ? startOfMonth(selectedDate)
        : selectedDate;
    const to = reportRange === 'weekly'
      ? endOfWeek(selectedDate)
      : reportRange === 'monthly'
        ? endOfMonth(selectedDate)
        : selectedDate;

    const perStudent = activeStudents.map((student) => {
      const studentEntries = savedEntries.filter((entry) => String(entry.studentId) === String(student.id));
      return {
        student,
        totals: aggregateEntries(studentEntries, { from, to })
      };
    });

    return { from, to, perStudent };
  }, [activeStudents, reportRange, savedEntries, selectedDate]);

  function updateEntry(studentId, patch) {
    setEntriesByStudent((current) => {
      const existing = current[studentId] || emptyDailyEntry();
      const nextEntry = { ...existing, ...patch };

      if ('ayatsLearned' in patch) {
        nextEntry.achievedLines = patch.ayatsLearned;
      }

      return {
        ...current,
        [studentId]: nextEntry
      };
    });
  }

  async function saveDailyReport() {
    const entries = activeStudents.map((student) => {
      const draft = entriesByStudent[String(student.id)] || emptyDailyEntry();
      const ayats = Number(draft.ayatsLearned) || 0;
      const performance = computePerformance({ ...draft, achievedLines: ayats });
      return {
        studentId: student.id,
        progressDate: selectedDate,
        ...draft,
        achievedLines: ayats,
        performance
      };
    });

    setSavedEntries(entries);

    const localCache = loadJson(dailyProgressStorageKey, {});
    localCache[selectedDate] = Object.fromEntries(entries.map((entry) => [String(entry.studentId), entry]));
    saveJson(dailyProgressStorageKey, localCache);

    try {
      const response = await fetch('/api/daily-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries })
      });

      const payload = response.ok ? await response.json() : null;
      if (!response.ok) {
        const errorPayload = payload || {};
        throw new Error(errorPayload.error || 'Sync failed');
      }

      const from = reportRange === 'weekly'
        ? startOfWeek(selectedDate)
        : reportRange === 'monthly'
          ? startOfMonth(selectedDate)
          : selectedDate;
      const to = reportRange === 'weekly'
        ? endOfWeek(selectedDate)
        : reportRange === 'monthly'
          ? endOfMonth(selectedDate)
          : selectedDate;
      const mergedEntries = await loadMergedEntries(from, to);
      setSavedEntries(mergedEntries);
      setFeedback({ kind: 'success', text: 'Daily report saved. Progress is now visible on the public dashboard.' });
    } catch (error) {
      const from = reportRange === 'weekly'
        ? startOfWeek(selectedDate)
        : reportRange === 'monthly'
          ? startOfMonth(selectedDate)
          : selectedDate;
      const to = reportRange === 'weekly'
        ? endOfWeek(selectedDate)
        : reportRange === 'monthly'
          ? endOfMonth(selectedDate)
          : selectedDate;
      const mergedEntries = await loadMergedEntries(from, to);
      setSavedEntries(mergedEntries);
      setFeedback({
        kind: 'error',
        text: error.message?.includes('foreign key')
          ? 'Saved locally. Sync failed because the student is not in Supabase yet — re-enrol or check student IDs.'
          : 'Saved locally. Progress shows on the dashboard, but Supabase sync failed.'
      });
    }
  }

  function sendWhatsApp() {
    window.open(buildWhatsAppUrl(whatsappMessage, settings.whatsappNumber || defaultSettings.whatsappNumber), '_blank', 'noopener,noreferrer');
    setFeedback({ kind: 'success', text: 'Opening WhatsApp with the study chart for +91 89438 38168.' });
  }

  async function createPdfFile() {
    if (!pdfSheetRef.current) {
      throw new Error('PDF template not ready.');
    }

    return createDailyReportPdfFile(pdfSheetRef.current, {
      date: selectedDate,
      className: selectedClass
    });
  }

  async function downloadDailyPdf() {
    if (!activeStudents.length) {
      setFeedback({ kind: 'error', text: 'Add at least one student before creating a PDF.' });
      return;
    }

    setPdfBusy(true);
    setFeedback({ kind: 'info', text: 'Creating PDF report…' });

    try {
      const pdfFile = await createPdfFile();
      const pdf = await generateDailyReportPdf(pdfSheetRef.current);
      pdf.save(buildPdfFilename({ date: selectedDate, className: selectedClass }));
      setFeedback({ kind: 'success', text: `PDF saved as ${pdfFile.name}` });
    } catch (error) {
      setFeedback({ kind: 'error', text: error.message || 'Could not create PDF.' });
    } finally {
      setPdfBusy(false);
    }
  }

  async function savePdfAndSendWhatsApp() {
    if (!activeStudents.length) {
      setFeedback({ kind: 'error', text: 'Add at least one student before sending the report.' });
      return;
    }

    setPdfBusy(true);
    setFeedback({ kind: 'info', text: 'Saving report and preparing PDF for WhatsApp…' });

    try {
      await saveDailyReport();
      const pdfFile = await createPdfFile();
      const whatsappUrl = buildWhatsAppUrl(whatsappMessage, settings.whatsappNumber || defaultSettings.whatsappNumber);
      const result = await sharePdfToWhatsApp({ pdfFile, message: whatsappMessage, whatsappUrl });

      if (result === 'shared') {
        setFeedback({ kind: 'success', text: 'PDF ready. Choose WhatsApp in the share menu to send the report.' });
      } else {
        setFeedback({
          kind: 'success',
          text: 'PDF downloaded. WhatsApp opened — attach the PDF file and send to +91 89438 38168.'
        });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try {
          const pdfFile = await createPdfFile();
          downloadBlobFile(pdfFile);
          window.open(buildWhatsAppUrl(whatsappMessage, settings.whatsappNumber || defaultSettings.whatsappNumber), '_blank', 'noopener,noreferrer');
          setFeedback({ kind: 'success', text: 'PDF downloaded. WhatsApp opened — attach the PDF and send.' });
        } catch (innerError) {
          setFeedback({ kind: 'error', text: innerError.message || 'Could not prepare PDF for WhatsApp.' });
        }
      }
    } finally {
      setPdfBusy(false);
    }
  }

  function getPeriodMessage(period) {
    return period === 'weekly' ? weeklyMessage : monthlyMessage;
  }

  function getPeriodPdfRef(period) {
    return period === 'weekly' ? weeklyPdfSheetRef : monthlyPdfSheetRef;
  }

  async function createPeriodPdfFile(period) {
    const sheetRef = getPeriodPdfRef(period);
    if (!sheetRef.current) {
      throw new Error('PDF template not ready.');
    }

    const { from, to } = getPeriodBounds(selectedDate, period);
    return createDailyReportPdfFile(sheetRef.current, {
      date: selectedDate,
      className: selectedClass,
      period,
      from,
      to
    });
  }

  async function downloadPeriodPdf(period) {
    if (!activeStudents.length) {
      setFeedback({ kind: 'error', text: 'Add at least one student before creating a PDF.' });
      return;
    }

    const label = period === 'weekly' ? 'Weekly' : 'Monthly';
    setPeriodBusy(period);
    setFeedback({ kind: 'info', text: `Creating ${label.toLowerCase()} PDF report…` });

    try {
      const pdfFile = await createPeriodPdfFile(period);
      const { from, to } = getPeriodBounds(selectedDate, period);
      const pdf = await generateDailyReportPdf(getPeriodPdfRef(period).current);
      pdf.save(buildPdfFilename({ date: selectedDate, className: selectedClass, period, from, to }));
      setFeedback({ kind: 'success', text: `${label} PDF saved as ${pdfFile.name}` });
    } catch (error) {
      setFeedback({ kind: 'error', text: error.message || 'Could not create PDF.' });
    } finally {
      setPeriodBusy(null);
    }
  }

  async function sendPeriodPdfWhatsApp(period) {
    if (!activeStudents.length) {
      setFeedback({ kind: 'error', text: 'Add at least one student before sending the report.' });
      return;
    }

    const label = period === 'weekly' ? 'Weekly' : 'Monthly';
    const message = getPeriodMessage(period);
    setPeriodBusy(period);
    setFeedback({ kind: 'info', text: `Preparing ${label.toLowerCase()} PDF for WhatsApp…` });

    try {
      const pdfFile = await createPeriodPdfFile(period);
      const whatsappUrl = buildWhatsAppUrl(message, settings.whatsappNumber || defaultSettings.whatsappNumber);
      const result = await sharePdfToWhatsApp({ pdfFile, message, whatsappUrl });

      if (result === 'shared') {
        setFeedback({ kind: 'success', text: `${label} PDF ready. Choose WhatsApp in the share menu to send the report.` });
      } else {
        setFeedback({
          kind: 'success',
          text: `${label} PDF downloaded. WhatsApp opened — attach the PDF file and send to +91 89438 38168.`
        });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try {
          const pdfFile = await createPeriodPdfFile(period);
          downloadBlobFile(pdfFile);
          window.open(buildWhatsAppUrl(message, settings.whatsappNumber || defaultSettings.whatsappNumber), '_blank', 'noopener,noreferrer');
          setFeedback({ kind: 'success', text: `${label} PDF downloaded. WhatsApp opened — attach the PDF and send.` });
        } catch (innerError) {
          setFeedback({ kind: 'error', text: innerError.message || 'Could not prepare PDF for WhatsApp.' });
        }
      }
    } finally {
      setPeriodBusy(null);
    }
  }

  function sendPeriodTextWhatsApp(period) {
    const label = period === 'weekly' ? 'Weekly' : 'Monthly';
    window.open(
      buildWhatsAppUrl(getPeriodMessage(period), settings.whatsappNumber || defaultSettings.whatsappNumber),
      '_blank',
      'noopener,noreferrer'
    );
    setFeedback({ kind: 'success', text: `Opening WhatsApp with the ${label.toLowerCase()} progress report.` });
  }

  return (
    <div className="daily-report-panel">
      <div className="daily-report-header">
        <div>
          <h3>Daily Class Report</h3>
          <p className="section-sub">Fill in today&apos;s progress, save the report, then send the study chart to WhatsApp.</p>
        </div>
        <div className="daily-report-controls">
          <label className="form-field compact">
            <span>DATE</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
          <label className="form-field compact">
            <span>CLASS / GROUP</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="">All classes</option>
              {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="daily-report-toolbar">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.whatsappEnabled !== false}
            onChange={(event) => setSettings((current) => ({ ...current, whatsappEnabled: event.target.checked }))}
          />
          <span>Include WhatsApp closing message</span>
        </label>
        <div className="daily-report-actions">
          <button className="btn-small btn-small-primary" type="button" onClick={saveDailyReport}>Save Daily Report</button>
          <button className="btn-small btn-small-gold" type="button" onClick={downloadDailyPdf} disabled={pdfBusy}>
            {pdfBusy ? 'Creating PDF…' : 'Download PDF'}
          </button>
          <button className="btn-small btn-small-primary whatsapp-button" type="button" onClick={savePdfAndSendWhatsApp} disabled={pdfBusy}>
            Save PDF &amp; Send WhatsApp
          </button>
          <button className="btn-small btn-small-gold" type="button" onClick={() => setShowPreview((current) => !current)}>
            {showPreview ? 'Hide Preview' : 'Preview Chart'}
          </button>
          {settings.whatsappEnabled !== false ? (
            <button className="btn-small btn-small-outline whatsapp-button" type="button" onClick={sendWhatsApp}>
              Text Only WhatsApp
            </button>
          ) : null}
        </div>
      </div>

      {showPreview ? (
        <div className="whatsapp-preview">
          <div className="whatsapp-preview-head">
            <strong>WhatsApp Study Chart Preview</strong>
            <span>{formatDisplayDate(selectedDate)}</span>
          </div>
          <pre>{whatsappMessage}</pre>
        </div>
      ) : null}

      <div className="table-wrap daily-report-table-wrap">
        <table className="daily-report-table">
          <thead>
            <tr>
              <th>STUDENT</th>
              <th>COURSE</th>
              <th>JUZ</th>
              <th>AYATS</th>
              <th>TARGET</th>
              <th>ACHIEVED</th>
              <th>ATTENDANCE</th>
              <th>PRACTICE</th>
              <th>PERFORMANCE</th>
            </tr>
          </thead>
          <tbody>
            {activeStudents.length ? activeStudents.map((student) => {
              const entry = entriesByStudent[String(student.id)] || emptyDailyEntry();
              const performance = computePerformance(entry);
              return (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                    <div className="row-subtext">{student.className || 'No class'}</div>
                  </td>
                  <td>{student.course}</td>
                  <td>
                    <input
                      className="mini-input mini-input-readonly"
                      type="number"
                      min="1"
                      max="30"
                      value={entry.currentJuz}
                      readOnly
                      title="Synced from Student Progress tab"
                    />
                  </td>
                  <td>
                    <input
                      className="mini-input"
                      type="number"
                      min="0"
                      value={entry.ayatsLearned}
                      onChange={(event) => updateEntry(String(student.id), { ayatsLearned: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="mini-input"
                      type="number"
                      min="0"
                      value={entry.targetLines}
                      onChange={(event) => updateEntry(String(student.id), { targetLines: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="mini-input achieved-input mini-input-readonly"
                      type="number"
                      min="0"
                      value={entry.ayatsLearned || 0}
                      readOnly
                      title="Synced with Ayats learned"
                    />
                  </td>
                  <td>
                    <PracticeToggle
                      label={entry.attendance ? 'Present' : 'Absent'}
                      checked={entry.attendance}
                      onChange={(checked) => updateEntry(String(student.id), { attendance: checked })}
                    />
                  </td>
                  <td>
                    <div className="practice-stack">
                      <PracticeToggle
                        label="New Dars"
                        checked={entry.newDarsPractice}
                        onChange={(checked) => updateEntry(String(student.id), { newDarsPractice: checked })}
                      />
                      <PracticeToggle
                        label="Juz Dars"
                        checked={entry.juzDarsPractice}
                        onChange={(checked) => updateEntry(String(student.id), { juzDarsPractice: checked })}
                      />
                      <PracticeToggle
                        label="Old Dars"
                        checked={entry.oldDarsPractice}
                        onChange={(checked) => updateEntry(String(student.id), { oldDarsPractice: checked })}
                      />
                    </div>
                  </td>
                  <td><span className={`performance-badge performance-${performance}`}>{performanceLabel(performance)}</span></td>
                </tr>
              );
            }) : (
              <tr><td colSpan="9" className="empty-state">No active students found for this class.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="report-summary-panel">
        <div className="report-summary-head">
          <h4>Progress Summary</h4>
          <div className="report-range-tabs">
            {['daily', 'weekly', 'monthly'].map((range) => (
              <button
                key={range}
                type="button"
                className={`report-range-tab ${reportRange === range ? 'active' : ''}`}
                onClick={() => {
                  setReportRange(range);
                  setShowPeriodPreview(false);
                }}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="report-range-caption">
          Showing {reportRange} totals from {formatDisplayDate(reportTotals.from)}
          {reportTotals.from !== reportTotals.to ? ` to ${formatDisplayDate(reportTotals.to)}` : ''}
        </p>
        {reportRange === 'weekly' || reportRange === 'monthly' ? (
          <div className="report-period-toolbar">
            <button
              className="btn-small btn-small-gold"
              type="button"
              onClick={() => downloadPeriodPdf(reportRange)}
              disabled={Boolean(periodBusy)}
            >
              {periodBusy === reportRange ? 'Creating PDF…' : `Download ${reportRange === 'weekly' ? 'Weekly' : 'Monthly'} PDF`}
            </button>
            <button
              className="btn-small btn-small-primary whatsapp-button"
              type="button"
              onClick={() => sendPeriodPdfWhatsApp(reportRange)}
              disabled={Boolean(periodBusy)}
            >
              PDF &amp; Send WhatsApp
            </button>
            <button
              className="btn-small btn-small-outline whatsapp-button"
              type="button"
              onClick={() => sendPeriodTextWhatsApp(reportRange)}
              disabled={Boolean(periodBusy)}
            >
              Text Only WhatsApp
            </button>
            <button
              className="btn-small btn-small-gold"
              type="button"
              onClick={() => setShowPeriodPreview((current) => !current)}
            >
              {showPeriodPreview ? 'Hide Preview' : 'Preview Report'}
            </button>
          </div>
        ) : null}
        {showPeriodPreview && (reportRange === 'weekly' || reportRange === 'monthly') ? (
          <div className="whatsapp-preview">
            <div className="whatsapp-preview-head">
              <strong>{reportRange === 'weekly' ? 'Weekly' : 'Monthly'} Report Preview</strong>
              <span>{formatDisplayDate(reportTotals.from)} – {formatDisplayDate(reportTotals.to)}</span>
            </div>
            <pre>{getPeriodMessage(reportRange)}</pre>
          </div>
        ) : null}
        <div className="report-summary-grid">
          {reportTotals.perStudent.map(({ student, totals }) => (
            <article key={student.id} className="report-summary-card">
              <strong>{student.name}</strong>
              <span>{student.className || student.course}</span>
              <div className="report-metric"><span>Ayats learned</span><strong>{totals.ayatsLearned}</strong></div>
              <div className="report-metric"><span>Lines achieved</span><strong>{totals.achievedLines}</strong></div>
              <div className="report-metric"><span>Attendance</span><strong>{totals.attendanceRate}%</strong></div>
              <div className="report-metric"><span>Practice rate</span><strong>{totals.practiceRate}%</strong></div>
            </article>
          ))}
        </div>
      </div>

      {feedback ? <div className={`alert alert-${feedback.kind}`}>{feedback.text}</div> : null}

      <DailyReportPdfSheet
        ref={pdfSheetRef}
        date={selectedDate}
        className={selectedClass}
        students={activeStudents}
        entriesByStudent={entriesByStudent}
      />
      <PeriodReportPdfSheet
        ref={weeklyPdfSheetRef}
        period="weekly"
        from={weeklyBounds.from}
        to={weeklyBounds.to}
        className={selectedClass}
        students={activeStudents}
        savedEntries={savedEntries}
      />
      <PeriodReportPdfSheet
        ref={monthlyPdfSheetRef}
        period="monthly"
        from={monthlyBounds.from}
        to={monthlyBounds.to}
        className={selectedClass}
        students={activeStudents}
        savedEntries={savedEntries}
      />
    </div>
  );
}
