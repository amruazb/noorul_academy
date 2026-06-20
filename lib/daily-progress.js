export const settingsKey = 'na_settings';
export const dailyProgressKey = 'na_daily_progress';
export const whatsappNumber = '918943838168';

export const defaultSettings = {
  whatsappEnabled: true,
  whatsappClosing: 'وفكم الله تعل',
  whatsappNumber
};

export function getCurrentJuzFromProgress(juzMap = {}) {
  for (let juzNumber = 1; juzNumber <= 30; juzNumber += 1) {
    const status = juzMap[juzNumber] ?? juzMap[String(juzNumber)] ?? 'none';
    if (status === 'inprogress') return juzNumber;
  }

  let highestCompleted = 0;
  for (let juzNumber = 1; juzNumber <= 30; juzNumber += 1) {
    const status = juzMap[juzNumber] ?? juzMap[String(juzNumber)] ?? 'none';
    if (status === 'completed') highestCompleted = juzNumber;
  }

  if (highestCompleted >= 30) return 30;
  if (highestCompleted > 0) return highestCompleted + 1;
  return '';
}

export function mergeEntryWithProgress(entry, studentProgress) {
  const merged = { ...emptyDailyEntry(), ...entry };
  const ayats = Number(merged.ayatsLearned) || 0;
  merged.achievedLines = ayats;

  const derivedJuz = getCurrentJuzFromProgress(studentProgress?.juz);
  if (derivedJuz !== '') {
    merged.currentJuz = derivedJuz;
  }

  return merged;
}

export function syncDailyJuzInCache(studentId, juzMap, date = todayIsoDate(), cache = {}) {
  const currentJuz = getCurrentJuzFromProgress(juzMap);
  const nextCache = { ...cache };
  if (!nextCache[date]) nextCache[date] = {};
  const existing = nextCache[date][String(studentId)] || emptyDailyEntry();
  nextCache[date][String(studentId)] = {
    ...existing,
    currentJuz: currentJuz === '' ? existing.currentJuz : currentJuz
  };
  return nextCache;
}

export function emptyDailyEntry() {
  return {
    attendance: true,
    ayatsLearned: 0,
    newDarsPractice: false,
    juzDarsPractice: false,
    oldDarsPractice: false,
    currentJuz: '',
    targetLines: 10,
    achievedLines: 0,
    performance: '',
    notes: ''
  };
}

export function statusIcon(done) {
  return done ? 'Yes' : 'No';
}

export function whatsAppStatusMark(done) {
  return done ? '[OK]' : '[X]';
}

