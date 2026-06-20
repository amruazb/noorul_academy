'use client';

import { useEffect, useMemo, useState } from 'react';
import html2canvas from 'html2canvas';
import { aboutBullets, courseDetails, defaultPosterMessage, faculties, navigation, posterThemes } from '@/lib/site-data';
import { loadJson, saveJson } from '@/lib/storage';
import DailyReportPanel from '@/components/daily-report-panel';
import ParentProgressPage from '@/components/parent-progress-page';

const studentKey = 'na_students';
const progressKey = 'na_progress';

const initialEnrollment = {
  name: '',
  gender: '',
  age: '',
  className: '',
  course: '',
  teacher: '',
  phone: '',
  notes: ''
};

function makeJuzMap() {
  return Array.from({ length: 30 }, (_, index) => index + 1).reduce((accumulator, juzNumber) => {
    accumulator[juzNumber] = 'none';
    return accumulator;
  }, {});
}

function cycleJuzStatus(currentStatus) {
  if (currentStatus === 'none') return 'inprogress';
  if (currentStatus === 'inprogress') return 'completed';
  return 'none';
}

function emptyProgress() {
  return { teacher: '', examiner: '', mark: '', notes: '', juz: makeJuzMap() };
}

function defaultPosterDraft() {
  return {
    name: 'STUDENT NAME',
    className: 'G00',
    juz: '1 Juz',
    teacher: 'Teacher Name',
    examiner: 'Examiner Name',
    mark: '—',
    message: defaultPosterMessage,
    type: 'marketing',
    theme: 'navy',
    headline: 'ONLINE HIFZUL QURAN',
    subheadline: 'Structured classes for girls and boys under 15',
    bullets: 'Hifzul Quran\nTajweed\nNadhra Course\nTarbiyyat\nDaura',
    ctaTitle: 'REGISTER NOW',
    ctaPhone: '+918943838168',
    audienceNote: 'We provide classes for girls and boys below 10'
  };
}

function SectionHeader({ label, title, subtitle }) {
  return (
    <div>
      <span className="section-label">{label}</span>
      <h2 className="section-title">{title}</h2>
      {subtitle ? <p className="section-sub">{subtitle}</p> : null}
      <div className="section-divider" />
    </div>
  );
}

function FacultyCard({ icon, name, tag, desc }) {
  return (
    <article className="faculty-card">
      <div className="faculty-icon">{icon}</div>
      <div className="faculty-name">{name}</div>
      <div className="faculty-tag">{tag}</div>
      <p className="faculty-desc">{desc}</p>
    </article>
  );
}

function CourseCard({ icon, name, body }) {
  return (
    <article className="course-detail-card">
      <div className="faculty-icon">{icon}</div>
      <div>
        <h3 className="course-detail-title">{name}</h3>
        <p className="course-detail-body">{body}</p>
      </div>
    </article>
  );
}

