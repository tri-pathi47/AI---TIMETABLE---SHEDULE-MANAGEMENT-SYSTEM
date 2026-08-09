const state = {
  mode: 'login',
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
const toastContainer = document.getElementById('toastContainer');

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
    const [summary, subjects, availability, timetable, weekly, notifications, insights, history] = await Promise.all([
      request('/dashboard/summary'),
      request('/subjects/'),
      request('/availability/'),
      request('/timetable/today'),
      request('/timetable/weekly-progress'),
      request('/dashboard/notifications'),
      request('/dashboard/insights'),
      request('/timetable/history'),
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
  authSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  setDashboardView('profile');
  refreshDashboard();
}

function setLoggedOut() {
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
        start_time: document.getElementById('startTime').value || null,
        end_time: document.getElementById('endTime').value || null,
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

function init() {
  initTheme();
  setAuthMode('login');
  setDefaultDates();
  setLoggedOut();

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
}

init();