export function buildWhatsAppUrl(message, phone = whatsappNumber) {
  const normalizedPhone = String(phone).replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalizedPhone}?text=${encoded}`;
}

export function formatDisplayDate(dateString) {
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
}

export function todayIsoDate() {
  return new Date().toISOString().split('T')[0];
}

export function startOfWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}

export function endOfWeek(dateString) {
  const start = new Date(`${startOfWeek(dateString)}T00:00:00`);
  start.setDate(start.getDate() + 6);
  return start.toISOString().split('T')[0];
}

export function startOfMonth(dateString) {
  const [year, month] = dateString.split('-');
  return `${year}-${month}-01`;
}

export function endOfMonth(dateString) {
  const [year, month] = dateString.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

export function performanceLabel(value) {
  const labels = {
    excellent: 'EXCELLENT',
    very_good: 'VERY GOOD',
    good: 'GOOD',
    average: 'AVERAGE',
    fail: 'FAIL'
  };
  return labels[value] || '—';
}

export function computePerformance(entry) {
  if (!entry.attendance) return 'fail';
  const checks = [entry.newDarsPractice, entry.juzDarsPractice, entry.oldDarsPractice];
  const doneCount = checks.filter(Boolean).length;
  const ayats = Number(entry.ayatsLearned) || 0;
  if (doneCount === 3 && ayats >= 5) return 'excellent';
  if (doneCount >= 2 && ayats >= 3) return 'very_good';
  if (doneCount >= 2 || ayats >= 2) return 'good';
  if (doneCount >= 1 || ayats >= 1) return 'average';
  return 'fail';
}

export function formatCourseLabel(course) {
  const value = String(course || '').toLowerCase();
  if (value.includes('hif')) return 'HIFZ';
  if (value.includes('nadh') || value.includes('nazir')) return 'NADHRA';
  if (value.includes('tajweed')) return 'TAJWEED';
  if (value.includes('tarbiyy')) return 'TARBIYYAT';
  if (value.includes('daura')) return 'DAURA';
  return String(course || 'GENERAL').toUpperCase();
}

export function flattenLocalDailyProgress(cache) {
  if (!cache || typeof cache !== 'object') return [];
  return Object.entries(cache).flatMap(([progressDate, entriesByStudent]) => (
    Object.entries(entriesByStudent || {}).map(([studentId, entry]) => ({
      ...entry,
      studentId: Number(studentId),
      progressDate
    }))
  ));
}

export function mergeDailyEntries(remoteEntries = [], localEntries = []) {
  const map = new Map();
  for (const entry of localEntries) {
    map.set(`${entry.studentId}-${entry.progressDate}`, entry);
  }
  for (const entry of remoteEntries) {
    map.set(`${entry.studentId}-${entry.progressDate}`, entry);
  }
  return Array.from(map.values()).sort((left, right) => right.progressDate.localeCompare(left.progressDate));
}

export function groupStudentsByCourse(students) {
  const groups = {};
  for (const student of students) {
    const course = formatCourseLabel(student.course);
    if (!groups[course]) groups[course] = [];
    groups[course].push(student);
  }
  return groups;
}

export function buildStudyChartMessage({
  date,
  students,
  entriesByStudentId,
  settings = defaultSettings,
  className = ''
}) {
  const headerClass = className ? ` (${className})` : '';
  const lines = [
    '*STUDY CHART*',
    '',
    `*Date:* ${formatDisplayDate(date)}${headerClass}`,
    ''
  ];
  const grouped = groupStudentsByCourse(students);

  for (const [courseLabel, courseStudents] of Object.entries(grouped)) {
    lines.push(`*--- ${courseLabel} ---*`, '');

    for (const student of courseStudents) {
      const entry = entriesByStudentId[String(student.id)] || emptyDailyEntry();
      lines.push(`*${student.name}*`, '');
      lines.push(`- Attendance: ${whatsAppStatusMark(entry.attendance)}`);
      lines.push(`- New Dars Practice Nazira: ${whatsAppStatusMark(entry.newDarsPractice)}`);
      lines.push(`- Juz Dars Practice: ${whatsAppStatusMark(entry.juzDarsPractice)}`);
      lines.push(`- Old Dars Practice: ${whatsAppStatusMark(entry.oldDarsPractice)}`);
      if (Number(entry.ayatsLearned) > 0) {
        lines.push(`- Ayats Learned: ${entry.ayatsLearned}`);
      }
      lines.push('');
    }
  }

  if (settings.whatsappEnabled !== false) {
    lines.push(settings.whatsappClosing || defaultSettings.whatsappClosing);
  }

  return lines.join('\n');
}

export function getPeriodBounds(selectedDate, period) {
  if (period === 'weekly') {
    return { from: startOfWeek(selectedDate), to: endOfWeek(selectedDate) };
  }
  if (period === 'monthly') {
    return { from: startOfMonth(selectedDate), to: endOfMonth(selectedDate) };
  }
  return { from: selectedDate, to: selectedDate };
}

export function computePeriodPerformance(totals) {
  if (!totals.days) return 'fail';
  if (totals.attendanceRate >= 90 && totals.practiceRate >= 75 && totals.ayatsLearned >= 15) return 'excellent';
  if (totals.attendanceRate >= 80 && totals.practiceRate >= 60) return 'very_good';
  if (totals.attendanceRate >= 70 || totals.ayatsLearned >= 10) return 'good';
  if (totals.attendanceRate >= 50 || totals.ayatsLearned >= 5) return 'average';
  return 'fail';
}

export function buildPeriodReportMessage({
  period,
  from,
  to,
  students,
  savedEntries,
  className = '',
  settings = defaultSettings
}) {
  const periodLabel = period === 'weekly' ? 'WEEKLY' : 'MONTHLY';
  const headerClass = className ? ` (${className})` : '';
  const lines = [
    `*${periodLabel} PROGRESS REPORT*`,
    '',
    `*Period:* ${formatDisplayDate(from)} to ${formatDisplayDate(to)}${headerClass}`,
    ''
  ];
  const grouped = groupStudentsByCourse(students);

  for (const [courseLabel, courseStudents] of Object.entries(grouped)) {
    lines.push(`*--- ${courseLabel} ---*`, '');

    for (const student of courseStudents) {
      const studentEntries = savedEntries.filter((entry) => String(entry.studentId) === String(student.id));
      const totals = aggregateEntries(studentEntries, { from, to });
      lines.push(`*${student.name}*`, '');
      lines.push(`- Days recorded: ${totals.days}`);
      lines.push(`- Ayats learned: ${totals.ayatsLearned}`);
      lines.push(`- Lines achieved: ${totals.achievedLines}`);
      lines.push(`- Attendance: ${totals.attendanceRate}%`);
      lines.push(`- Practice rate: ${totals.practiceRate}%`);
      lines.push('');
    }
  }

  if (settings.whatsappEnabled !== false) {
    lines.push(settings.whatsappClosing || defaultSettings.whatsappClosing);
  }

  return lines.join('\n');
}

export function aggregateEntries(entries, { from, to } = {}) {
  const filtered = entries.filter((entry) => {
    if (from && entry.progressDate < from) return false;
    if (to && entry.progressDate > to) return false;
    return true;
  });

  const totals = {
    days: filtered.length,
    presentDays: filtered.filter((entry) => entry.attendance).length,
    absentDays: filtered.filter((entry) => !entry.attendance).length,
    ayatsLearned: filtered.reduce((sum, entry) => sum + (Number(entry.ayatsLearned) || 0), 0),
    achievedLines: filtered.reduce((sum, entry) => sum + (Number(entry.achievedLines) || 0), 0),
    newDarsDone: filtered.filter((entry) => entry.newDarsPractice).length,
    juzDarsDone: filtered.filter((entry) => entry.juzDarsPractice).length,
    oldDarsDone: filtered.filter((entry) => entry.oldDarsPractice).length
  };

  totals.attendanceRate = totals.days ? Math.round((totals.presentDays / totals.days) * 100) : 0;
  totals.practiceRate = totals.days
    ? Math.round(((totals.newDarsDone + totals.juzDarsDone + totals.oldDarsDone) / (totals.days * 3)) * 100)
    : 0;

  return totals;
}

export function toClientEntry(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    progressDate: row.progress_date,
    attendance: row.attendance,
    ayatsLearned: row.ayats_learned ?? 0,
    newDarsPractice: row.new_dars_practice ?? false,
    juzDarsPractice: row.juz_dars_practice ?? false,
    oldDarsPractice: row.old_dars_practice ?? false,
    currentJuz: row.current_juz ?? '',
    targetLines: row.target_lines ?? 10,
    achievedLines: row.achieved_lines ?? 0,
    performance: row.performance ?? '',
    notes: row.notes ?? ''
  };
}
