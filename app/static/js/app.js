const state = {
  mode: 'login',
  alarmsEnabled: false,
  leadMinutes: 10,
  aiEnabled: true,
  aiFrequency: 45,
  soundName: 'chime',
  volume: 70,
  customSong: null,
  customSongName: null,
  aiLastFired: Date.now(),
  firedSessionIds: new Set(),
  loggedIn: false,
};

const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const authForm = document.getElementById('authForm');
const authMessage = document.getElementById('authMessage');
const authSubmitBtn = document.getElementById('authSubmitBtn');

const tabs = document.querySelectorAll('.tab');
const usernameGroup = document.getElementById('usernameGroup');
const emailGroup = document.getElementById('emailGroup');
const confirmGroup = document.getElementById('confirmGroup');
const loginUsername = document.getElementById('loginUsername');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

const subjectForm = document.getElementById('subjectForm');
const availabilityForm = document.getElementById('availabilityForm');
const profileForm = document.getElementById('profileForm');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const generateScheduleBtn = document.getElementById('generateScheduleBtn');
const dashboardNavButtons = document.querySelectorAll('.nav-btn');
const dashboardPanels = document.querySelectorAll('.view-panel');

const subjectListEl = document.getElementById('subjectList');
const availabilityListEl = document.getElementById('availabilityList');
const timetableListEl = document.getElementById('timetableList');
const weeklyProgressChart = document.getElementById('weeklyProgressChart');
const notificationListEl = document.getElementById('notificationList');
const historyListEl = document.getElementById('historyList');
const badgeGrid = document.getElementById('badgeGrid');
const examScheduleListEl = document.getElementById('examScheduleList');
const toastContainer = document.getElementById('toastContainer');

const alarmsEnabledInput = document.getElementById('alarmsEnabled');
const alarmLeadTimeInput = document.getElementById('alarmLeadTime');
const aiEnabledInput = document.getElementById('aiEnabled');
const aiFrequencyInput = document.getElementById('aiFrequency');
const alarmSoundInput = document.getElementById('alarmSound');
const alarmVolumeInput = document.getElementById('alarmVolume');
const songFileInput = document.getElementById('songFileInput');
const songStatusEl = document.getElementById('songStatus');
const removeSongBtn = document.getElementById('removeSongBtn');
const testAlarmBtn = document.getElementById('testAlarmBtn');
const saveAlarmBtn = document.getElementById('saveAlarmBtn');
const alarmStatusMsg = document.getElementById('alarmStatusMsg');

let currentSubjects = [];

function notify(message, type = 'success') {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2600);
}

function addRipple(e) {
  const button = e.target.closest(
    'button, .primary-btn, .secondary-btn, .ghost-btn, .small-btn, .nav-btn, .tab, .danger-btn'
  );
  if (!button) return;

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 620);
}