export default function NoorulAcademyApp() {
  const [activePage, setActivePage] = useState('home');
  const [activeAdminTab, setActiveAdminTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [progressByStudent, setProgressByStudent] = useState({});
  const [enrollment, setEnrollment] = useState(initialEnrollment);
  const [enrollmentFeedback, setEnrollmentFeedback] = useState(null);
  const [progressStudentId, setProgressStudentId] = useState('');
  const [progressDraft, setProgressDraft] = useState(emptyProgress());
  const [progressFeedback, setProgressFeedback] = useState(null);
  const [posterStudentId, setPosterStudentId] = useState('');
  const [posterDraft, setPosterDraft] = useState(defaultPosterDraft);
  const [posterPhoto, setPosterPhoto] = useState('');
  const [posterFeedback, setPosterFeedback] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRemoteData() {
      try {
        const [studentsResponse, progressResponse] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/progress')
        ]);

        const studentsPayload = studentsResponse.ok ? await studentsResponse.json() : null;
        const progressPayload = progressResponse.ok ? await progressResponse.json() : null;

        if (cancelled) return;

        const remoteStudents = Array.isArray(studentsPayload?.students) ? studentsPayload.students : [];
        const remoteProgress = progressPayload?.progress && typeof progressPayload.progress === 'object' ? progressPayload.progress : {};

        if (remoteStudents.length || Object.keys(remoteProgress).length) {
          setStudents(remoteStudents);
          setProgressByStudent(remoteProgress);
          return;
        }
      } catch {
        // Fall back to local cache below.
      }

      if (cancelled) return;
      setStudents(loadJson(studentKey, []));
      setProgressByStudent(loadJson(progressKey, {}));
    }

    loadRemoteData();
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('na_admin_auth');
    }

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => saveJson(studentKey, students), [students]);
  useEffect(() => saveJson(progressKey, progressByStudent), [progressByStudent]);

  useEffect(() => {
    if (!progressStudentId) {
      setProgressDraft(emptyProgress());
      return;
    }

    const savedProgress = progressByStudent[progressStudentId];
    setProgressDraft(savedProgress ? { ...emptyProgress(), ...savedProgress } : emptyProgress());
  }, [progressByStudent, progressStudentId]);

  const dashboardTotals = useMemo(() => ({
    total: students.length,
    girls: students.filter((student) => student.gender === 'Female').length,
    boys: students.filter((student) => student.gender === 'Male').length,
    hifz: students.filter((student) => student.course === 'Hiflul Quran').length
  }), [students]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => [student.name, student.course, student.teacher, student.className].some((value) => value.toLowerCase().includes(query)));
  }, [searchTerm, students]);

  const posterTheme = posterThemes[posterDraft.theme] || posterThemes.navy;
  const marketingPoints = useMemo(() => (
    (posterDraft.bullets || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6)
  ), [posterDraft.bullets]);
  const completedJuz = Object.values(progressDraft.juz || {}).filter((state) => state === 'completed').length;
  const progressPercent = Math.round((completedJuz / 30) * 100);

  function openPage(pageKey) {
    // If navigating to admin and not authenticated, show login tab
    if (pageKey === 'admin' && !adminLoggedIn) {
      setActivePage('admin');
      setActiveAdminTab('login');
      window.scrollTo(0, 0);
      return;
    }

    setActivePage(pageKey);
    window.scrollTo(0, 0);
    if (pageKey === 'admin') {
      setActiveAdminTab('dashboard');
    }
  }

  function handleAdminLogin(e) {
    e.preventDefault();
    // NOTE: This is a simple client-side check stored in memory/localStorage.
    // For production, use a server-side auth and avoid committing credentials.
    const allowedUser = 'hafsavmazb@gmail.com';
    const allowedPass = '309456@Farah';

    if (adminUser === allowedUser && adminPass === allowedPass) {
      setAdminLoggedIn(true);
      setAdminError(null);
      setActiveAdminTab('dashboard');
    } else {
      setAdminError('Invalid email or password');
      setAdminLoggedIn(false);
    }
  }

  function handleAdminLogout() {
    setAdminLoggedIn(false);
    setActiveAdminTab('login');
    setActivePage('home');
  }

  function submitEnrollment(event) {
    event.preventDefault();

    if (!enrollment.name.trim() || !enrollment.gender || !enrollment.course) {
      setEnrollmentFeedback({ kind: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    if (enrollment.gender === 'Male' && enrollment.age && Number(enrollment.age) >= 15) {
      setEnrollmentFeedback({ kind: 'error', text: 'Male students must be under 15 years old.' });
      return;
    }

    const newStudent = {
      id: Date.now(),
      name: enrollment.name.trim(),
      gender: enrollment.gender,
      age: enrollment.age,
      className: enrollment.className.trim(),
      course: enrollment.course,
      teacher: enrollment.teacher.trim(),
      phone: enrollment.phone.trim(),
      notes: enrollment.notes.trim(),
      enrolledAt: new Date().toISOString().split('T')[0],
      status: 'Active'
    };

    setStudents((current) => [...current, newStudent]);
    setEnrollment(initialEnrollment);
    setEnrollmentFeedback({ kind: 'success', text: 'Registration successful. The student has been enrolled.' });
    setActivePage('admin');
    setActiveAdminTab('dashboard');

    fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newStudent)
    }).catch(() => {
      setEnrollmentFeedback({ kind: 'error', text: 'Saved locally, but Supabase sync failed.' });
    });
  }

  function deleteStudent(studentId) {
    if (!window.confirm('Remove this student?')) return;

    setStudents((current) => current.filter((student) => student.id !== studentId));
    setProgressByStudent((current) => {
      const next = { ...current };
      delete next[String(studentId)];
      return next;
    });

    if (String(studentId) === progressStudentId) {
      setProgressStudentId('');
    }

    if (String(studentId) === posterStudentId) {
      resetPoster();
    }

    fetch(`/api/students/${studentId}`, {
      method: 'DELETE'
    }).catch(() => {
      setEnrollmentFeedback({ kind: 'error', text: 'Deleted locally, but Supabase sync failed.' });
    });
  }

  function selectProgressStudent(studentId) {
    setProgressStudentId(studentId);
    setProgressFeedback(null);
  }

  function toggleJuz(juzNumber) {
    setProgressDraft((current) => {
      const currentState = current.juz[juzNumber] || 'none';
      return {
        ...current,
        juz: {
          ...current.juz,
          [juzNumber]: cycleJuzStatus(currentState)
        }
      };
    });
  }

  function saveProgress() {
    if (!progressStudentId) return;

    const progressPayload = {
      teacher: progressDraft.teacher,
      examiner: progressDraft.examiner,
      mark: progressDraft.mark,
      notes: progressDraft.notes,
      juz: progressDraft.juz
    };

    setProgressByStudent((current) => ({
      ...current,
      [progressStudentId]: progressPayload
    }));

    setProgressFeedback({ kind: 'success', text: 'Progress saved successfully.' });

    fetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: progressStudentId, ...progressPayload })
    }).catch(() => {
      setProgressFeedback({ kind: 'error', text: 'Saved locally, but Supabase sync failed.' });
    });
  }

  function applyPosterStudent(studentId) {
    setPosterStudentId(studentId);

    if (!studentId) {
      setPosterDraft(defaultPosterDraft());
      setPosterPhoto('');
      return;
    }

    const student = students.find((entry) => String(entry.id) === studentId);
    if (!student) return;

    const savedProgress = progressByStudent[studentId] || {};
    const completed = Object.values(savedProgress.juz || {}).filter((state) => state === 'completed').length;

    setPosterDraft((current) => ({
      ...current,
      name: student.name.toUpperCase(),
      className: student.className || '',
      teacher: student.teacher || '',
      examiner: savedProgress.examiner || '',
      mark: savedProgress.mark ? `${savedProgress.mark}%` : '',
      juz: completed ? `${completed} Juz` : ''
    }));
  }

  function handlePosterPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      setPosterPhoto(String(readerEvent.target?.result || ''));
    };
    reader.readAsDataURL(file);
  }

  function resetPoster() {
    setPosterStudentId('');
    setPosterPhoto('');
    setPosterDraft(defaultPosterDraft());
  }

  async function downloadPoster() {
    const el = document.querySelector('.poster-preview');
    if (!el) {
      setPosterFeedback({ kind: 'error', text: 'Preview not found.' });
      return;
    }

    try {
      setPosterFeedback({ kind: 'info', text: 'Rendering PNG...' });
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true });
      canvas.toBlob((blob) => {
        if (!blob) {
          setPosterFeedback({ kind: 'error', text: 'Failed to render image.' });
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (posterDraft.headline || 'noorul-poster').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        a.download = `${safeName || 'poster'}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setPosterFeedback({ kind: 'success', text: 'Download started.' });
      }, 'image/png');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setPosterFeedback({ kind: 'error', text: 'Error creating PNG. Try Print instead.' });
    }
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <button className="nav-brand" onClick={() => openPage('home')}>
          <span className="nav-logo">نور</span>
          <span>
            <span className="nav-title">Noorul Academy</span>
            <span className="nav-subtitle">ONLINE QURAN & TAJWEED</span>
          </span>
        </button>

        <nav className="nav-links">
          {navigation.map((item) => (
            <button
              key={item.key}
              className={`nav-button ${activePage === item.key ? 'active' : ''} ${item.key === 'admin' ? 'admin-button' : ''}`}
              onClick={() => openPage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {activePage === 'home' ? (
          <>
            <section className="hero-section">
              <div className="hero-grid">
                <div>
                  <div className="hero-badge">For Girls & Boys Under 15</div>
                  <h1 className="hero-title">
                    Noorul <span>Academy</span>
                  </h1>
                  <p className="hero-tagline">نُورُ الْأَكَادِيمِي — Illuminating hearts through the sacred words of Allah</p>
                  <div className="hero-actions">
                    <button className="btn-primary" onClick={() => openPage('enrol')}>
                      Enrol Your Child
                    </button>
                    <button className="btn-outline" onClick={() => openPage('courses')}>
                      Our Courses
                    </button>
                  </div>
                  <div className="hero-stats">
                    <div>
                      <div className="stat-number">{dashboardTotals.total}</div>
                      <div className="stat-label">STUDENTS</div>
                    </div>
                    <div>
                      <div className="stat-number">5</div>
                      <div className="stat-label">FACULTIES</div>
                    </div>
                    <div>
                      <div className="stat-number">100%</div>
                      <div className="stat-label">ONLINE</div>
                    </div>
                  </div>
                </div>

                <aside className="hero-panel">
                  <div className="courses-title">OUR FACULTIES</div>
                  {faculties.map((faculty) => (
                    <div className="course-preview" key={faculty.name}>
                      <div className="course-preview-icon">{faculty.icon}</div>
                      <div>
                        <div className="course-preview-title">{faculty.name}</div>
                        <div className="course-preview-body">{faculty.desc}</div>
                      </div>
                      <div className="course-preview-tag">{faculty.tag}</div>
                    </div>
                  ))}
                </aside>
              </div>
            </section>

            <section className="section section-light">
              <div className="section-inner">
                <div className="about-grid">
                  <div>
                    <SectionHeader
                      label="ABOUT US"
                      title="Why Choose Noorul Academy?"
                      subtitle="A focused Quran and Tajweed programme for children and female students, organized for clarity and progression."
                    />

                    <ul className="about-list">
                      {aboutBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  </div>

                  <div className="about-card">
                    <div className="arabic-callout">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                    <p>"In the name of Allah, the Most Gracious, the Most Merciful"</p>
                    <div className="mission-block">
                      <div className="mission-label">OUR MISSION</div>
                      <p>To build a generation of Huffaz and practising Muslims through authentic Quranic education delivered with love and excellence.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-inner">
                <SectionHeader
                  label="FACULTIES"
                  title="Our Courses & Programmes"
                  subtitle="Each faculty is taught by qualified and experienced teachers with a clear curriculum."
                />

                <div className="faculty-grid">
                  {faculties.map((faculty) => (
                    <FacultyCard key={faculty.name} {...faculty} />
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {activePage === 'courses' ? (
          <section className="section">
            <div className="section-inner">
              <SectionHeader label="ALL COURSES" title="Our Five Faculties" />
              <div className="detail-list">
                {courseDetails.map((course) => (
                  <CourseCard key={course.name} {...course} />
                ))}
              </div>
              <div className="section-footer-action">
                <button className="btn-primary" onClick={() => openPage('enrol')}>
                  Enrol in a Course
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {activePage === 'enrol' ? (
          <section className="section enroll-section">
            <div className="section-inner section-inner-narrow">
              <SectionHeader
                label="ENROLMENT"
                title="Register Your Child"
                subtitle="Complete the form below to enrol. The current implementation stores entries locally and is ready to be wired to Supabase."
              />

              <form className="enrol-form" onSubmit={submitEnrollment}>
                <div className="form-row">
                  <label className="form-field">
                    <span>Student Full Name *</span>
                    <input value={enrollment.name} onChange={(event) => setEnrollment((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Fatima Al-Noor" />
                  </label>

                  <label className="form-field">
                    <span>Gender *</span>
                    <select value={enrollment.gender} onChange={(event) => setEnrollment((current) => ({ ...current, gender: event.target.value }))}>
                      <option value="">Select</option>
                      <option value="Female">Female (any age)</option>
                      <option value="Male">Male (under 15)</option>
                    </select>
                  </label>
                </div>

                <div className="form-row">
                  <label className="form-field">
                    <span>Age</span>
                    <input
                      type="number"
                      min="4"
                      max={enrollment.gender === 'Male' ? 14 : undefined}
                      value={enrollment.age}
                      onChange={(event) => setEnrollment((current) => ({ ...current, age: event.target.value }))}
                      placeholder={enrollment.gender === 'Female' ? 'e.g. 25' : 'e.g. 9'}
                    />
                  </label>

                  <label className="form-field">
                    <span>Class / Group</span>
                    <input value={enrollment.className} onChange={(event) => setEnrollment((current) => ({ ...current, className: event.target.value }))} placeholder="e.g. G48" />
                  </label>
                </div>

                <label className="form-field">
                  <span>Course / Faculty *</span>
                  <select value={enrollment.course} onChange={(event) => setEnrollment((current) => ({ ...current, course: event.target.value }))}>
                    <option value="">Select Course</option>
                    <option value="Hiflul Quran">Hiflul Quran</option>
                    <option value="Tajweed">Tajweed</option>
                    <option value="Nadhra Course">Nadhra Course</option>
                    <option value="Tarbiyyat">Tarbiyyat Course</option>
                    <option value="Daura">Daura (Revision)</option>
                  </select>
                </label>

                <div className="form-row">
                  <label className="form-field">
                    <span>Teacher Name</span>
                    <input value={enrollment.teacher} onChange={(event) => setEnrollment((current) => ({ ...current, teacher: event.target.value }))} placeholder="e.g. Ustadha Aisha" />
                  </label>

                  <label className="form-field">
                    <span>Parent/Guardian Phone</span>
                    <input value={enrollment.phone} onChange={(event) => setEnrollment((current) => ({ ...current, phone: event.target.value }))} placeholder="+971 50 000 0000" />
                  </label>
                </div>

                <label className="form-field">
                  <span>Notes (Optional)</span>
                  <textarea rows="3" value={enrollment.notes} onChange={(event) => setEnrollment((current) => ({ ...current, notes: event.target.value }))} placeholder="Any special requirements or notes..." />
                </label>

                <button className="btn-primary submit-button" type="submit">
                  Submit Enrolment
                </button>

                {enrollmentFeedback ? <div className={`alert alert-${enrollmentFeedback.kind}`}>{enrollmentFeedback.text}</div> : null}
              </form>
            </div>
          </section>
        ) : null}

        {activePage === 'parent' ? (
          <ParentProgressPage students={students} progressByStudent={progressByStudent} />
        ) : null}

        {activePage === 'admin' ? (
          <section className="admin-page">
            <div className="admin-header">
              <h2>Admin Panel — Noorul Academy</h2>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {adminLoggedIn ? <button className="btn-small btn-small-outline" onClick={handleAdminLogout}>Logout</button> : null}
                {adminLoggedIn ? (
                  <div className="admin-tabs">
                    {['dashboard', 'students', 'daily', 'progress', 'poster'].map((tab) => (
                      <button
                        key={tab}
                        className={`admin-tab ${activeAdminTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveAdminTab(tab)}
                      >
                        {tab === 'poster' ? '🎨 Poster Creator' : tab === 'daily' ? 'Daily Report' : tab}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="admin-body">
              {!adminLoggedIn || activeAdminTab === 'login' ? (
                <div className="admin-section active">
                  <div className="table-wrap" style={{padding: '1.25rem'}}>
                    <h3>Admin Login</h3>
                    <form onSubmit={handleAdminLogin} style={{maxWidth: 420}}>
                      <label className="form-field compact"><span>Email</span><input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} placeholder="you@example.com" /></label>
                      <label className="form-field compact"><span>Password</span><input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} placeholder="Password" /></label>
                      <div style={{display:'flex',gap:8}}>
                        <button className="btn-primary" type="submit">Sign in</button>
                        <button className="btn-small btn-small-outline" type="button" onClick={() => { setAdminUser(''); setAdminPass(''); setAdminError(null); }}>Clear</button>
                      </div>
                      {adminError ? <div className={`alert alert-error`} style={{marginTop:12}}>{adminError}</div> : null}
                    </form>
                    <p style={{marginTop:12,color:'var(--text-soft)',fontSize:'0.9rem'}}>Use the admin credentials to access the dashboard. For a secure solution, configure server-side auth.</p>
                  </div>
                </div>
              ) : null}

              {adminLoggedIn && activeAdminTab === 'dashboard' ? (
                <div className="admin-section active">
                  <div className="admin-cards">
                    <div className="admin-card admin-card-accent"><div className="admin-card-num">{dashboardTotals.total}</div><div className="admin-card-lbl">Total Students</div></div>
                    <div className="admin-card admin-card-accent"><div className="admin-card-num">{dashboardTotals.girls}</div><div className="admin-card-lbl">Female Students</div></div>
                    <div className="admin-card admin-card-accent"><div className="admin-card-num">{dashboardTotals.boys}</div><div className="admin-card-lbl">Male Students (U15)</div></div>
                    <div className="admin-card admin-card-accent"><div className="admin-card-num">{dashboardTotals.hifz}</div><div className="admin-card-lbl">In Hiflul Quran</div></div>
                  </div>

                  <div className="table-wrap">
                    <div className="table-head">
                      <h3>Recent Enrolments</h3>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>NAME</th>
                          <th>GENDER</th>
                          <th>COURSE</th>
                          <th>CLASS</th>
                          <th>TEACHER</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.length ? students.slice(-10).reverse().map((student) => (
                          <tr key={student.id}>
                            <td><strong>{student.name}</strong></td>
                            <td><span className={`badge ${student.gender === 'Female' ? 'badge-gold' : 'badge-navy'}`}>{student.gender}</span></td>
                            <td>{student.course}</td>
                            <td>{student.className || '—'}</td>
                            <td>{student.teacher || '—'}</td>
                            <td><span className="badge badge-green">{student.status}</span></td>
                          </tr>
                        )) : (
                          <tr><td colSpan="6" className="empty-state">No students enrolled yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {adminLoggedIn && activeAdminTab === 'students' ? (
                <div className="admin-section active">
                  <div className="admin-toolbar">
                    <h3>All Students</h3>
                    <button className="btn-small btn-small-primary" onClick={() => openPage('enrol')}>+ New Enrolment</button>
                  </div>

                  <div className="table-wrap">
                    <div className="table-head">
                      <h3>Student Registry</h3>
                      <input className="search-input" placeholder="Search name or course…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                    </div>

                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>NAME</th>
                          <th>GENDER</th>
                          <th>AGE</th>
                          <th>COURSE</th>
                          <th>CLASS</th>
                          <th>TEACHER</th>
                          <th>PHONE</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudents.length ? filteredStudents.map((student, index) => (
                          <tr key={student.id}>
                            <td>{index + 1}</td>
                            <td><strong>{student.name}</strong><br /><span className="row-subtext">{student.enrolledAt}</span></td>
                            <td><span className={`badge ${student.gender === 'Female' ? 'badge-gold' : 'badge-navy'}`}>{student.gender}</span></td>
                            <td>{student.age || '—'}</td>
                            <td>{student.course}</td>
                            <td>{student.className || '—'}</td>
                            <td>{student.teacher || '—'}</td>
                            <td>{student.phone || '—'}</td>
                            <td><button className="btn-small btn-small-outline" onClick={() => deleteStudent(student.id)}>Remove</button></td>
                          </tr>
                        )) : (
                          <tr><td colSpan="9" className="empty-state">No students found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {adminLoggedIn && activeAdminTab === 'daily' ? (
                <div className="admin-section active">
                  <DailyReportPanel students={students} />
                </div>
              ) : null}

              {adminLoggedIn && activeAdminTab === 'progress' ? (
                <div className="admin-section active">
                  <div className="progress-panel">
                    <h3>Student Progress Tracker</h3>
                    <div className="progress-select-row">
                      <select value={progressStudentId} onChange={(event) => selectProgressStudent(event.target.value)}>
                        <option value="">— Select Student —</option>
                        {students.map((student) => <option key={student.id} value={String(student.id)}>{student.name} ({student.course})</option>)}
                      </select>
                      <button className="btn-small btn-small-primary" onClick={saveProgress} disabled={!progressStudentId}>Save Progress</button>
                    </div>

                    {progressStudentId ? (
                      <div className="progress-form-shell">
                        <div className="progress-form-grid">
                          <label className="form-field compact"><span>TEACHER NAME</span><input value={progressDraft.teacher} onChange={(event) => setProgressDraft((current) => ({ ...current, teacher: event.target.value }))} placeholder="Teacher name" /></label>
                          <label className="form-field compact"><span>EXAMINER</span><input value={progressDraft.examiner} onChange={(event) => setProgressDraft((current) => ({ ...current, examiner: event.target.value }))} placeholder="Examiner name" /></label>
                          <label className="form-field compact"><span>MARK / GRADE (%)</span><input type="number" min="0" max="100" value={progressDraft.mark} onChange={(event) => setProgressDraft((current) => ({ ...current, mark: event.target.value }))} placeholder="e.g. 83" /></label>
                          <label className="form-field compact"><span>NOTES</span><input value={progressDraft.notes} onChange={(event) => setProgressDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Teacher notes" /></label>
                        </div>

                        <div className="form-field compact">
                          <span>JUZ PROGRESS</span>
                          <div className="juz-grid">
                            {Array.from({ length: 30 }, (_, index) => index + 1).map((juzNumber) => {
                              const status = progressDraft.juz[juzNumber] || 'none';
                              return (
                                <button key={juzNumber} className={`juz-box ${status === 'completed' ? 'completed' : status === 'inprogress' ? 'in-progress' : ''}`} onClick={() => toggleJuz(juzNumber)} type="button">
                                  Juz {juzNumber}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="progress-legend">
                          <span><i className="legend-swatch completed" /> Completed</span>
                          <span><i className="legend-swatch in-progress" /> In Progress</span>
                          <span><i className="legend-swatch none" /> Not Started</span>
                        </div>

                        <div className="form-field compact">
                          <span>OVERALL PROGRESS</span>
                          <div className="progress-bar-wrap">
                            <div className="progress-bar" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <div className="progress-caption">{completedJuz} of 30 Juz completed</div>
                        </div>

                        <button className="btn-primary submit-button" onClick={saveProgress} type="button">Save Progress</button>
                        {progressFeedback ? <div className={`alert alert-${progressFeedback.kind}`}>{progressFeedback.text}</div> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {adminLoggedIn && activeAdminTab === 'poster' ? (
                <div className="admin-section active">
                  <div className="poster-grid">
                    <div className="poster-controls">
                      <h3>Poster Details</h3>

                      <label className="form-field compact">
                        <span>SELECT STUDENT</span>
                        <select value={posterStudentId} onChange={(event) => applyPosterStudent(event.target.value)}>
                          <option value="">— Manual entry —</option>
                          {students.map((student) => <option key={student.id} value={String(student.id)}>{student.name}</option>)}
                        </select>
                      </label>

                      <label className="form-field compact">
                        <span>STUDENT PHOTO</span>
                        <input type="file" accept="image/*" onChange={handlePosterPhoto} />
                      </label>

                      <label className="form-field compact"><span>STUDENT NAME</span><input value={posterDraft.name} onChange={(event) => setPosterDraft((current) => ({ ...current, name: event.target.value }))} /></label>

                      <div className="form-row">
                        <label className="form-field compact">
                          <span>POSTER TYPE</span>
                          <select value={posterDraft.type} onChange={(event) => setPosterDraft((current) => ({ ...current, type: event.target.value }))}>
                            <option value="completion">Juz Completion</option>
                            <option value="full">Full Hifz</option>
                            <option value="exam">Exam Result</option>
                            <option value="marketing">Marketing Flyer</option>
                          </select>
                        </label>
                        <label className="form-field compact"><span>CONTACT PHONE</span><input value={posterDraft.ctaPhone} onChange={(event) => setPosterDraft((current) => ({ ...current, ctaPhone: event.target.value }))} /></label>
                      </div>

                      <button className="btn-small btn-small-gold poster-mode-button" type="button" onClick={() => setPosterDraft((current) => ({ ...current, type: 'marketing' }))}>
                        Use Marketing Flyer Template
                      </button>

                      {posterDraft.type === 'marketing' ? (
                        <>
                          <label className="form-field compact"><span>HEADLINE</span><input value={posterDraft.headline} onChange={(event) => setPosterDraft((current) => ({ ...current, headline: event.target.value }))} /></label>
                          <label className="form-field compact"><span>SUBHEADLINE</span><input value={posterDraft.subheadline} onChange={(event) => setPosterDraft((current) => ({ ...current, subheadline: event.target.value }))} /></label>
                          <label className="form-field compact"><span>REGISTER BADGE TITLE</span><input value={posterDraft.ctaTitle} onChange={(event) => setPosterDraft((current) => ({ ...current, ctaTitle: event.target.value }))} /></label>
                          <label className="form-field compact"><span>COURSE BULLETS (ONE PER LINE)</span><textarea rows="5" value={posterDraft.bullets} onChange={(event) => setPosterDraft((current) => ({ ...current, bullets: event.target.value }))} /></label>
                          <label className="form-field compact"><span>AUDIENCE NOTE</span><textarea rows="2" value={posterDraft.audienceNote} onChange={(event) => setPosterDraft((current) => ({ ...current, audienceNote: event.target.value }))} /></label>
                        </>
                      ) : (
                        <>
                          <div className="form-row">
                            <label className="form-field compact"><span>CLASS</span><input value={posterDraft.className} onChange={(event) => setPosterDraft((current) => ({ ...current, className: event.target.value }))} /></label>
                            <label className="form-field compact"><span>JUZ COMPLETED</span><input value={posterDraft.juz} onChange={(event) => setPosterDraft((current) => ({ ...current, juz: event.target.value }))} /></label>
                          </div>

                          <label className="form-field compact"><span>TEACHER</span><input value={posterDraft.teacher} onChange={(event) => setPosterDraft((current) => ({ ...current, teacher: event.target.value }))} /></label>
                          <label className="form-field compact"><span>EXAMINER</span><input value={posterDraft.examiner} onChange={(event) => setPosterDraft((current) => ({ ...current, examiner: event.target.value }))} /></label>
                          <label className="form-field compact"><span>MARK (%)</span><input value={posterDraft.mark} onChange={(event) => setPosterDraft((current) => ({ ...current, mark: event.target.value }))} /></label>
                        </>
                      )}

                      <div className="theme-picker">
                        {Object.entries(posterThemes).map(([themeKey, theme]) => (
                          <button key={themeKey} className={`theme-swatch ${posterDraft.theme === themeKey ? 'selected' : ''}`} style={{ background: theme.bg }} onClick={() => setPosterDraft((current) => ({ ...current, theme: themeKey }))} type="button" title={themeKey} />
                        ))}
                      </div>

                      <label className="form-field compact"><span>CUSTOM MESSAGE</span><textarea rows="2" value={posterDraft.message} onChange={(event) => setPosterDraft((current) => ({ ...current, message: event.target.value }))} /></label>
                    </div>

                    <div className="poster-preview-card">
                      <h3>Live Preview</h3>
                      <div className="poster-preview" style={{ '--poster-bg': posterTheme.bg, '--poster-accent': posterTheme.accent, '--poster-accent-light': posterTheme.accentLight }}>
                        {posterDraft.type === 'marketing' ? (
                          <>
                            <div className="poster-marketing-header">
                              <div className="poster-brand-row">
                                <span className="nav-logo poster-mini-logo">نور</span>
                                <div>
                                  <div className="poster-brand-title">NOORUL ACADEMY</div>
                                  <div className="poster-brand-subtitle">ONLINE QURAN & TAJWEED</div>
                                </div>
                              </div>
                              <div className="poster-marketing-badge">
                                <span>{posterDraft.ctaTitle || 'REGISTER NOW'}</span>
                                <strong>{posterDraft.ctaPhone || '+918943838168'}</strong>
                              </div>
                            </div>

                            <div className="poster-marketing-hero">
                              <h4>{posterDraft.headline || 'ONLINE HIFZUL QURAN'}</h4>
                              <p>{posterDraft.subheadline || 'Structured classes for girls and boys under 15'}</p>
                            </div>

                            <div className="poster-marketing-body">
                              <div className="poster-marketing-photo">
                                {posterPhoto ? <img src={posterPhoto} alt="Marketing preview" /> : <div className="poster-marketing-placeholder">Upload photo</div>}
                              </div>
                              <ul className="poster-marketing-list">
                                {(marketingPoints.length ? marketingPoints : ['Hifzul Quran', 'Tajweed', 'Nadhra Course', 'Tarbiyyat', 'Daura']).map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="poster-marketing-note">{posterDraft.audienceNote || 'We provide classes for girls and boys below 10'}</div>
                            <div className="poster-marketing-footer">Contact Now: {posterDraft.ctaPhone || '+918943838168'}</div>
                          </>
                        ) : (
                          <>
                            <div className="poster-preview-topline" />
                            <div className="poster-preview-header">
                              <div className="poster-brand-row">
                                <span className="nav-logo poster-mini-logo">نور</span>
                                <div>
                                  <div className="poster-brand-title">NOORUL ACADEMY</div>
                                  <div className="poster-brand-subtitle">ONLINE QURAN & TAJWEED</div>
                                </div>
                              </div>
                              <div className="poster-arabic">مَاشَاءَ ٱللَّهُ تَبَارَكَ ٱللَّهُ</div>
                            </div>

                            <div className="poster-name-card">
                              <div>
                                <div className="poster-name">{posterDraft.name}</div>
                                <div className="poster-type">{posterDraft.type === 'exam' ? 'EXAM RESULT' : posterDraft.type === 'full' ? 'FULL HIFZ CERTIFICATE' : 'JUZ COMPLETION CERTIFICATE'}</div>
                              </div>
                              <div className="poster-photo-wrap">
                                {posterPhoto ? <img src={posterPhoto} alt="Student preview" /> : <div className="poster-photo-placeholder">👤</div>}
                              </div>
                            </div>

                            <div className="poster-details-grid">
                              <div className="poster-detail-row"><span>Class</span><strong>{posterDraft.className || 'G00'}</strong></div>
                              <div className="poster-detail-row"><span>Teacher</span><strong>{posterDraft.teacher || 'Teacher Name'}</strong></div>
                              <div className="poster-detail-row"><span>Examiner</span><strong>{posterDraft.examiner || 'Examiner Name'}</strong></div>
                              <div className="poster-detail-row"><span>Completing</span><strong>{posterDraft.juz || '1 Juz'}</strong></div>
                              <div className="poster-detail-row"><span>Mark</span><strong>{posterDraft.mark || '—'}</strong></div>
                            </div>

                            <div className="poster-message-card">
                              <div className="poster-message-title">Congratulations</div>
                              <div className="poster-message-body">
                                {posterDraft.type === 'full'
                                  ? 'On Completing the Full Hifz of the Holy Quran'
                                  : posterDraft.type === 'exam'
                                    ? `Exam Completed — ${posterDraft.juz || '1 Juz'}`
                                    : `On Completing ${posterDraft.juz || '1 Juz'} Hifzul Quran`}
                              </div>
                              <div className="poster-message-note">{posterDraft.message}</div>
                            </div>

                            <div className="poster-footer">
                              <div>
                                <div className="poster-footer-label">CONTACT NOW</div>
                                <div className="poster-footer-phone">{posterDraft.ctaPhone || '+918943838168'}</div>
                              </div>
                              <div className="poster-footer-center">ONLINE HIFZUL QURAN COURSE</div>
                              <div className="poster-footer-badge">ADMISSION OPEN</div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="poster-actions">
                        <button className="btn-small btn-small-gold" onClick={downloadPoster} type="button">Download PNG</button>
                        <button className="btn-small btn-small-primary" onClick={() => window.print()} type="button">Print</button>
                        <button className="btn-small btn-small-outline" onClick={resetPoster} type="button">Reset</button>
                      </div>

                      {posterFeedback ? <div className={`alert alert-${posterFeedback.kind}`}>{posterFeedback.text}</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="site-footer">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">Noorul Academy</div>
            <p>نُورُ الْأَكَادِيمِي — Online Quran & Tajweed for kids and female learners. Illuminating hearts through the sacred words of Allah.</p>
          </div>

          <div>
            <div className="footer-heading">FACULTIES</div>
            <ul>
              {faculties.map((faculty) => <li key={faculty.name}>{faculty.name}</li>)}
            </ul>
          </div>

          <div>
            <div className="footer-heading">QUICK LINKS</div>
            <ul>
              {navigation.map((item) => (
                <li key={item.key}>
                  <button className="footer-link" onClick={() => openPage(item.key)}>{item.label}</button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2025 Noorul Academy. All rights reserved.</span>
          <span>Built for Girls & Boys Under 15</span>
        </div>
      </footer>
    </div>
  );
}