function formatTime(value) {
  if (!value) return '--';

  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes} ${period}`;
}

function setTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('light-theme', !isDark);
  document.body.classList.toggle('dark-theme', isDark);
  localStorage.setItem('study-planner-theme', theme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('study-planner-theme') || 'dark';
  setTheme(savedTheme);
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
      setTheme(nextTheme);
    });
  }
}

function setAuthMode(mode) {
  state.mode = mode;
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));

  const isRegister = mode === 'register';
  usernameGroup.classList.toggle('hidden', !isRegister);
  emailGroup.classList.toggle('hidden', !isRegister);
  confirmGroup.classList.toggle('hidden', !isRegister);
  authSubmitBtn.textContent = isRegister ? 'Create account' : 'Login';
}

function showMessage(text, type = 'success') {
  authMessage.textContent = text;
  authMessage.classList.remove('hidden');
  authMessage.classList.remove('success', 'error');
  authMessage.classList.add(type === 'success' ? 'success' : 'error');
  notify(text, type);
}

function hideMessage() {
  authMessage.classList.add('hidden');
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : {};

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

async function refreshDashboard() {
  try {
    const [summary, subjects, availability, timetable, weekly, notifications, insights, history, examSchedule] = await Promise.all([
      request('/dashboard/summary'),
      request('/subjects/'),
      request('/availability/'),
      request('/timetable/today'),
      request('/timetable/weekly-progress'),
      request('/dashboard/notifications'),
      request('/dashboard/insights'),
      request('/timetable/history'),
      request('/dashboard/exam-schedule'),
    ]);

    const user = summary.user || {};
    document.getElementById('availableHoursValue').textContent = `${summary.available_hours || 0}h`;
    document.getElementById('totalSubjects').textContent = summary.total_subjects || 0;
    document.getElementById('totalSessions').textContent = summary.total_sessions || 0;
    document.getElementById('progressValue').textContent = `${summary.progress_percentage || 0}%`;

    const fullName = user.username || 'User';
    document.getElementById('profileName').textContent = fullName;
    document.getElementById('profileUsername').textContent = user.username || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profileGoal').textContent = `${summary.total_subjects || 0} subjects`;
    document.getElementById('profileCreated').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString() : '-';
    const initials = (user.username || 'U').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('profileInitials').textContent = initials;
    document.getElementById('profileUsernameInput').value = user.username || '';
    document.getElementById('profileEmailInput').value = user.email || '';

    renderSubjects(subjects.subjects || []);
    renderAvailability(availability.availability || []);
    renderTimetable(timetable.timetable || []);
    renderWeeklyProgress(weekly.weekly_progress || {});
    renderNotifications(notifications.notifications || []);
    renderInsights(insights);
    renderHistory(history.history || {});
    renderExamSchedule(examSchedule.schedule || []);
    renderTodaySummary(summary);
  } catch (error) {
    console.error(error);
    setLoggedOut();
  }
}

function renderTodaySummary(summary) {
  const summaryEl = document.getElementById('todaySummary');
  if (!summaryEl) return;

  if ((summary.total_hours || 0) > 0) {
    summaryEl.classList.remove('hidden');
    document.getElementById('todayProgressText').textContent =
      `${summary.completed_hours || 0}h of ${summary.total_hours}h completed`;
    document.getElementById('todayGoalText').textContent =
      summary.recommended_hours ? `Goal: ${summary.recommended_hours}h today` : '';
    const percent = summary.total_hours
      ? Math.min((summary.completed_hours / summary.total_hours) * 100, 100)
      : 0;
    document.getElementById('todayProgressBar').style.width = `${percent}%`;
  } else {
    summaryEl.classList.add('hidden');
  }
}

function renderInsights(data) {
  document.getElementById('currentStreakValue').textContent = data.current_streak || 0;
  document.getElementById('longestStreakValue').textContent = data.longest_streak || 0;
  document.getElementById('completedSessionsValue').textContent = data.completed_sessions || 0;
  document.getElementById('completedHoursValue').textContent = data.completed_hours || 0;
  renderBadges(data.badges || []);
}

function renderBadges(badges) {
  if (!badgeGrid) return;

  if (!badges.length) {
    badgeGrid.innerHTML = '<div class="empty-state">Complete sessions to start earning badges.</div>';
    return;
  }

  badgeGrid.innerHTML = badges.map((badge) => `
    <div class="badge-card ${badge.earned ? '' : 'locked'}">
      <div class="badge-icon">${badge.icon}</div>
      <strong>${badge.name}</strong>
      <span>${badge.description}</span>
    </div>
  `).join('');
}

function formatDay(day) {
  const parsed = new Date(day);
  if (isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function renderHistory(history) {
  if (!historyListEl) return;

  const entries = Object.entries(history || {});

  if (!entries.length) {
    historyListEl.innerHTML = '<div class="empty-state">No study history yet. Generate a timetable to get started.</div>';
    return;
  }

  historyListEl.innerHTML = entries.map(([day, sessions]) => {
    const done = sessions.filter((s) => s.completed).length;
    const totalHours = sessions.reduce((sum, s) => sum + (s.study_hours || 0), 0);
    const completedHours = sessions
      .filter((s) => s.completed)
      .reduce((sum, s) => sum + (s.study_hours || 0), 0);

    return `
      <div class="history-group">
        <div class="history-head">
          <strong>${formatDay(day)}</strong>
          <span class="meta-line">${done}/${sessions.length} done • ${completedHours}/${totalHours}h</span>
        </div>
        <div class="history-sessions">
          ${sessions.map((s) => `
            <div class="history-session ${s.completed ? 'is-done' : ''}">
              <span class="history-dot ${s.completed ? 'done' : 'pending'}"></span>
              <span>${s.subject}</span>
              <span class="meta-line">${formatTime(s.start_time)} → ${formatTime(s.end_time)} • ${s.study_hours}h</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderExamSchedule(items) {
  if (!examScheduleListEl) return;

  if (!items.length) {
    examScheduleListEl.innerHTML = '<div class="empty-state">No subjects yet. Add subjects with exam dates to build your exam schedule.</div>';
    return;
  }

  examScheduleListEl.innerHTML = items.map((item) => {
    const progress = item.estimated_hours
      ? Math.min(Math.round((item.completed_hours / item.estimated_hours) * 100), 100)
      : 0;

    const dateLabel = item.exam_date
      ? new Date(item.exam_date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'No date set';

    const daysLabel = item.days_left === null
      ? '—'
      : item.days_left < 0
        ? 'Passed'
        : `${item.days_left} day${item.days_left === 1 ? '' : 's'} left`;

    return `
      <div class="list-item exam-item">
        <div class="subject-info">
          <strong>${item.name}</strong>
          <div class="meta-line">${item.difficulty} • ${item.priority} • Exam ${dateLabel} • ${daysLabel}</div>
        </div>
        <div class="exam-metrics">
          <div class="exam-metric">
            <span>Done</span>
            <strong>${item.completed_hours}h</strong>
          </div>
          <div class="exam-metric">
            <span>Left</span>
            <strong>${item.remaining_hours}h</strong>
          </div>
          <div class="exam-metric">
            <span>Per day</span>
            <strong>${item.recommended_daily || 0}h</strong>
          </div>
        </div>
        <div class="exam-progress">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <small>${progress}% complete</small>
        </div>
      </div>`;
  }).join('');
}

function renderNotifications(items) {
  if (!notificationListEl) return;

  if (!items.length) {
    notificationListEl.innerHTML = '<div class="empty-state">No reminders right now.</div>';
    return;
  }

  notificationListEl.innerHTML = items.map((item) => `
    <div class="list-item reminder-item reminder-${item.priority || 'medium'}">
      <div>
        <div class="reminder-head">
          <strong>${item.title}</strong>
          <span class="reminder-badge ${item.type}">${item.type}</span>
        </div>
        <div class="meta-line">${item.message}</div>
      </div>
      ${item.time ? `<small class="reminder-time">${formatTime(item.time)}</small>` : ''}
    </div>
  `).join('');
}

function renderWeeklyProgress(data) {
  if (!weeklyProgressChart) return;

  const entries = Object.entries(data).slice(-7);

  if (!entries.length) {
    weeklyProgressChart.innerHTML = '<div class="empty-state">No weekly study data yet.</div>';
    return;
  }

  const maxHours = Math.max(...entries.map(([, value]) => Number(value.total_hours || 0)), 1);

  weeklyProgressChart.innerHTML = entries.map(([day, value]) => {
    const hours = Number(value.total_hours || 0);
    const height = Math.max((hours / maxHours) * 100, 8);
    const label = new Date(day).toLocaleDateString(undefined, { weekday: 'short' });

    return `
      <div class="chart-column">
        <span class="chart-bar-wrap">
          <span class="chart-bar" style="height: ${height}%"></span>
        </span>
        <span class="chart-label">${label}</span>
        <small>${hours}h</small>
      </div>
    `;
  }).join('');
}

function subjectItemHtml(subject) {
  return `
    <div class="list-item subject-item" data-subject-id="${subject.id}">
      <div class="subject-info">
        <strong>${subject.name}</strong>
        <div class="meta-line">${subject.difficulty} • ${subject.priority} • ${subject.estimated_hours}h${subject.exam_date ? ` • Exam ${subject.exam_date}` : ''}</div>
      </div>
      <div class="item-actions">
        <button class="ghost-btn" data-edit-subject="${subject.id}">Edit</button>
        <button class="small-btn" data-delete-subject="${subject.id}">Delete</button>
      </div>
    </div>`;
}

function subjectEditHtml(subject) {
  const options = (values, current) => values.map((value) =>
    `<option value="${value}" ${current === value ? 'selected' : ''}>${value}</option>`
  ).join('');

  return `
    <div class="list-item subject-edit" data-subject-id="${subject.id}">
      <div class="subject-edit-fields">
        <input class="subject-input" data-field="name" value="${subject.name}" placeholder="Subject name" />
        <select class="subject-input" data-field="difficulty">${options(['Easy', 'Moderate', 'Hard'], subject.difficulty)}</select>
        <select class="subject-input" data-field="priority">${options(['Low', 'Medium', 'High'], subject.priority)}</select>
        <input class="subject-input" data-field="estimated_hours" type="number" min="0" step="0.5" value="${subject.estimated_hours || 0}" placeholder="Hours" />
        <input class="subject-input" data-field="exam_date" type="date" value="${subject.exam_date || ''}" />
      </div>
      <div class="item-actions">
        <button class="primary-btn" data-save-subject="${subject.id}">Save</button>
        <button class="ghost-btn" data-cancel-subject>Cancel</button>
      </div>
    </div>`;
}

function renderSubjects(items) {
  currentSubjects = items;

  if (!items.length) {
    subjectListEl.innerHTML = '<div class="empty-state">No subjects yet. Add your first study goal.</div>';
    return;
  }

  subjectListEl.innerHTML = items.map(subjectItemHtml).join('');

  subjectListEl.querySelectorAll('[data-delete-subject]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.deleteSubject);
      try {
        await request(`/subjects/${id}`, { method: 'DELETE' });
        await refreshDashboard();
      } catch (error) {
        showMessage(error.message, 'error');
      }
    });
  });

  subjectListEl.querySelectorAll('[data-edit-subject]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.editSubject);
      const subject = items.find((item) => item.id === id);
      if (!subject) return;
      subjectListEl.querySelectorAll('.subject-edit').forEach((node) => node.remove());
      button.closest('.subject-item').outerHTML = subjectEditHtml(subject);
      attachSubjectEditHandlers(subject);
    });
  });
}

function attachSubjectEditHandlers(subject) {
  const editNode = subjectListEl.querySelector(`.subject-edit[data-subject-id="${subject.id}"]`);
  if (!editNode) return;

  editNode.querySelector('[data-cancel-subject]').addEventListener('click', () => {
    renderSubjects(currentSubjects);
  });

  editNode.querySelector('[data-save-subject]').addEventListener('click', async () => {
    const payload = {
      name: editNode.querySelector('[data-field="name"]').value.trim(),
      difficulty: editNode.querySelector('[data-field="difficulty"]').value,
      priority: editNode.querySelector('[data-field="priority"]').value,
      estimated_hours: Number(editNode.querySelector('[data-field="estimated_hours"]').value || 0),
      exam_date: editNode.querySelector('[data-field="exam_date"]').value || null,
    };

    if (!payload.name) {
      notify('Subject name is required', 'error');
      return;
    }

    try {
      await request(`/subjects/${subject.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      notify('Subject updated successfully', 'success');
      await refreshDashboard();
    } catch (error) {
      notify(error.message, 'error');
    }
  });
}

function renderAvailability(items) {
  if (!items.length) {
    availabilityListEl.innerHTML = '<div class="empty-state">No availability records yet.</div>';
    return;
  }

  availabilityListEl.innerHTML = items.map((item) => `
    <div class="list-item">
      <div>
        <strong>${item.date}</strong>
        <div class="meta-line">${item.available_hours}h • ${formatTime(item.start_time)} → ${formatTime(item.end_time)} • ${item.energy_level || 'N/A'}</div>
      </div>
      <div class="item-actions">
        <button class="small-btn" data-delete-availability="${item.id}">Delete</button>
      </div>
    </div>
  `).join('');

  availabilityListEl.querySelectorAll('[data-delete-availability]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.deleteAvailability);
      try {
        await request(`/availability/${id}`, { method: 'DELETE' });
        await refreshDashboard();
      } catch (error) {
        showMessage(error.message, 'error');
      }
    });
  });
}

function renderTimetable(items) {
  if (!items.length) {
    timetableListEl.innerHTML = '<div class="empty-state">No study sessions yet. Generate a timetable.</div>';
    return;
  }

  timetableListEl.innerHTML = items.map((item) => `
    <div class="list-item">
      <div>
        <strong>${item.subject}</strong>
        <div class="meta-line">${item.study_hours || item.hours}h • ${formatTime(item.start_time)} → ${formatTime(item.end_time)} • ${item.completed ? 'Completed' : 'Pending'}</div>
      </div>
      <div class="item-actions">
        ${!item.completed ? `<button class="secondary-btn" data-complete-timetable="${item.id}">Complete</button>` : '<span class="meta-line">Done</span>'}
      </div>
    </div>
  `).join('');

  timetableListEl.querySelectorAll('[data-complete-timetable]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.completeTimetable);
      try {
        await request(`/timetable/${id}/complete`, { method: 'POST' });
        await refreshDashboard();
      } catch (error) {
        showMessage(error.message, 'error');
      }
    });
  });
}

function setDashboardView(viewName) {
  dashboardPanels.forEach((panel) => {
    const shouldShow = panel.dataset.view === viewName;
    panel.classList.toggle('hidden', !shouldShow);
  });

  dashboardNavButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName);
  });
}

function setLoggedIn() {
  state.loggedIn = true;
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  setDashboardView('profile');
  refreshDashboard();
  loadAlarmSettings();
}

function setLoggedOut() {
  state.loggedIn = false;
  authSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  hideMessage();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  hideMessage();

  const isRegister = state.mode === 'register';
  const payload = {
    username: isRegister ? usernameInput.value.trim() : loginUsername.value.trim(),
    password: passwordInput.value,
    email: emailInput.value.trim(),
    confirm_password: confirmPasswordInput.value,
  };

  try {
    const endpoint = isRegister ? '/register' : '/login';
    const body = isRegister
      ? payload
      : { username: payload.username, password: payload.password };

    const result = await request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    showMessage(result.message, 'success');

    if (isRegister) {
      setAuthMode('login');
      authForm.reset();
      return;
    }

    authForm.reset();
    setLoggedIn();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleLogout() {
  try {
    await request('/logout', { method: 'POST' });
    setLoggedOut();
    authForm.reset();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleProfileSubmit(event) {
  event.preventDefault();

  try {
    const payload = {
      username: document.getElementById('profileUsernameInput').value.trim(),
      email: document.getElementById('profileEmailInput').value.trim(),
      current_password: document.getElementById('currentPasswordInput').value || '',
      new_password: document.getElementById('newPasswordInput').value || '',
    };

    const result = await request('/dashboard/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    showMessage(result.message, 'success');
    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleDeleteAccount() {
  const password = window.prompt('Type your password to confirm account deletion:');
  if (password === null) return;

  try {
    const result = await request('/dashboard/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });

    showMessage(result.message, 'success');
    setLoggedOut();
    authForm.reset();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleSubjectSubmit(event) {
  event.preventDefault();

  try {
    await request('/subjects/add', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('subjectName').value.trim(),
        difficulty: document.getElementById('subjectDifficulty').value,
        priority: document.getElementById('subjectPriority').value,
        exam_date: document.getElementById('examDate').value || null,
        estimated_hours: Number(document.getElementById('estimatedHours').value || 0),
      }),
    });

    subjectForm.reset();
    showMessage('Subject added successfully', 'success');
    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleAvailabilitySubmit(event) {
  event.preventDefault();

  try {
    await request('/availability/add', {
      method: 'POST',
      body: JSON.stringify({
        date: document.getElementById('availabilityDate').value,
        available_hours: Number(document.getElementById('availableHoursInput').value || 0),
        energy_level: document.getElementById('energyLevel').value,
      }),
    });

    availabilityForm.reset();
    showMessage('Availability saved successfully', 'success');
    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function generateTimetable() {
  try {
    await request('/timetable/generate', { method: 'POST' });
    showMessage('Timetable generated successfully', 'success');
    await refreshDashboard();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('availabilityDate').value = today;
  document.getElementById('examDate').value = today;
}

// ============================================================
// ALARMS & REMINDERS
// ============================================================

const SONG_DB_NAME = 'study-planner-songs';
const SONG_DB_STORE = 'songs';
const SONG_KEY = 'custom-song';

function openSongDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SONG_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SONG_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSongToDb(blob) {
  const db = await openSongDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONG_DB_STORE, 'readwrite');
    tx.objectStore(SONG_DB_STORE).put(blob, SONG_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getSongFromDb() {
  try {
    const db = await openSongDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SONG_DB_STORE, 'readonly');
      const request = tx.objectStore(SONG_DB_STORE).get(SONG_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return null;
  }
}

async function removeSongFromDb() {
  const db = await openSongDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SONG_DB_STORE, 'readwrite');
    tx.objectStore(SONG_DB_STORE).delete(SONG_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function makeTone({ frequency = 880, duration = 0.5, wave = 'sine', volume = 0.7 } = {}) {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.stop(context.currentTime + duration);
}

function playSoundByName(name, volume) {
  const level = (volume / 100) * 0.8 || 0.7;

  if (name === 'none') return;

  if (name === 'beep') {
    makeTone({ frequency: 1200, duration: 0.25, wave: 'square', volume: level });
    setTimeout(() => makeTone({ frequency: 1200, duration: 0.25, wave: 'square', volume: level }), 350);
    return;
  }

  if (name === 'soft') {
    makeTone({ frequency: 523.25, duration: 0.8, wave: 'sine', volume: level });
    return;
  }

  makeTone({ frequency: 880, duration: 0.3, wave: 'sine', volume: level });
  setTimeout(() => makeTone({ frequency: 1174.66, duration: 0.45, wave: 'sine', volume: level }), 350);
}

function playCustomSong(volume) {
  if (!state.customSong) return false;
  const audio = new Audio(URL.createObjectURL(state.customSong));
  audio.volume = (volume / 100) || 0.7;
  audio.play().catch(() => {});
  return true;
}

function playAlarm() {
  if (state.soundName === 'none' && !state.customSong) return;

  if (state.customSong) {
    playCustomSong(state.volume);
    return;
  }

  playSoundByName(state.soundName, state.volume);
}

function browserNotify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag: title });
  } catch (error) {
    notify(`${title}: ${body}`, 'success');
  }
}

async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    notify('Notifications are blocked in your browser settings.', 'error');
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function setAlarmInputs() {
  alarmsEnabledInput.checked = state.alarmsEnabled;
  alarmLeadTimeInput.value = String(state.leadMinutes);
  aiEnabledInput.checked = state.aiEnabled;
  aiFrequencyInput.value = String(state.aiFrequency);
  alarmSoundInput.value = state.soundName;
  alarmVolumeInput.value = String(state.volume);
  const hasSong = Boolean(state.customSong);
  songStatusEl.textContent = hasSong
    ? `Song chosen: ${state.customSongName} (plays on this device).`
    : 'No song chosen — pick one from this device (stays on this device).';
  removeSongBtn.classList.toggle('hidden', !hasSong);
}

function setAlarmStatus(text) {
  if (alarmStatusMsg) {
    alarmStatusMsg.textContent = text;
  }
}

async function loadAlarmSettings() {
  try {
    const [settingsResult, songBlob, songName] = await Promise.all([
      request('/dashboard/settings'),
      getSongFromDb(),
      new Promise((resolve) => {
        const raw = localStorage.getItem('study-planner-song-name');
        resolve(raw ? JSON.parse(raw) : null);
      }),
    ]);

    const settings = settingsResult.settings || {};
    state.alarmsEnabled = Boolean(settings.enabled);
    state.leadMinutes = settings.lead_minutes || 10;
    state.aiEnabled = settings.ai_enabled !== false;
    state.aiFrequency = settings.ai_frequency_minutes || 45;
    state.soundName = settings.sound_name || 'chime';
    state.volume = settings.volume ?? 70;
    state.customSong = songBlob;
    state.customSongName = songName;

    setAlarmInputs();

    if (state.alarmsEnabled) {
      ensureNotificationPermission();
    }
  } catch (error) {
    console.error('Failed to load alarm settings:', error);
  }
}

async function saveAlarmSettings() {
  state.alarmsEnabled = alarmsEnabledInput.checked;
  state.leadMinutes = Number(alarmLeadTimeInput.value);
  state.aiEnabled = aiEnabledInput.checked;
  state.aiFrequency = Number(aiFrequencyInput.value);
  state.soundName = alarmSoundInput.value;
  state.volume = Number(alarmVolumeInput.value);

  try {
    if (state.alarmsEnabled) {
      await ensureNotificationPermission();
    }

    await request('/dashboard/settings', {
      method: 'POST',
      body: JSON.stringify({
        enabled: state.alarmsEnabled,
        lead_minutes: state.leadMinutes,
        ai_enabled: state.aiEnabled,
        ai_frequency_minutes: state.aiFrequency,
        sound_name: state.soundName,
        volume: state.volume,
      }),
    });

    setAlarmStatus('Settings saved.');
    notify('Alarm settings saved', 'success');
  } catch (error) {
    setAlarmStatus(error.message);
    notify(error.message, 'error');
  }
}

function handleSongUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('audio/')) {
    notify('Please choose an audio file.', 'error');
    return;
  }

  state.customSong = file;
  state.customSongName = file.name;
  localStorage.setItem('study-planner-song-name', JSON.stringify(file.name));

  saveSongToDb(file)
    .then(() => {
      setAlarmInputs();
      notify('Song saved on this device', 'success');
    })
    .catch((error) => {
      console.error(error);
      notify('Could not save the song on this device.', 'error');
    });

  event.target.value = '';
}

async function handleRemoveSong() {
  state.customSong = null;
  state.customSongName = null;
  localStorage.removeItem('study-planner-song-name');
  try {
    await removeSongFromDb();
  } catch (error) {
    console.error(error);
  }
  setAlarmInputs();
  notify('Song removed', 'success');
}

function timeStringToMinutes(timeString) {
  if (!timeString) return null;
  const match = String(timeString).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

const AI_NUDGES = [
  'Time to study — your focus window is open. Start with the hardest subject first.',
  'Reminder: consistent 25-minute study blocks beat long, draining sessions.',
  'Keep your streak alive. Even 20 focused minutes count today.',
  'Take a short break, hydrate, and come back sharp for your next session.',
  'Your schedule is waiting for you. Check today\u2019s timetable and start studying.',
  'Small progress every day compounds. Open your planner and begin.',
  'Tip: silence notifications on your phone while studying to stay focused.',
  'Ready for the next session? Review your notes for 5 minutes before you start.',
];

async function fireAIAlert() {
  let remaining = 0;
  try {
    const summaryResult = await request('/dashboard/summary');
    remaining = summaryResult.total_sessions - summaryResult.completed_sessions;
  } catch (error) {
    return;
  }

  const message = AI_NUDGES[Math.floor(Math.random() * AI_NUDGES.length)];

  browserNotify('AI Study Coach', `${message}`);
  notify('AI Study Coach: ' + message, 'success');

  if (remaining > 0) {
    setTimeout(() => {
      browserNotify('You have sessions left', `${remaining} study session(s) still pending today.`);
    }, 1500);
  }
}

async function checkAlarmScheduler() {
  if (!state.loggedIn) return;
  if (!state.alarmsEnabled) return;

  let alertsResult;
  try {
    alertsResult = await request('/dashboard/ai-alerts');
  } catch (error) {
    return;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const alerts = alertsResult.alerts || [];

  alerts.forEach((alert) => {
    const startMinutes = timeStringToMinutes(alert.start_time);
    if (startMinutes === null) return;

    const sessionId = alert.id;
    const fireAt = startMinutes - (alert.lead_minutes || state.leadMinutes);

    if (nowMinutes === fireAt || (nowMinutes >= fireAt && nowMinutes < fireAt + 2)) {
      if (state.firedSessionIds.has(sessionId)) return;

      state.firedSessionIds.add(sessionId);
      playAlarm();
      browserNotify(
        `${alert.subject} starts soon`,
        `${alert.subject} begins at ${formatTime(alert.start_time)}. Get ready to study!`
      );
      notify(`Reminder: ${alert.subject} starts at ${formatTime(alert.start_time)}`, 'success');
    }
  });

  if (state.aiEnabled) {
    const elapsed = now.getTime() - state.aiLastFired;
    const shouldFire = state.aiLastFired === 0 || elapsed >= (state.aiFrequency * 60 * 1000);
    if (shouldFire && nowMinutes >= 480) {
      state.aiLastFired = now.getTime();
      fireAIAlert();
    }
  }
}

function startAlarmScheduler() {
  setInterval(checkAlarmScheduler, 60000);
}

function init() {
  initTheme();
  setAuthMode('login');
  setDefaultDates();
  setLoggedOut();

  document.addEventListener('click', addRipple);

  songFileInput.addEventListener('change', handleSongUpload);
  removeSongBtn.addEventListener('click', handleRemoveSong);
  testAlarmBtn.addEventListener('click', playAlarm);
  saveAlarmBtn.addEventListener('click', saveAlarmSettings);

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setAuthMode(tab.dataset.mode));
  });

  dashboardNavButtons.forEach((button) => {
    button.addEventListener('click', () => setDashboardView(button.dataset.view));
  });

  authForm.addEventListener('submit', handleAuthSubmit);
  logoutBtn.addEventListener('click', handleLogout);
  profileForm.addEventListener('submit', handleProfileSubmit);
  deleteAccountBtn.addEventListener('click', handleDeleteAccount);
  subjectForm.addEventListener('submit', handleSubjectSubmit);
  availabilityForm.addEventListener('submit', handleAvailabilitySubmit);
  generateScheduleBtn.addEventListener('click', generateTimetable);

  startAlarmScheduler();
}

init();
