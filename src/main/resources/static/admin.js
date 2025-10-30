// ==================== CONFIGURATION & GLOBAL VARIABLES ====================
const API_BASE_URL = 'http://localhost:8080/api';

// State Management
let currentTab = 'dashboard';
let currentNotifications = [];
let currentCorrectionRecord = null;
let allStudents = [];
let allAttendanceRecords = [];
let studentsCache = [];
let currentSortColumn = '';
let currentSortDirection = 'asc';
let currentManagementStudent = null;
let realtimeInterval = null;
let activeStudentsData = [];
let selectedStudentsForScheduling = new Set();
let liveTaskInterval = null;
let autoRefreshEnabled = true;
let liveTaskData = [];
let lastTaskUpdateTime = new Date();
let filteredAttendanceRecordsNew = [];
let currentAttendanceDateRange = '';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    loadInitialData();
    setDefaultDates();
    startPeriodicRefresh();
    initializeClock();
});

function checkAuthentication() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAuthenticated = urlParams.get('authenticated');

    if (!isAuthenticated || isAuthenticated !== 'true') {
        showAlert('Unauthorized access. Redirecting to login...', 'error');
        setTimeout(() => window.location.href = 'index.html', 3000);
        return false;
    }
    return true;
}

function initializeClock() {
    const timeDisplay = document.getElementById('currentTime');
    if (timeDisplay) {
        setInterval(() => {
            const now = new Date();
            timeDisplay.textContent = now.toLocaleTimeString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
        }, 1000);
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // ID badge formatting
    const idInputs = ['reportStudentId', 'newBadgeId', 'regIdBadgeNew'];
    idInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            // Remove existing listeners by cloning
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);

            // Add fresh listener
            newInput.addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '').slice(0, 4);
                if (this.value.length === 4 && (inputId === 'newBadgeId' || inputId === 'regIdBadgeNew')) {
                    validateBadge(this.value, inputId);
                }
            });
        }
    });

    // Form submissions
    const forms = {
        'timeCorrectionForm': submitTimeCorrection,
        'badgeManagementForm': submitBadgeChange,
        'hoursManagementForm': submitHoursChange,
        'statusManagementForm': submitStatusChange,
        'scheduleManagementForm': submitScheduleChange,
        'bulkScheduleForm': submitBulkSchedule,
        'deleteStudentForm': submitDeleteStudent
    };

    Object.entries(forms).forEach(([formId, handler]) => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handler(e);
            });
        }
    });

    // Close modals on outside click
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
            document.body.style.overflow = '';
        }
    });

    // Close dropdowns on outside click
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.actions-dropdown') && !event.target.closest('.date-range-selector')) {
            closeAllMenus();
            const dropdown = document.getElementById('dateRangeDropdown');
            if (dropdown) dropdown.classList.remove('show');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
                document.body.style.overflow = '';
            });
            closeAllMenus();
        }

        if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            loadTabData(currentTab);
            showAlert('Data refreshed', 'info');
        }
    });

    // Status dropdown change handler
    const statusSelect = document.getElementById('newStudentStatus');
    if (statusSelect) {
        statusSelect.addEventListener('change', function() {
            const warningDiv = document.getElementById('completionWarning');
            const submitBtn = document.getElementById('statusSubmitBtn');

            if (this.value === 'COMPLETED') {
                warningDiv?.classList.remove('d-none');
                if (submitBtn) {
                    submitBtn.textContent = 'Complete Student';
                    submitBtn.className = 'btn btn-warning';
                }
            } else {
                warningDiv?.classList.add('d-none');
                if (submitBtn) {
                    submitBtn.textContent = 'Update Status';
                    submitBtn.className = 'btn btn-primary';
                }
            }
        });
    }
}

function setupRegistrationFormListener() {
    const form = document.getElementById('studentRegistrationFormNew');
    if (!form) {
        console.warn('Registration form not found');
        return;
    }

    // Remove any existing listeners by cloning the form
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    // Add single event listener with capture phase to catch it first
    newForm.addEventListener('submit', registerStudentWithSchedule, true);

    return newForm;
}

function setDefaultDates() {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayStr = formatDate(today);
    const firstStr = formatDate(firstOfMonth);

    const dateInputs = ['reportStartDate', 'reportEndDate', 'studentReportStart', 'studentReportEnd'];
    dateInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = inputId.includes('Start') ? firstStr : todayStr;
        }
    });
}

async function loadInitialData() {
    showLoading();
    try {
        await Promise.all([
            loadDashboard(),
            loadAllStudents(),
            loadNotifications()
        ]);
    } catch (error) {
        console.error('Failed to load initial data:', error);
        showAlert('Failed to load initial data. Please refresh.', 'error');
    } finally {
        hideLoading();
    }
}

function setupDeleteEventListeners() {
    // Delete student form
    const deleteForm = document.getElementById('deleteStudentForm');
    if (deleteForm) {
        deleteForm.addEventListener('submit', submitDeleteStudent);
    }

    // Cleanup notifications form
    const cleanupForm = document.getElementById('cleanupNotificationsForm');
    if (cleanupForm) {
        cleanupForm.addEventListener('submit', submitCleanupNotifications);
    }
}

// Call this in your DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    setupDeleteEventListeners();
});

// ==================== TAB MANAGEMENT ====================
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabName}')"]`)?.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    const targetTab = document.getElementById(tabName);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
    }

    currentTab = tabName;

    if (tabName !== 'dashboard') stopRealtimeUpdates();
    if (tabName === 'liveTasks') {
        initializeLiveTaskUpdates();
    } else {
        stopLiveTaskPolling();
    }

    loadTabData(tabName);
}

async function loadTabData(tabName) {
    switch (tabName) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'students':
            await loadAllStudents();
            break;
        case 'corrections':
            await loadIncompleteRecords();
            break;
        case 'schedules':
            await loadScheduleOverview();
            await loadLateArrivals();
            break;
        case 'liveTasks':
            await loadLiveTaskUpdates();
            break;
        case 'notifications':
            await loadNotificationsTab();
            break;
        case 'settings':
            await loadSettings();
            break;
    }
}

// ==================== DASHBOARD FUNCTIONS ====================
async function loadDashboard() {
    try {
        const today = formatDate(new Date());

        const [studentsResponse, todayRecordsResponse, activeSessionsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/students/all`),
            fetch(`${API_BASE_URL}/attendance/records?date=${today}`),
            fetch(`${API_BASE_URL}/admin/attendance/active-sessions`) // NEW: Get all active sessions
        ]);

        // Load all students
        if (studentsResponse.ok) {
            const students = await studentsResponse.json();
            allStudents = students;
            document.getElementById('totalStudents').textContent = students.length;
        }

        // Load today's records for display
        let todayRecords = [];
        if (todayRecordsResponse.ok) {
            todayRecords = await todayRecordsResponse.json();
        }

        // Load ALL currently active sessions (regardless of date)
        let activeSessions = [];
        if (activeSessionsResponse.ok) {
            activeSessions = await activeSessionsResponse.json();
        }

        // Combine: Show today's completed records + all active sessions
        const displayRecords = [...todayRecords.filter(r => r.status !== 'TIMED_IN'), ...activeSessions];
        allAttendanceRecords = displayRecords;
        activeStudentsData = activeSessions; // All currently timed-in students

        // Calculate stats
        const completedHours = todayRecords
            .filter(r => r.status !== 'TIMED_IN')
            .reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);

        // Update dashboard stats
        document.getElementById('timedInStudents').textContent = activeStudentsData.length;
        document.getElementById('todayRecords').textContent = todayRecords.length;

        // Calculate and display total hours
        if (activeStudentsData.length > 0) {
            const initialTotal = calculateRealtimeTotalHours();
            document.getElementById('totalHoursToday').textContent = formatHoursMinutes(initialTotal);
            startRealtimeUpdates();
        } else {
            stopRealtimeUpdates();
            document.getElementById('totalHoursToday').textContent = formatHoursMinutes(completedHours);
        }

        // Display the combined records
        displayDashboardRecords(displayRecords);

        await loadWeeklyChart();
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showAlert('Failed to load dashboard data', 'error');
    }
}

function displayDashboardRecords(records) {
    const tbody = document.getElementById('dashboardBody');

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><h3>No activity today</h3></td></tr>';
        return;
    }

    const studentsMap = {};
    allStudents.forEach(student => {
        studentsMap[student.idBadge] = student;
    });

    tbody.innerHTML = records.map(record => {
        const student = studentsMap[record.idBadge] || {};
        return `
            <tr>
                <td><strong>${record.studentName || 'Unknown'}</strong></td>
                <td><span class="badge-number">${record.idBadge}</span></td>
                <td><span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">${record.status?.replace('_', ' ') || 'Unknown'}</span></td>
                <td>${record.timeIn ? formatTime(record.timeIn) : '-'}</td>
                <td>${record.timeOut ? formatTime(record.timeOut) : '-'}</td>
                <td><strong>${formatHoursMinutes(record.totalHours || 0)}</strong></td>
                <td><strong>${formatHoursMinutes(student.totalAccumulatedHours || 0)}</strong></td>
            </tr>
        `;
    }).join('');
}

async function loadWeeklyChart() {
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 6);

        const response = await fetch(`${API_BASE_URL}/attendance/records?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`);

        if (response.ok && typeof Chart !== 'undefined') {
            const records = await response.json();
            createAttendanceChart(records);
        }
    } catch (error) {
        console.error('Failed to load chart data:', error);
    }
}

function createAttendanceChart(records) {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx || typeof Chart === 'undefined') return;

    const last7Days = [];
    const hoursData = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = formatDate(date);

        last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));

        const dayRecords = records.filter(record => formatDate(record.attendanceDate) === dateStr);
        const totalHours = dayRecords.reduce((sum, record) => sum + (parseFloat(record.totalHours) || 0), 0);
        hoursData.push(totalHours);
    }

    if (window.attendanceChart instanceof Chart) {
        window.attendanceChart.destroy();
    }

    try {
        window.attendanceChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Total Hours',
                    data: hoursData,
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(102, 126, 234)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Hours' }
                    },
                    x: {
                        title: { display: true, text: 'Date' }
                    }
                },
                plugins: {
                    title: { display: false },
                    legend: { display: false }
                }
            }
        });
    } catch (error) {
        console.error('Failed to create chart:', error);
    }
}

// Real-time hours calculation
function calculateRealtimeTotalHours() {
    const now = new Date();
    let totalRealTimeHours = 0;

    allAttendanceRecords.forEach(record => {
        if (record.status !== 'TIMED_IN' && record.totalHours) {
            totalRealTimeHours += parseFloat(record.totalHours);
        }
    });

    activeStudentsData.forEach(student => {
        if (student.timeIn) {
            const timeInDate = new Date(student.timeIn);
            const workingHours = (now - timeInDate) / (1000 * 60 * 60);
            totalRealTimeHours += Math.max(0, workingHours);
        }
    });

    return totalRealTimeHours;
}

function updateRealtimeStats() {
    if (activeStudentsData.length > 0) {
        const realtimeTotal = calculateRealtimeTotalHours();
        document.getElementById('totalHoursToday').textContent = formatHoursMinutes(realtimeTotal);
    }
}

function startRealtimeUpdates() {
    if (realtimeInterval) clearInterval(realtimeInterval);
    if (activeStudentsData.length > 0) {
        realtimeInterval = setInterval(updateRealtimeStats, 60000);
    }
}

function stopRealtimeUpdates() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
        realtimeInterval = null;
    }
}

// ==================== STUDENT MANAGEMENT ====================
async function loadAllStudents() {
    try {
        const response = await fetch(`${API_BASE_URL}/students/all`);
        if (response.ok) {
            const students = await response.json();
            allStudents = students;
            studentsCache = students;
            await displayStudentsTableNew(students);
        }
    } catch (error) {
        console.error('Failed to load students:', error);
        showAlert('Failed to load students', 'error');
    }
}

async function displayStudentsTableNew(students) {
    const tbody = document.getElementById('studentsBodyNew');

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state-modern">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <h3>No students found</h3>
                    <p>Try adjusting your filters or register new students</p>
                </td>
            </tr>
        `;
        updateSidebarStats(students);
        return;
    }

    // Fetch ALL currently active sessions (not just today's)
    let activeSessionsMap = {};
    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/active-sessions`);
        if (response.ok) {
            const activeSessions = await response.json();
            // Create a map of idBadge -> record for quick lookup
            activeSessions.forEach(record => {
                activeSessionsMap[record.idBadge] = record;
            });
        } else {
            console.warn('Active sessions endpoint returned error:', response.status);
            // Continue without active sessions data
        }
    } catch (error) {
        console.error('Failed to load active sessions:', error);
        // Continue without active sessions data - don't block student display
    }

    tbody.innerHTML = students.map(student => {
        // Check if student has an active session
        const studentRecord = activeSessionsMap[student.idBadge];
        const totalHours = parseFloat(student.totalAccumulatedHours || 0);
        const requiredHours = student.requiredHours ? parseFloat(student.requiredHours) : null;
        const hasRequiredHours = requiredHours !== null && requiredHours > 0;

        let progressDisplay = 'N/A';
        let progressPercentage = 0;

        if (hasRequiredHours) {
            progressPercentage = Math.min((totalHours / requiredHours) * 100, 100);
            const progressClass = Math.floor(progressPercentage / 10);
            progressDisplay = `
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill progress-fill-${progressClass}" style="width: ${progressPercentage.toFixed(1)}%;"></div>
                    </div>
                    <div class="progress-text">${progressPercentage.toFixed(1)}%</div>
                </div>
            `;
        }

        const attendanceStatus = determineStudentAttendanceStatus(studentRecord);

        return `
            <tr>
                <td><span class="badge-number">${student.idBadge || 'N/A'}</span></td>
                <td>
                    <div class="student-name-cell">
                        <strong>${student.fullName}</strong>
                        ${attendanceStatus ? `<div class="attendance-indicator ${attendanceStatus.class}">${attendanceStatus.label}</div>` : ''}
                    </div>
                </td>
                <td class="school-cell" title="${student.school || 'N/A'}">${student.school || 'N/A'}</td>
                <td>
                    <span class="status-badge status-${(student.status || 'active').toLowerCase()}">
                        ${student.status || 'ACTIVE'}
                    </span>
                </td>
                <td>${progressDisplay}</td>
                <td>
                    <div class="hours-display">
                        <strong>${formatHoursMinutes(totalHours)}</strong>
                        ${hasRequiredHours ? `<span class="hours-remaining"> / ${formatHoursMinutes(requiredHours)}</span>` : ''}
                    </div>
                </td>
                <td class="actions-column">
                    <div class="student-row-actions">
                        <button class="action-btn-primary" onclick="viewStudentProgress('${student.idBadge}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            View
                        </button>
                        <div class="actions-dropdown" style="position: relative;">
                            <button class="action-btn-menu" onclick="toggleStudentActionsMenu(event, ${student.id})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                </svg>
                            </button>
                            <div class="student-actions-menu" id="student-menu-${student.id}">
                                ${student.status !== 'COMPLETED' ? `
                                    <button class="menu-item" onclick="showBadgeModal(${student.id}, '${student.idBadge}', '${student.fullName}'); closeAllMenus()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        Change Badge
                                    </button>
                                    <button class="menu-item" onclick="showHoursModal(${student.id}, '${student.fullName}', ${requiredHours || 0}); closeAllMenus()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <polyline points="12 6 12 12 16 14"></polyline>
                                        </svg>
                                        Set Required Hours
                                    </button>
                                    <button class="menu-item" onclick="showScheduleModal(${student.id}, '${student.fullName}'); closeAllMenus()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        Schedule
                                    </button>
                                    <button class="menu-item ${progressPercentage >= 100 ? 'highlight-complete' : ''}"
                                            onclick="showStatusModal(${student.id}, '${student.fullName}', '${student.status || 'ACTIVE'}'); closeAllMenus()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        ${progressPercentage >= 100 ? '🎉 Mark as Completed' : 'Change Status'}
                                    </button>
                                    <div class="menu-divider"></div>
                                    <button class="menu-item danger" onclick="showDeleteStudentModal(${student.id}, '${student.fullName}', '${student.idBadge}', '${student.status || 'ACTIVE'}'); closeAllMenus()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                        Delete Student
                                    </button>
                                ` : `
                                    <button class="menu-item" disabled>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        Completed
                                    </button>
                                    <div class="menu-divider"></div>
                                    <button class="menu-item danger" onclick="showDeleteStudentModal(${student.id}, '${student.fullName}', '${student.idBadge}', 'COMPLETED'); closeAllMenus()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                        Delete Student
                                    </button>
                                `}
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateSidebarStats(students);
}

function toggleStudentActionsMenu(event, studentId) {
    event.stopPropagation();
    const menu = document.getElementById(`student-menu-${studentId}`);
    const allMenus = document.querySelectorAll('.student-actions-menu');

    // Close all other menus
    allMenus.forEach(m => {
        if (m.id !== `student-menu-${studentId}`) {
            m.classList.remove('show');
            m.classList.remove('position-above');
        }
    });

    // Toggle current menu
    const isOpening = !menu.classList.contains('show');

    if (isOpening) {
        menu.classList.add('show');

        //Check if menu goes off-screen and adjust position
        setTimeout(() => {
            const menuRect = menu.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const spaceBelow = windowHeight - menuRect.bottom;

            // If not enough space below (less than 20px), position above
            if (spaceBelow < 20) {
                menu.classList.add('position-above');
            } else {
                menu.classList.remove('position-above');
            }
        }, 10);
    } else {
        menu.classList.remove('show');
        menu.classList.remove('position-above');
    }
}

function closeAllMenus() {
    document.querySelectorAll('.student-actions-menu').forEach(menu => {
        menu.classList.remove('show');
    });
}

function determineStudentAttendanceStatus(record) {
    if (!record) {
        return { label: 'Not Active Today', class: 'not-active' };
    }

    const statusMap = {
        'TIMED_IN': { label: 'Currently Active', class: 'timed-in' },
        'TIMED_OUT': { label: 'Completed Today', class: 'timed-out' },
        'AUTO_TIMED_OUT': { label: 'Auto Timed Out', class: 'auto-timed-out' },
        'ADMIN_CORRECTED': { label: 'Admin Corrected', class: 'admin-corrected' }
    };

    return statusMap[record.status] || { label: 'Status Unknown', class: 'unknown' };
}

function updateSidebarStats(students) {
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
    const completedStudents = students.filter(s => s.status === 'COMPLETED').length;

    const studentsWithHours = students.filter(s => s.requiredHours && s.requiredHours > 0);
    const nearCompletion = studentsWithHours.filter(s => {
        if (s.status !== 'ACTIVE') return false;
        const progress = (parseFloat(s.totalAccumulatedHours || 0) / parseFloat(s.requiredHours)) * 100;
        return progress >= 90 && progress < 100;
    }).length;

    document.getElementById('sidebarTotalStudents').textContent = totalStudents;
    document.getElementById('sidebarActiveStudents').textContent = activeStudents;
    document.getElementById('sidebarCompletedStudents').textContent = completedStudents;

    document.getElementById('chipAllCount').textContent = totalStudents;
    document.getElementById('chipActiveCount').textContent = activeStudents;
    document.getElementById('chipCompletedCount').textContent = completedStudents;
    document.getElementById('chipNearCount').textContent = nearCompletion;
}

function loadStudentsByStatusNew(statusFilter) {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });

    document.querySelector(`[data-filter="${statusFilter}"]`).classList.add('active');

    let filtered = studentsCache;

    switch(statusFilter) {
        case 'active':
            filtered = studentsCache.filter(s => s.status === 'ACTIVE');
            break;
        case 'completed':
            filtered = studentsCache.filter(s => s.status === 'COMPLETED');
            break;
        case 'near-completion':
            filtered = studentsCache.filter(s => {
                if (!s.requiredHours || s.status !== 'ACTIVE') return false;
                const progress = (parseFloat(s.totalAccumulatedHours || 0) / parseFloat(s.requiredHours)) * 100;
                return progress >= 90 && progress < 100;
            });
            break;
    }

    displayStudentsTableNew(filtered);
}

function filterStudentsNew() {
    const searchTerm = document.getElementById('studentSearchNew').value.toLowerCase();

    let filteredStudents = studentsCache.filter(student => {
        const matchesSearch = !searchTerm ||
            student.fullName.toLowerCase().includes(searchTerm) ||
            student.idBadge.toLowerCase().includes(searchTerm) ||
            (student.school && student.school.toLowerCase().includes(searchTerm));

        return matchesSearch;
    });

    displayStudentsTableNew(filteredStudents);
}

function sortStudentsTable(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    const sorted = [...studentsCache].sort((a, b) => {
        let aValue, bValue;

        switch (column) {
            case 'idBadge':
                aValue = a.idBadge || '';
                bValue = b.idBadge || '';
                break;
            case 'fullName':
                aValue = a.fullName.toLowerCase();
                bValue = b.fullName.toLowerCase();
                break;
            case 'totalHours':
                aValue = parseFloat(a.totalAccumulatedHours || 0);
                bValue = parseFloat(b.totalAccumulatedHours || 0);
                break;
            default:
                return 0;
        }

        if (currentSortDirection === 'asc') {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
    });

    displayStudentsTableNew(sorted);
}

// ==================== STUDENT REGISTRATION ====================
function showRegisterStudentModal() {
    const modal = document.getElementById('studentRegistrationModal');
    if (modal) {
        clearRegistrationFormNew();

        // Setup clean form listener
        const form = setupRegistrationFormListener();

        // Re-attach badge validation listener
        const badgeInput = document.getElementById('regIdBadgeNew');
        if (badgeInput) {
            // Clear and re-attach
            const newBadgeInput = badgeInput.cloneNode(true);
            badgeInput.parentNode.replaceChild(newBadgeInput, badgeInput);

            newBadgeInput.addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '').slice(0, 4);
                if (this.value.length === 4) {
                    validateBadge(this.value, 'regIdBadgeNew');
                }
            });
        }

        // Make sure submit button is enabled
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Register Student
            `;
        }

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Focus on badge input after modal animation
        setTimeout(() => {
            const input = document.getElementById('regIdBadgeNew');
            if (input) input.focus();
        }, 300);
    }
}

function clearRegistrationFormNew() {
    document.getElementById('studentRegistrationFormNew').reset();
    document.getElementById('regStartTimeNew').value = '10:00';
    document.getElementById('regEndTimeNew').value = '19:00';
    document.getElementById('regGracePeriodNew').value = '5';
    document.getElementById('regScheduleActiveNew').value = 'true';

    const validation = document.getElementById('regBadgeValidation');
    if (validation) validation.innerHTML = '';
}

async function validateBadge(badgeId, inputId) {
    const validationId = inputId === 'regIdBadgeNew' ? 'regBadgeValidation' : 'newBadgeValidation';
    const validationDiv = document.getElementById(validationId);

    // Clear validation if badge is empty or not 4 digits
    if (!badgeId || badgeId.length !== 4) {
        if (validationDiv) validationDiv.innerHTML = '';
        return false;
    }

    // Show checking state
    if (validationDiv) {
        validationDiv.innerHTML = '<div class="validation-message checking">Checking availability...</div>';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/students/check-badge/${badgeId}`);

        if (!response.ok) {
            if (validationDiv) {
                validationDiv.innerHTML = '<div class="validation-message checking">Unable to verify badge</div>';
            }
            return false;
        }

        const data = await response.json();

        if (validationDiv) {
            if (data.available) {
                validationDiv.innerHTML = '<div class="validation-message available">✓ Badge available</div>';
                return true;
            } else {
                validationDiv.innerHTML = '<div class="validation-message unavailable">✗ Badge is already taken</div>';
                return false;
            }
        }
    } catch (error) {
        console.error('Badge validation error:', error);
        if (validationDiv) {
            validationDiv.innerHTML = '<div class="validation-message checking">Unable to verify badge</div>';
        }
        return false;
    }
}

async function registerStudentWithSchedule(event) {
    // CRITICAL: Stop form submission immediately
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }

    // Prevent double submissions
    const form = document.getElementById('studentRegistrationFormNew');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Check if already processing
    if (submitBtn.disabled) {
        console.log('⚠️ Registration already in progress, ignoring duplicate submission');
        return;
    }

    // Disable submit button immediately
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; margin: 0 auto;"></div> Registering...';

    const idBadge = document.getElementById('regIdBadgeNew').value.trim();
    const fullName = document.getElementById('regFullNameNew').value.trim();
    const school = document.getElementById('regSchoolNew').value.trim();
    const requiredHours = document.getElementById('regRequiredHoursNew').value.trim();

    const startTime = document.getElementById('regStartTimeNew').value;
    const endTime = document.getElementById('regEndTimeNew').value;
    const gracePeriod = parseInt(document.getElementById('regGracePeriodNew').value);
    const scheduleActive = document.getElementById('regScheduleActiveNew').value === 'true';

    // Validation
    if (!idBadge || !fullName || !school || !requiredHours) {
        showAlert('Please fill in all required fields', 'warning');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
    }

    if (!/^\d{4}$/.test(idBadge)) {
        showAlert('ID badge must be exactly 4 digits', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
    }

    const hoursNum = parseInt(requiredHours);
    if (hoursNum < 1 || hoursNum > 2000) {
        showAlert('Required hours must be between 1 and 2000', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
    }

    if (scheduleActive && startTime && endTime && startTime >= endTime) {
        showAlert('Start time must be before end time', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
    }

    showLoading();

    // Flag to prevent duplicate notifications
    let notificationShown = false;
    let studentData = null;

    try {
        // Step 1: Register the student
        console.log('📝 Attempting to register student:', { idBadge, fullName, school, requiredHours: hoursNum });

        const registerResponse = await fetch(`${API_BASE_URL}/students/register-with-hours`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idBadge, fullName, school, requiredHours: hoursNum })
        });

        if (!registerResponse.ok) {
            const errorData = await registerResponse.json();
            throw new Error(errorData.message || 'Registration failed');
        }

        studentData = await registerResponse.json();
        console.log('✅ Student registered:', studentData);

        // Step 2: Try to set schedule (if enabled)
        let scheduleSuccess = false;
        let scheduleAttempted = false;

        if (scheduleActive && startTime && endTime) {
            scheduleAttempted = true;
            console.log('📅 Attempting to set schedule...');

            try {
                const scheduleResponse = await fetch(`${API_BASE_URL}/admin/students/${studentData.id}/schedule`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        startTime,
                        endTime,
                        gracePeriodMinutes: gracePeriod,
                        active: true
                    })
                });

                if (scheduleResponse.ok) {
                    scheduleSuccess = true;
                    console.log('✅ Schedule set successfully');
                } else {
                    const scheduleError = await scheduleResponse.json();
                    console.warn('⚠️ Schedule setup failed:', scheduleError);
                }
            } catch (scheduleError) {
                console.error('❌ Schedule error:', scheduleError);
                // Don't throw - student was registered successfully
            }
        }

        // CLOSE MODAL AND SHOW NOTIFICATION
        hideLoading();
        closeModal('studentRegistrationModal');

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;

        // Determine which notification to show
        if (scheduleAttempted && !scheduleSuccess) {
            showAlert(`Student ${studentData.fullName} registered successfully, but schedule setup failed. You can set the schedule later.`, 'warning');
        } else if (scheduleAttempted && scheduleSuccess) {
            showAlert(`Student ${studentData.fullName} registered successfully with schedule!`, 'success');
        } else {
            showAlert(`Student ${studentData.fullName} registered successfully!`, 'success');
        }

        notificationShown = true;
        console.log('Registration completed successfully');

        // Reload data in background (don't await to prevent delays)
        loadAllStudents().catch(err => console.error('Failed to reload students:', err));
        loadDashboard().catch(err => console.error('Failed to reload dashboard:', err));

    } catch (error) {
        hideLoading();
        console.error('Registration error:', error);

        // Reset button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;

        // Only show error notification if we haven't shown success
        if (!notificationShown) {
            showAlert(error.message || 'Registration failed. Please try again.', 'error');
        }
    }
}

// ==================== STUDENT MANAGEMENT MODALS ====================
function showBadgeModal(studentId, currentBadge, studentName) {
    currentManagementStudent = { id: studentId, badge: currentBadge, name: studentName };

    document.getElementById('badgeStudentInfo').innerHTML = `
        <div class="student-detail">
            <h4>${studentName}</h4>
            <p><strong>Current Badge:</strong> ${currentBadge}</p>
        </div>
    `;

    document.getElementById('newBadgeId').value = '';
    document.getElementById('newBadgeValidation').innerHTML = '';

    showModal('badgeManagementModal');
}

async function submitBadgeChange(event) {
    event.preventDefault();

    const newBadge = document.getElementById('newBadgeId').value.trim();

    if (!/^\d{4}$/.test(newBadge)) {
        showAlert('Badge must be exactly 4 digits', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/badge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newIdBadge: newBadge,
                reason: "Badge updated via admin panel"
            })
        });

        if (response.ok) {
            showAlert(`Badge updated to ${newBadge} successfully!`, 'success');
            closeModal('badgeManagementModal');
            await loadAllStudents();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to update badge', 'error');
        }
    } catch (error) {
        showAlert('Failed to update badge', 'error');
    } finally {
        hideLoading();
    }
}

function showHoursModal(studentId, studentName, currentHours) {
    currentManagementStudent = { id: studentId, name: studentName, hours: currentHours };

    document.getElementById('hoursStudentInfo').innerHTML = `
        <div class="student-detail">
            <h4>${studentName}</h4>
            <p><strong>Current Required Hours:</strong> ${currentHours > 0 ? currentHours + 'h' : 'Not Set'}</p>
        </div>
    `;

    document.getElementById('newRequiredHours').value = currentHours > 0 ? currentHours : '';
    showModal('hoursManagementModal');
}

async function submitHoursChange(event) {
    event.preventDefault();

    const newHours = parseInt(document.getElementById('newRequiredHours').value);

    if (!newHours || newHours < 1 || newHours > 2000) {
        showAlert('Hours must be between 1 and 2000', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/required-hours`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requiredHours: newHours })
        });

        if (response.ok) {
            showAlert(`Required hours set to ${newHours}h successfully!`, 'success');
            closeModal('hoursManagementModal');
            await loadAllStudents();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to update required hours', 'error');
        }
    } catch (error) {
        showAlert('Failed to update required hours', 'error');
    } finally {
        hideLoading();
    }
}

async function showStatusModal(studentId, studentName, currentStatus) {
    currentManagementStudent = { id: studentId, name: studentName, status: currentStatus };

    // Check if student has active session
    try {
        const activeCheck = await fetch(`${API_BASE_URL}/admin/attendance/active-sessions`);
        if (activeCheck.ok) {
            const activeSessions = await activeCheck.json();
            const hasActiveSession = activeSessions.some(s => s.studentId === studentId);

            if (hasActiveSession) {
                document.getElementById('statusStudentInfo').innerHTML = `
                    <div class="student-detail">
                        <h4>${studentName}</h4>
                        <p><strong>Current Status:</strong> <span class="status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span></p>
                    </div>
                    <div class="alert alert-warning">
                        <strong>⚠️ Warning:</strong> This student has an active time-in session. Please complete their time-out before changing status to COMPLETED.
                    </div>
                `;
            } else {
                document.getElementById('statusStudentInfo').innerHTML = `
                    <div class="student-detail">
                        <h4>${studentName}</h4>
                        <p><strong>Current Status:</strong> <span class="status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span></p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Failed to check active sessions:', error);
    }

    document.getElementById('newStudentStatus').value = currentStatus;
    showModal('statusManagementModal');
}

async function submitStatusChange(event) {
    event.preventDefault();

    const newStatus = document.getElementById('newStudentStatus').value;

    if (!newStatus) {
        showAlert('Please select a status', 'error');
        return;
    }

    // Disable submit button to prevent double submission
    const submitBtn = document.querySelector('#statusManagementForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; margin: 0 auto;"></div> Processing...';

    showLoading();

    try {
        let response;

        if (newStatus === 'COMPLETED') {
            console.log('🎓 Attempting to complete student ID:', currentManagementStudent.id);

            // Use the complete endpoint
            response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            console.log('📝 Attempting to change status to:', newStatus);

            // Use the regular status endpoint
            response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
        }

        console.log('Response status:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Status update successful:', result);

            hideLoading();
            closeModal('statusManagementModal');

            showAlert(`Student status changed to ${newStatus} successfully!`, 'success');

            // Reload student data
            await loadAllStudents();
            await loadDashboard();

        } else {
            // Get error details from response
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData?.message || errorData?.error || `Server returned ${response.status}`;

            console.error('❌ Status update failed:', {
                status: response.status,
                statusText: response.statusText,
                errorData: errorData
            });

            hideLoading();

            // More detailed error message
            if (response.status === 400) {
                showAlert(`Cannot complete student: ${errorMessage}`, 'error');
            } else if (response.status === 404) {
                showAlert('Student not found. Please refresh and try again.', 'error');
            } else if (response.status === 500) {
                showAlert('Server error. Please check if the student has any pending attendance records.', 'error');
            } else {
                showAlert(`Failed to update student status: ${errorMessage}`, 'error');
            }

            // Re-enable button on error
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        hideLoading();
        console.error('❌ Network/Connection error:', error);
        showAlert('Failed to update student status: ' + error.message, 'error');

        // Re-enable button on error
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function showScheduleModal(studentId, studentName) {
    currentManagementStudent = { id: studentId, name: studentName };

    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${studentId}/schedule`);
        if (response.ok) {
            const schedule = await response.json();

            document.getElementById('scheduleStudentInfo').innerHTML = `
                <div class="student-detail">
                    <h4>${studentName}</h4>
                    <p><strong>Current Schedule:</strong> ${schedule.scheduleDisplayText || 'No schedule set'}</p>
                </div>
            `;

            document.getElementById('scheduleStartTime').value = schedule.startTime || '10:00';
            document.getElementById('scheduleEndTime').value = schedule.endTime || '19:00';
            document.getElementById('gracePeriodMinutes').value = schedule.gracePeriodMinutes || 5;
            document.getElementById('scheduleActive').value = schedule.active ? 'true' : 'false';
        } else {
            document.getElementById('scheduleStudentInfo').innerHTML = `
                <div class="student-detail">
                    <h4>${studentName}</h4>
                    <p><strong>Current Schedule:</strong> No schedule set</p>
                </div>
            `;

            document.getElementById('scheduleStartTime').value = '10:00';
            document.getElementById('scheduleEndTime').value = '19:00';
            document.getElementById('gracePeriodMinutes').value = 5;
            document.getElementById('scheduleActive').value = 'true';
        }
    } catch (error) {
        console.error('Failed to load schedule:', error);
    }

    showModal('scheduleManagementModal');
}

async function submitScheduleChange(event) {
    event.preventDefault();

    const startTime = document.getElementById('scheduleStartTime').value;
    const endTime = document.getElementById('scheduleEndTime').value;
    const gracePeriod = parseInt(document.getElementById('gracePeriodMinutes').value);
    const active = document.getElementById('scheduleActive').value === 'true';

    if (!startTime || !endTime) {
        showAlert('Please set both start and end times', 'error');
        return;
    }

    if (startTime >= endTime) {
        showAlert('Start time must be before end time', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/schedule`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startTime,
                endTime,
                gracePeriodMinutes: gracePeriod,
                active
            })
        });

        if (response.ok) {
            showAlert('Schedule updated successfully!', 'success');
            closeModal('scheduleManagementModal');
            await loadAllStudents();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to update schedule', 'error');
        }
    } catch (error) {
        showAlert('Failed to update schedule', 'error');
    } finally {
        hideLoading();
    }
}

// ==================== STUDENT DELETION ====================
function showDeleteStudentModal(studentId, studentName, idBadge, status) {
    currentManagementStudent = { id: studentId, name: studentName, badge: idBadge, status };

    const modalContent = document.getElementById('deleteStudentInfo');
    modalContent.innerHTML = `
        <div class="alert alert-error">
            <strong>⚠️ Choose Delete Method</strong>
            <p>Select how you want to remove this student:</p>
        </div>

        <div class="student-detail">
            <h4>Student Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value"><strong>${studentName}</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">ID Badge</div>
                    <div class="detail-value"><span class="badge-number">${idBadge || 'N/A'}</span></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Current Status</div>
                    <div class="detail-value">
                        <span class="status-badge status-${status.toLowerCase()}">${status}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="delete-options">
            <div class="delete-option-card" onclick="selectDeleteOption('soft')">
                <input type="radio" name="deleteOption" value="soft" id="softDelete" checked>
                <label for="softDelete">
                    <div class="option-header">
                        <span class="option-icon">🔒</span>
                        <strong>Deactivate (Recommended)</strong>
                    </div>
                    <div class="option-description">
                        • Marks student as INACTIVE<br>
                        • Preserves all historical data<br>
                        • Releases badge for reuse<br>
                        • Can be reactivated later
                    </div>
                </label>
            </div>

            <div class="delete-option-card danger" onclick="selectDeleteOption('hard')">
                <input type="radio" name="deleteOption" value="hard" id="hardDelete">
                <label for="hardDelete">
                    <div class="option-header">
                        <span class="option-icon">🗑️</span>
                        <strong>Permanent Delete</strong>
                    </div>
                    <div class="option-description">
                        • <strong>PERMANENTLY</strong> removes student<br>
                        • Deletes ALL attendance records<br>
                        • Deletes ALL task entries<br>
                        • <strong style="color: var(--error-color);">CANNOT BE UNDONE!</strong>
                    </div>
                </label>
            </div>
        </div>

        <div id="deleteReasonSection">
            <div class="form-group">
                <label for="deleteReason">Reason for Deactivation:</label>
                <textarea id="deleteReason" placeholder="Enter reason for deactivating this student..." rows="3" required></textarea>
                <small>This will be recorded for audit purposes</small>
            </div>
        </div>

        <div id="permanentDeleteWarning" style="display: none;">
            <div class="alert alert-error">
                <strong>⚠️ PERMANENT DELETION WARNING</strong>
                <p>This action will permanently delete all data for ${studentName}.<br><strong>THIS CANNOT BE UNDONE!</strong></p>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="confirmPermanentDelete" style="width: auto; margin-right: 0.5rem;">
                    I understand this action is permanent and cannot be undone
                </label>
            </div>
        </div>
    `;

    showModal('deleteStudentModal');
}

function selectDeleteOption(option) {
    const softRadio = document.getElementById('softDelete');
    const hardRadio = document.getElementById('hardDelete');
    const reasonSection = document.getElementById('deleteReasonSection');
    const warningSection = document.getElementById('permanentDeleteWarning');
    const submitBtn = document.getElementById('deleteSubmitBtn');

    if (option === 'soft') {
        softRadio.checked = true;
        reasonSection.style.display = 'block';
        warningSection.style.display = 'none';
        submitBtn.textContent = 'Deactivate Student';
        submitBtn.className = 'btn btn-warning';
    } else {
        hardRadio.checked = true;
        reasonSection.style.display = 'none';
        warningSection.style.display = 'block';
        submitBtn.textContent = 'Permanently Delete Student';
        submitBtn.className = 'btn btn-error';
    }
}

async function submitDeleteStudent(event) {
    event.preventDefault();

    const deleteOption = document.querySelector('input[name="deleteOption"]:checked').value;

    if (deleteOption === 'hard') {
        await performHardDelete();
    } else {
        await performSoftDelete();
    }
}

// ==================== SOFT DELETE (DEACTIVATE) ====================
async function performSoftDelete() {
    const reason = document.getElementById('deleteReason').value.trim();

    if (!reason) {
        showAlert('Please provide a reason for deactivation', 'error');
        return;
    }

    // Close the delete modal
    closeModal('deleteStudentModal');

    // Show confirmation modal
    showSoftDeleteConfirmation(reason);
}

function showSoftDeleteConfirmation(reason) {
    const modal = document.getElementById('deleteConfirmationModal');
    const content = document.getElementById('deleteConfirmationContent');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    content.innerHTML = `
        <div class="confirm-entry-card soft-delete">
            <div class="confirm-header">
                <div class="confirm-icon warning">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3>Confirm Deactivation</h3>
                <p>This student will be safely deactivated without data loss</p>
            </div>

            <div class="confirm-details">
                <div class="detail-row">
                    <span class="detail-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Student
                    </span>
                    <span class="detail-value">${currentManagementStudent.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Badge ID
                    </span>
                    <span class="detail-value"><span class="badge-number">${currentManagementStudent.badge}</span></span>
                </div>
                <div class="detail-row vertical">
                    <span class="detail-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Reason
                    </span>
                    <span class="detail-value reason">${reason}</span>
                </div>
            </div>

            <div class="confirm-warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div class="confirm-warning-content">
                    <strong>This will:</strong>
                    <ul>
                        <li>Set student status to <strong>INACTIVE</strong></li>
                        <li>Release badge <strong>${currentManagementStudent.badge}</strong> for reuse</li>
                        <li>Preserve all historical data and records</li>
                        <li>Allow reactivation in the future if needed</li>
                    </ul>
                </div>
            </div>
        </div>
    `;

    // Update button
    confirmBtn.textContent = 'Yes, Deactivate Student';
    confirmBtn.className = 'btn btn-warning';

    // Store data
    modal.dataset.reason = reason;
    modal.dataset.deleteType = 'soft';

    showModal('deleteConfirmationModal');
}

async function executeSoftDelete() {
    const modal = document.getElementById('deleteConfirmationModal');
    const reason = modal.dataset.reason;

    closeModal('deleteConfirmationModal');
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/deactivate`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason: reason,
                removeIdBadge: true
            })
        });

        if (response.ok) {
            showAlert(`Student ${currentManagementStudent.name} has been deactivated successfully!`, 'success');
            await loadAllStudents();
            await loadDashboard();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to deactivate student', 'error');
        }
    } catch (error) {
        showAlert('Failed to deactivate student. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// ==================== HARD DELETE (PERMANENT) ====================
async function performHardDelete() {
    const confirmCheckbox = document.getElementById('confirmPermanentDelete');

    if (!confirmCheckbox.checked) {
        showAlert('Please confirm that you understand this action is permanent', 'error');
        return;
    }

    // Close the delete modal
    closeModal('deleteStudentModal');

    // Show badge verification modal
    showHardDeleteConfirmation();
}

function showHardDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmationModal');
    const content = document.getElementById('deleteConfirmationContent');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    content.innerHTML = `
        <div class="confirm-entry-card hard-delete">
            <div class="confirm-header critical">
                <div class="confirm-icon danger">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3>⚠️ PERMANENT DELETION</h3>
                <p>This action cannot be undone or recovered</p>
            </div>

            <div class="confirm-details">
                <div class="detail-row">
                    <span class="detail-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        Student
                    </span>
                    <span class="detail-value">${currentManagementStudent.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        Badge ID
                    </span>
                    <span class="detail-value"><span class="badge-number">${currentManagementStudent.badge}</span></span>
                </div>
            </div>

            <div class="confirm-warning critical">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div class="confirm-warning-content">
                    <strong>🚨 CRITICAL WARNING</strong>
                    <p>This will permanently delete:</p>
                    <ul>
                        <li><strong>Student profile</strong> and all information</li>
                        <li><strong>ALL attendance records</strong> (complete history)</li>
                        <li><strong>ALL task entries</strong> and logs</li>
                        <li><strong>Complete audit trail</strong></li>
                    </ul>
                    <p style="margin-top: 0.75rem;">
                        <strong style="color: var(--error-color);">THIS CANNOT BE RECOVERED!</strong>
                    </p>
                </div>
            </div>

            <div class="badge-verification-section">
                <div class="form-group">
                    <label for="confirmBadgeInput">
                        Type badge number <span class="badge-highlight">${currentManagementStudent.badge}</span> to confirm deletion:
                    </label>
                    <input
                        type="text"
                        id="confirmBadgeInput"
                        placeholder="Enter badge number"
                        maxlength="4"
                        autocomplete="off"
                        oninput="this.value = this.value.replace(/\\D/g, '').slice(0, 4)"
                    >
                </div>
            </div>
        </div>
    `;

    // Update button
    confirmBtn.textContent = 'Yes, Permanently Delete';
    confirmBtn.className = 'btn btn-error';

    // Store data
    modal.dataset.deleteType = 'hard';

    showModal('deleteConfirmationModal');

    // Focus on input after modal animation
    setTimeout(() => {
        const input = document.getElementById('confirmBadgeInput');
        if (input) input.focus();
    }, 300);
}

async function executeHardDelete() {
    const typedBadge = document.getElementById('confirmBadgeInput').value.trim();

    if (typedBadge !== currentManagementStudent.badge) {
        showAlert('Badge number does not match. Deletion cancelled.', 'error');
        return;
    }

    closeModal('deleteConfirmationModal');
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert(`Student ${currentManagementStudent.name} has been permanently deleted`, 'info');
            await loadAllStudents();
            await loadDashboard();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to delete student', 'error');
        }
    } catch (error) {
        showAlert('Failed to delete student. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function executeDeleteAction() {
    const modal = document.getElementById('deleteConfirmationModal');
    const deleteType = modal.dataset.deleteType;

    if (deleteType === 'hard') {
        executeHardDelete();
    } else {
        executeSoftDelete();
    }
}

// ==================== STUDENT PROGRESS VIEW ====================
async function viewStudentProgress(idBadge) {
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/students/dashboard-with-progress/${idBadge}`);
        if (response.ok) {
            const studentData = await response.json();
            displayStudentProgressModal(studentData);
        } else {
            showAlert('Failed to load student progress', 'error');
        }
    } catch (error) {
        console.error('Failed to load student progress:', error);
        showAlert('Failed to load student progress', 'error');
    } finally {
        hideLoading();
    }
}

function displayStudentProgressModal(student) {
    const content = document.getElementById('studentProgressContent');
    const totalHours = parseFloat(student.totalAccumulatedHours || 0);
    const requiredHours = student.requiredHours ? parseFloat(student.requiredHours) : null;
    const hasRequiredHours = requiredHours !== null && requiredHours > 0;

    let progressSection = '';
    if (hasRequiredHours) {
        const progressPercentage = Math.min((totalHours / requiredHours) * 100, 100);
        const remainingHours = Math.max(requiredHours - totalHours, 0);
        const progressClass = Math.floor(progressPercentage / 10);

        progressSection = `
            <div class="student-detail">
                <h4>Progress Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Progress</div>
                        <div class="detail-value">
                            <div class="progress-container">
                                <div class="progress-bar">
                                    <div class="progress-fill progress-fill-${progressClass}" style="width: ${progressPercentage.toFixed(1)}%;"></div>
                                </div>
                                <div class="progress-text">${progressPercentage.toFixed(1)}%</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Hours Remaining</div>
                        <div class="detail-value">${formatHoursMinutes(remainingHours)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Required Hours</div>
                        <div class="detail-value">${formatHoursMinutes(requiredHours)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Completion Status</div>
                        <div class="detail-value">
                            ${progressPercentage >= 100 ?
                                '<span class="status-badge status-completed">Ready to Complete</span>' :
                                '<span class="status-badge status-active">In Progress</span>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="student-detail">
            <h4>Student Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">ID Badge</div>
                    <div class="detail-value">${student.idBadge || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${student.fullName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Current Status</div>
                    <div class="detail-value">
                        <span class="status-badge status-${student.currentStatus?.toLowerCase().replace('_', '-')}">${student.currentStatus?.replace('_', ' ') || 'Unknown'}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Today's Hours</div>
                    <div class="detail-value">${formatHoursMinutes(student.todayHours || 0)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total Hours</div>
                    <div class="detail-value"><strong>${formatHoursMinutes(totalHours)}</strong></div>
                </div>
            </div>
        </div>

        ${progressSection}

        <div class="student-detail">
            <h4>Attendance History</h4>
            <div class="table-container" style="max-height: 400px;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time In</th>
                            <th>Time Out</th>
                            <th>Hours</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${student.attendanceHistory && student.attendanceHistory.length > 0 ?
                            student.attendanceHistory.slice(0, 15).map(record => `
                                <tr>
                                    <td>${formatDate(record.attendanceDate)}</td>
                                    <td>${record.timeIn ? formatTime(record.timeIn) : '-'}</td>
                                    <td>${record.timeOut ? formatTime(record.timeOut) : '-'}</td>
                                    <td><strong>${formatHoursMinutes(record.totalHours || 0)}</strong></td>
                                    <td><span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">${record.status?.replace('_', ' ') || 'Unknown'}</span></td>
                                </tr>
                            `).join('') :
                            '<tr><td colspan="5" class="text-center">No attendance history found</td></tr>'
                        }
                    </tbody>
                </table>
            </div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal('studentProgressModal')">Close</button>
        </div>
    `;

    showModal('studentProgressModal');
}

// ==================== ATTENDANCE RECORDS ====================
function toggleDateRangeDropdown() {
    const dropdown = document.getElementById('dateRangeDropdown');
    const display = document.querySelector('.date-range-display');

    if (!dropdown) return;

    const isOpen = dropdown.classList.contains('show');

    if (isOpen) {
        closeDateRangeDropdown();
    } else {
        openDateRangeDropdown();
    }
}

function openDateRangeDropdown() {
    const dropdown = document.getElementById('dateRangeDropdown');
    const display = document.querySelector('.date-range-display');

    if (!dropdown) return;

    // Close any other open dropdowns first
    closeAllMenus();

    // Add active state to display
    if (display) display.classList.add('active');

    // Show dropdown
    dropdown.classList.add('show');

    // Add backdrop click handler
    setTimeout(() => {
        document.addEventListener('click', handleDateDropdownClickOutside);
    }, 100);
}

function closeDateRangeDropdown() {
    const dropdown = document.getElementById('dateRangeDropdown');
    const display = document.querySelector('.date-range-display');

    if (!dropdown) return;

    // Remove active state
    if (display) display.classList.remove('active');

    // Hide dropdown
    dropdown.classList.remove('show');

    // Remove backdrop click handler
    document.removeEventListener('click', handleDateDropdownClickOutside);
}

function handleDateDropdownClickOutside(event) {
    const dropdown = document.getElementById('dateRangeDropdown');
    const display = document.querySelector('.date-range-display');

    if (!dropdown || !display) return;

    // Check if click is outside dropdown and display
    if (!dropdown.contains(event.target) && !display.contains(event.target)) {
        closeDateRangeDropdown();
    }
}

async function filterTodayNew() {
    const today = formatDate(new Date());
    await loadAttendanceRecordsNew(today, today);
    document.getElementById('selectedDateRange').textContent = 'Today';
    toggleDateRangeDropdown();
}

async function filterYesterdayNew() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = formatDate(yesterday);
    await loadAttendanceRecordsNew(date, date);
    document.getElementById('selectedDateRange').textContent = 'Yesterday';
    toggleDateRangeDropdown();
}

async function filterThisWeekNew() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    await loadAttendanceRecordsNew(formatDate(startOfWeek), formatDate(today));
    document.getElementById('selectedDateRange').textContent = 'This Week';
    toggleDateRangeDropdown();
}

async function filterThisMonthNew() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    await loadAttendanceRecordsNew(formatDate(startOfMonth), formatDate(today));
    document.getElementById('selectedDateRange').textContent = 'This Month';
    toggleDateRangeDropdown();
}

async function filterLast7DaysNew() {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    await loadAttendanceRecordsNew(formatDate(sevenDaysAgo), formatDate(today));
    document.getElementById('selectedDateRange').textContent = 'Last 7 Days';
    toggleDateRangeDropdown();
}

async function filterLast30DaysNew() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 29);
    await loadAttendanceRecordsNew(formatDate(thirtyDaysAgo), formatDate(today));
    document.getElementById('selectedDateRange').textContent = 'Last 30 Days';
    toggleDateRangeDropdown();
}

async function applyCustomDateRange() {
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;

    if (!startDate || !endDate) {
        showAlert('Please select both start and end dates', 'error');
        return;
    }

    if (startDate > endDate) {
        showAlert('Start date must be before end date', 'error');
        return;
    }

    await loadAttendanceRecordsNew(startDate, endDate);
    document.getElementById('selectedDateRange').textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
    toggleDateRangeDropdown();
}

async function loadAttendanceRecordsNew(startDate, endDate) {
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/records?startDate=${startDate}&endDate=${endDate}`);

        if (!response.ok) throw new Error('Failed to load records');

        const records = await response.json();
        filteredAttendanceRecordsNew = records;
        currentAttendanceDateRange = `${formatDate(startDate)} to ${formatDate(endDate)}`;

        displayAttendanceRecordsNew(records);
        document.getElementById('downloadBtnNew').style.display = records.length > 0 ? 'inline-flex' : 'none';

        showAlert(`Loaded ${records.length} records`, 'success');

    } catch (error) {
        console.error('Failed to load attendance records:', error);
        showAlert('Failed to load attendance records', 'error');
    } finally {
        hideLoading();
    }
}

function displayAttendanceRecordsNew(records) {
    const tbody = document.getElementById('attendanceBodyNew');

    // Update sidebar stats
    updateAttendanceSidebarStats(records);

    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state-modern">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>No records found</h3>
                    <p>Try adjusting your date range or filters</p>
                </td>
            </tr>
        `;
        return;
    }

    const studentSchoolMap = {};
    allStudents.forEach(student => {
        studentSchoolMap[student.idBadge] = student.school || 'N/A';
    });

    tbody.innerHTML = records.map(record => `
        <tr class="attendance-record-row"
            data-student-name="${(record.studentName || '').toLowerCase()}"
            data-id-badge="${record.idBadge}"
            data-school="${(studentSchoolMap[record.idBadge] || '').toLowerCase()}"
            data-status="${record.status || ''}">
            <td>${formatDate(record.attendanceDate)}</td>
            <td><strong>${record.studentName || 'Unknown'}</strong></td>
            <td><span class="badge-number">${record.idBadge}</span></td>
            <td class="school-cell" title="${studentSchoolMap[record.idBadge]}">${studentSchoolMap[record.idBadge]}</td>
            <td>${record.timeIn ? formatTime(record.timeIn) : '-'}</td>
            <td>${record.timeOut ? formatTime(record.timeOut) : '-'}</td>
            <td><strong>${formatHoursMinutes(record.totalHours || 0)}</strong></td>
            <td>
                <span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">
                    ${record.status?.replace('_', ' ') || 'Unknown'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewAttendanceRecord(${record.id})">View</button>
            </td>
        </tr>
    `).join('');
}

function applyAttendanceFiltersNew() {
    const searchTerm = document.getElementById('attendanceSearchNew').value.toLowerCase();
    const statusFilter = document.getElementById('attendanceStatusFilterNew').value;
    const rows = document.querySelectorAll('.attendance-record-row');

    let visibleCount = 0;

    rows.forEach(row => {
        const studentName = row.getAttribute('data-student-name');
        const idBadge = row.getAttribute('data-id-badge');
        const school = row.getAttribute('data-school');
        const status = row.getAttribute('data-status');

        const matchesSearch = !searchTerm ||
            studentName.includes(searchTerm) ||
            idBadge.includes(searchTerm) ||
            school.includes(searchTerm);

        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        if (matchesSearch && matchesStatus) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
}

function clearAllAttendanceFiltersNew() {
    document.getElementById('customStartDate').value = '';
    document.getElementById('customEndDate').value = '';
    document.getElementById('attendanceSearchNew').value = '';
    document.getElementById('attendanceStatusFilterNew').value = 'all';
    document.getElementById('selectedDateRange').textContent = 'Select date range...';

    const tbody = document.getElementById('attendanceBodyNew');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="empty-state-modern">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <h3>📅 Select a date range</h3>
                <p>Choose a date range above to view attendance records</p>
            </td>
        </tr>
    `;

    document.getElementById('attendanceSummaryNew').style.display = 'none';
    document.getElementById('downloadBtnNew').style.display = 'none';

    filteredAttendanceRecordsNew = [];
    currentAttendanceDateRange = '';

    showAlert('All filters cleared', 'info');
}

function downloadFilteredRecordsNew() {
    if (!filteredAttendanceRecordsNew || filteredAttendanceRecordsNew.length === 0) {
        showAlert('No records to download', 'warning');
        return;
    }

    const visibleRows = document.querySelectorAll('.attendance-record-row:not([style*="display: none"])');
    const visibleRecords = filteredAttendanceRecordsNew.filter((record, index) => {
        return index < visibleRows.length && visibleRows[index].style.display !== 'none';
    });

    if (visibleRecords.length === 0) {
        showAlert('No visible records to download', 'warning');
        return;
    }

    const headers = ['Date', 'Student Name', 'ID Badge', 'School', 'Time In', 'Time Out', 'Total Hours', 'Status'];
    const csvRows = [headers.join(',')];

    const studentSchoolMap = {};
    allStudents.forEach(student => {
        studentSchoolMap[student.idBadge] = student.school || 'N/A';
    });

    visibleRecords.forEach(record => {
        const row = [
            formatDate(record.attendanceDate),
            `"${record.studentName || 'Unknown'}"`,
            record.idBadge,
            `"${studentSchoolMap[record.idBadge] || 'N/A'}"`,
            record.timeIn ? formatTime(record.timeIn) : '-',
            record.timeOut ? formatTime(record.timeOut) : '-',
            record.totalHours || '0',
            record.status?.replace('_', ' ') || 'Unknown'
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `attendance-records-${dateStr}.csv`;

    downloadFile(blob, filename);
    showAlert(`Downloaded ${visibleRecords.length} records`, 'success');
}

async function viewAttendanceRecord(recordId) {
    const record = filteredAttendanceRecordsNew.find(r => r.id === recordId);
    if (!record) {
        showAlert('Record not found', 'error');
        return;
    }

    const content = document.getElementById('attendanceViewContent');
    content.innerHTML = `
        <div class="student-detail">
            <h4>Attendance Record Details</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Student Name</div>
                    <div class="detail-value"><strong>${record.studentName || 'Unknown'}</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">ID Badge</div>
                    <div class="detail-value"><span class="badge-number">${record.idBadge}</span></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Date</div>
                    <div class="detail-value">${formatDate(record.attendanceDate)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">
                        <span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">${record.status?.replace('_', ' ') || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="student-detail">
            <h4>Time Details</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Time In</div>
                    <div class="detail-value">${record.timeIn ? formatDateTime(record.timeIn) : '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Time Out</div>
                    <div class="detail-value">${record.timeOut ? formatDateTime(record.timeOut) : '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total Hours</div>
                    <div class="detail-value"><strong>${formatHoursMinutes(record.totalHours || 0)}</strong></div>
                </div>
            </div>
        </div>

        <div class="modal-actions">
            ${(record.status === 'AUTO_TIMED_OUT' || record.status === 'INCOMPLETE') ?
                `<button class="btn btn-warning" onclick="correctTime(${record.id})">Correct Time</button>` : ''
            }
            <button class="btn btn-secondary" onclick="closeModal('attendanceViewModal')">Close</button>
        </div>
    `;

    showModal('attendanceViewModal');
}

function searchAttendanceRecords() {
    const searchTerm = document.getElementById('attendanceSearchNew').value.toLowerCase();
    const statusFilter = document.getElementById('attendanceStatusFilterNew').value;
    const rows = document.querySelectorAll('.attendance-record-row');

    let visibleCount = 0;

    rows.forEach(row => {
        const studentName = row.getAttribute('data-student-name');
        const idBadge = row.getAttribute('data-id-badge');
        const school = row.getAttribute('data-school');
        const status = row.getAttribute('data-status');

        const matchesSearch = !searchTerm ||
            studentName.includes(searchTerm) ||
            idBadge.includes(searchTerm) ||
            school.includes(searchTerm);

        const matchesStatus = statusFilter === 'all' || status === statusFilter;

        if (matchesSearch && matchesStatus) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    // Update summary count if visible
    const summaryTotal = document.getElementById('summaryTotalRecordsNew');
    if (summaryTotal) {
        const totalRecords = document.querySelectorAll('.attendance-record-row').length;
        if (visibleCount !== totalRecords) {
            summaryTotal.textContent = `${visibleCount} of ${totalRecords}`;
        } else {
            summaryTotal.textContent = totalRecords;
        }
    }
}

function applyAttendanceTableFilters() {
    searchAttendanceRecords();
}

// ==================== TIME CORRECTIONS ====================
async function loadIncompleteRecords() {
    showLoading();
    try {
        // Load ALL records that need correction (incomplete AND 12+ hours)
        const response = await fetch(`${API_BASE_URL}/admin/attendance/incomplete`);

        if (response.ok) {
            const records = await response.json();
            displayIncompleteRecords(records);
        } else {
            showAlert('Failed to load records requiring correction', 'error');
            document.getElementById('correctionsList').innerHTML = `
                <div class="empty-state-modern">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Failed to load records</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load incomplete records:', error);
        showAlert('Failed to load records requiring correction', 'error');
    } finally {
        hideLoading();
    }
}

function displayIncompleteRecords(records) {
    const container = document.getElementById('correctionsList');

    // Update sidebar stats
    updateCorrectionsSidebarStats(records);

    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state-modern">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <h3>✅ All Clear!</h3>
                <p>No records requiring correction at this time</p>
            </div>
        `;
        return;
    }

    // Separate records by priority
    const criticalRecords = [];
    const autoTimedOut = [];
    const incomplete = [];
    const longSession = [];

    records.forEach(r => {
        const hours = parseFloat(calculateElapsedHours(r.timeIn));

        if (r.status === 'TIMED_IN' && hours >= 12) {
            criticalRecords.push(r);
        } else if (r.status === 'AUTO_TIMED_OUT') {
            autoTimedOut.push(r);
        } else if (r.status === 'INCOMPLETE') {
            incomplete.push(r);
        } else if (r.status === 'TIMED_IN' && hours >= 10) {
            // Show TIMED_IN records that are 10+ hours (but less than 12)
            longSession.push(r);
        }
    });

    let html = '';

    // CRITICAL: 12+ Hours Worked
    if (criticalRecords.length > 0) {
        html += `
            <div class="correction-section critical">
                <div class="correction-section-header">
                    <h4>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        🚨 CRITICAL: 12+ Hours Worked (${criticalRecords.length})
                    </h4>
                    <p>These students have been working for 12 hours or more and need immediate attention</p>
                </div>
                ${criticalRecords.map(record => createCorrectionCard(record, 'critical')).join('')}
            </div>
        `;
    }

    // WARNING: Long Session (10-12 hours)
    if (longSession.length > 0) {
        html += `
            <div class="correction-section warning">
                <div class="correction-section-header">
                    <h4>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        ⚠️ Long Session: 10+ Hours (${longSession.length})
                    </h4>
                    <p>Students approaching 12 hours - may need review soon</p>
                </div>
                ${longSession.map(record => createCorrectionCard(record, 'warning')).join('')}
            </div>
        `;
    }

    // Auto Timed Out
    if (autoTimedOut.length > 0) {
        html += `
            <div class="correction-section warning">
                <div class="correction-section-header">
                    <h4>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ⚠️ Auto Timed Out (${autoTimedOut.length})
                    </h4>
                    <p>Students who were automatically timed out by the system</p>
                </div>
                ${autoTimedOut.map(record => createCorrectionCard(record, 'warning')).join('')}
            </div>
        `;
    }

    // Incomplete
    if (incomplete.length > 0) {
        html += `
            <div class="correction-section info">
                <div class="correction-section-header">
                    <h4>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        ℹ️ Incomplete Records (${incomplete.length})
                    </h4>
                    <p>Records with missing or incomplete data</p>
                </div>
                ${incomplete.map(record => createCorrectionCard(record, 'info')).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

function createCorrectionCard(record, severity) {
    const now = new Date();
    const timeInDate = new Date(record.timeIn);
    const hoursWorked = (now - timeInDate) / (1000 * 60 * 60);
    const isOvertime = hoursWorked >= 12;

    // Determine the issue type and message
    let issueType = '';
    let issueIcon = '';
    let issueClass = '';

    if (isOvertime && record.status === 'TIMED_IN') {
        issueType = 'CRITICAL: Working 12+ Hours';
        issueIcon = '🚨';
        issueClass = 'critical';
    } else if (record.status === 'AUTO_TIMED_OUT') {
        issueType = 'Auto Timed Out';
        issueIcon = '⚠️';
        issueClass = 'warning';
    } else if (record.status === 'INCOMPLETE') {
        issueType = 'Incomplete Record';
        issueIcon = 'ℹ️';
        issueClass = 'info';
    }

    return `
        <div class="correction-card ${issueClass}">
            <div class="correction-card-header">
                <div class="correction-student-info">
                    <h4>
                        ${record.studentName}
                        <span class="badge-number">${record.idBadge}</span>
                    </h4>
                    <div class="correction-issue-badge ${issueClass}">
                        ${issueIcon} ${issueType}
                    </div>
                </div>
                <div class="correction-actions">
                    <button class="btn ${severity === 'critical' ? 'btn-error' : 'btn-warning'}" onclick="correctTime(${record.id})">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Correct Time
                    </button>
                    <button class="btn btn-success" onclick="markAsCorrect(${record.id})" title="Time is correct, no changes needed">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Mark as Correct
                    </button>
                </div>
            </div>

            <div class="correction-details">
                <div class="correction-detail-item">
                    <span class="detail-label">📅 Date:</span>
                    <span class="detail-value">${formatDate(record.attendanceDate)}</span>
                </div>
                <div class="correction-detail-item">
                    <span class="detail-label">⏰ Time In:</span>
                    <span class="detail-value">${formatTime(record.timeIn)}</span>
                </div>
                <div class="correction-detail-item">
                    <span class="detail-label">📊 Status:</span>
                    <span class="detail-value">
                        <span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">
                            ${record.status?.replace('_', ' ') || 'Unknown'}
                        </span>
                    </span>
                </div>
                <div class="correction-detail-item">
                    <span class="detail-label">⏱️ Hours Worked:</span>
                    <span class="detail-value ${isOvertime ? 'text-error' : ''}">
                        <strong>${formatHoursMinutes(hoursWorked)}</strong>
                        ${isOvertime ? ' <span class="overtime-warning">⚠️ OVERTIME</span>' : ' (estimated)'}
                    </span>
                </div>
            </div>

            ${isOvertime ? `
                <div class="alert alert-error" style="margin-top: 1rem;">
                    <strong>⚠️ URGENT:</strong> This student has been working for over 12 hours!
                    Please review immediately and either correct the time or mark as accurate if they actually worked these hours.
                </div>
            ` : `
                <div class="correction-hint">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                    </svg>
                    <span>Click "Correct Time" to adjust hours, or "Mark as Correct" if the time is accurate</span>
                </div>
            `}
        </div>
    `;
}

async function correctTime(recordId) {
    try {
        let record = filteredAttendanceRecordsNew.find(r => r.id === recordId);

        if (!record) {
            const response = await fetch(`${API_BASE_URL}/attendance/records?startDate=2024-01-01&endDate=${formatDate(new Date())}`);
            if (response.ok) {
                const records = await response.json();
                record = records.find(r => r.id === recordId);
            }
        }

        if (record) {
            currentCorrectionRecord = record;

            document.getElementById('correctionDetails').innerHTML = `
                <div class="alert alert-info">
                    <div><strong>Student:</strong> ${record.studentName} (<span class="badge-number">${record.idBadge}</span>)</div>
                    <div><strong>Date:</strong> ${formatDate(record.attendanceDate)}</div>
                    <div><strong>Time In:</strong> ${formatTime(record.timeIn)}</div>
                    <div><strong>Status:</strong> ${record.status}</div>
                    <div><strong>Current Hours:</strong> ${formatHoursMinutes(parseFloat(calculateElapsedHours(record.timeIn)))}</div>
                </div>
            `;
            showModal('timeCorrectionModal');
        } else {
            showAlert('Record not found', 'error');
        }
    } catch (error) {
        console.error('Failed to load record for correction:', error);
        showAlert('Failed to load record details', 'error');
    }
}

async function submitTimeCorrection(event) {
    if (event) event.preventDefault();

    if (!currentCorrectionRecord) {
        showAlert('No record selected for correction', 'error');
        return;
    }

    const correctedHours = parseFloat(document.getElementById('correctedHours').value);
    const correctionReason = document.getElementById('correctionReason').value.trim();

    if (!correctedHours || correctedHours < 0 || correctedHours > 16) {
        showAlert('Please enter valid hours (0-16)', 'warning');
        return;
    }

    if (!correctionReason) {
        showAlert('Please provide a correction reason', 'warning');
        return;
    }

    // Disable submit button
    const submitBtn = document.querySelector('#timeCorrectionForm button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; margin: 0 auto;"></div> Processing...';

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/correct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attendanceRecordId: currentCorrectionRecord.id,
                correctedHours,
                correctionReason
            })
        });

        hideLoading();

        if (response.ok) {
            // CLOSE MODAL IMMEDIATELY, THEN SHOW NOTIFICATION
            closeModal('timeCorrectionModal');
            document.getElementById('timeCorrectionForm').reset();
            currentCorrectionRecord = null;

            showAlert('Time correction applied successfully!', 'success');

            // Reload data in background
            await Promise.all([
                loadIncompleteRecords(),
                loadNotifications(),
                loadDashboard()
            ]);
        } else {
            const data = await response.json();
            showAlert(data.message || 'Correction failed', 'error');

            // Re-enable button on error
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        hideLoading();
        console.error('Correction error:', error);
        showAlert('Correction failed. Please try again.', 'error');

        // Re-enable button on error
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// ==================== MARK AS CORRECT (NO CORRECTION NEEDED) ====================

async function markAsCorrect(recordId) {
    const record = await getRecordById(recordId);
    if (!record) {
        showAlert('Record not found', 'error');
        return;
    }

    const confirmed = confirm(
        `Mark this record as correct?\n\n` +
        `Student: ${record.studentName}\n` +
        `Date: ${formatDate(record.attendanceDate)}\n` +
        `Time In: ${formatTime(record.timeIn)}\n` +
        `Hours: ${formatHoursMinutes(parseFloat(calculateElapsedHours(record.timeIn)))}\n\n` +
        `This will mark the record as reviewed and remove it from the corrections list.`
    );

    if (!confirmed) return;

    showLoading();

    try {
        // Calculate the actual hours worked
        const now = new Date();
        const timeIn = new Date(record.timeIn);
        const hoursWorked = (now - timeIn) / (1000 * 60 * 60);

        const response = await fetch(`${API_BASE_URL}/admin/attendance/correct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attendanceRecordId: record.id,
                correctedHours: parseFloat(hoursWorked.toFixed(2)),
                correctionReason: 'Reviewed by admin - No correction needed. Time is accurate.'
            })
        });

        if (response.ok) {
            showAlert('✅ Record marked as correct!', 'success');
            await Promise.all([
                loadIncompleteRecords(),
                loadNotifications(),
                loadDashboard()
            ]);
        } else {
            const data = await response.json();
            showAlert(data.message || 'Failed to mark record as correct', 'error');
        }
    } catch (error) {
        console.error('Mark as correct error:', error);
        showAlert('Failed to mark record as correct', 'error');
    } finally {
        hideLoading();
    }
}

// Helper function to get record by ID
async function getRecordById(recordId) {
    try {
        // First try to find in current corrections list
        const correctionsList = document.getElementById('correctionsList');
        if (correctionsList) {
            // If we have the record in memory from loadIncompleteRecords
            const response = await fetch(`${API_BASE_URL}/admin/attendance/incomplete`);
            if (response.ok) {
                const records = await response.json();
                return records.find(r => r.id === recordId);
            }
        }
        return null;
    } catch (error) {
        console.error('Failed to get record:', error);
        return null;
    }
}

// ==================== MANUAL ATTENDANCE ENTRY ====================

/**
 * Show manual attendance entry modal
 */
function showManualEntryModal() {
    // Reset form
    document.getElementById('manualEntryForm').reset();
    document.getElementById('manualIdBadge').value = '';
    document.getElementById('manualTimeIn').value = '';
    document.getElementById('manualTimeOut').value = '';
    document.getElementById('manualTasks').value = '';
    document.getElementById('manualReason').value = '';

    // Set default time-in to current time
    const now = new Date();
    const timeString = now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
    document.getElementById('manualTimeIn').value = timeString;

    // Clear validation
    document.getElementById('manualBadgeValidation').innerHTML = '';

    showModal('manualEntryModal');
}

/**
 * Validate badge for manual entry
 */
async function validateManualBadge(badgeId) {
    const validationDiv = document.getElementById('manualBadgeValidation');

    // Clear validation if badge is empty or not 4 digits
    if (!badgeId || badgeId.length !== 4) {
        if (validationDiv) validationDiv.innerHTML = '';
        return false;
    }

    validationDiv.innerHTML = '<div class="validation-message checking">Checking student...</div>';

    try {
        // Try multiple endpoints to find the student
        let student = null;

        // First try: Check by badge directly
        try {
            const badgeResponse = await fetch(`${API_BASE_URL}/students/badge/${badgeId}`);
            if (badgeResponse.ok) {
                student = await badgeResponse.json();
            }
        } catch (e) {
            console.log('Badge endpoint not available, trying alternative...');
        }

        // Second try: Search in all students list
        if (!student) {
            const allStudentsResponse = await fetch(`${API_BASE_URL}/students/all`);
            if (allStudentsResponse.ok) {
                const allStudents = await allStudentsResponse.json();
                student = allStudents.find(s => s.idBadge === badgeId);
            }
        }

        if (student) {
            validationDiv.innerHTML = `
                <div class="validation-message available">
                    ✓ Student Found: <strong>${student.fullName}</strong>
                    <br><small>School: ${student.school || 'N/A'}</small>
                    <br><small>Status: ${student.status || 'ACTIVE'}</small>
                </div>
            `;
            return true;
        } else {
            validationDiv.innerHTML = '<div class="validation-message unavailable">✗ Student not found with badge: ' + badgeId + '</div>';
            return false;
        }
    } catch (error) {
        console.error('Validation error:', error);
        validationDiv.innerHTML = '<div class="validation-message checking">Unable to verify student</div>';
        return false;
    }
}

/**
 * Toggle time-out and tasks fields
 */
function toggleCompleteEntry() {
    const isComplete = document.getElementById('entryTypeComplete').checked;
    const timeOutGroup = document.getElementById('manualTimeOutGroup');
    const tasksGroup = document.getElementById('manualTasksGroup');

    if (isComplete) {
        timeOutGroup.style.display = 'block';
        tasksGroup.style.display = 'block';
        document.getElementById('manualTimeOut').required = true;
    } else {
        timeOutGroup.style.display = 'none';
        tasksGroup.style.display = 'none';
        document.getElementById('manualTimeOut').required = false;
        document.getElementById('manualTimeOut').value = '';
        document.getElementById('manualTasks').value = '';
    }
}

/**
 * Submit manual attendance entry
 */
async function submitManualEntry(event) {
    event.preventDefault();

    const idBadge = document.getElementById('manualIdBadge').value.trim();
    const timeIn = document.getElementById('manualTimeIn').value;
    const timeOut = document.getElementById('manualTimeOut').value;
    const tasks = document.getElementById('manualTasks').value.trim();
    const reason = document.getElementById('manualReason').value.trim();
    const isComplete = document.getElementById('entryTypeComplete').checked;

    // Validation
    if (!/^\d{4}$/.test(idBadge)) {
        showAlert('ID badge must be exactly 4 digits', 'error');
        return;
    }

    if (!timeIn) {
        showAlert('Time-in is required', 'error');
        return;
    }

    if (isComplete && !timeOut) {
        showAlert('Time-out is required for complete entry', 'error');
        return;
    }

    if (!reason) {
        showAlert('Admin reason is required', 'error');
        return;
    }

    // Validate time-out is after time-in
    if (timeOut && new Date(timeOut) <= new Date(timeIn)) {
        showAlert('Time-out must be after time-in', 'error');
        return;
    }

    // Prepare request payload
    const payload = {
        idBadge: idBadge,
        timeIn: timeIn,
        adminReason: reason
    };

    // Add optional fields if complete entry
    if (isComplete && timeOut) {
        payload.timeOut = timeOut;
        if (tasks) {
            payload.tasksCompleted = tasks;
        }
    }

    // Show confirmation modal instead of alert
    showManualEntryConfirmation(payload, isComplete);
}

/**
 * Show professional confirmation modal
 */
async function showManualEntryConfirmation(payload, isComplete) {
    const modal = document.getElementById('manualEntryConfirmModal');
    const content = document.getElementById('manualEntryConfirmContent');

    // Get student info for display
    let studentName = 'Unknown';
    try {
        const response = await fetch(`${API_BASE_URL}/students/all`);
        if (response.ok) {
            const students = await response.json();
            const student = students.find(s => s.idBadge === payload.idBadge);
            if (student) studentName = student.fullName;
        }
    } catch (e) {
        console.error('Failed to get student name:', e);
    }

    // Calculate hours if complete entry
    let calculatedHours = 0;
    if (isComplete && payload.timeOut) {
        const timeInDate = new Date(payload.timeIn);
        const timeOutDate = new Date(payload.timeOut);
        calculatedHours = (timeOutDate - timeInDate) / (1000 * 60 * 60);
    }

    content.innerHTML = `
        <div class="confirm-entry-card ${isComplete ? 'complete' : 'partial'}">
            <div class="confirm-header">
                <div class="confirm-icon ${isComplete ? 'success' : 'info'}">
                    ${isComplete ?
                        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' :
                        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                    }
                </div>
                <h3>${isComplete ? 'Complete Attendance Entry' : 'Time-In Entry'}</h3>
                <p>${isComplete ? 'Create a finished attendance record' : 'Student will need to time-out later'}</p>
            </div>

            <div class="confirm-details">
                <div class="detail-row">
                    <span class="detail-label">👤 Student:</span>
                    <span class="detail-value"><strong>${studentName}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🔖 Badge ID:</span>
                    <span class="detail-value"><span class="badge-number">${payload.idBadge}</span></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">⏰ Time In:</span>
                    <span class="detail-value">${formatDateTime(payload.timeIn)}</span>
                </div>
                ${payload.timeOut ? `
                    <div class="detail-row">
                        <span class="detail-label">⏰ Time Out:</span>
                        <span class="detail-value">${formatDateTime(payload.timeOut)}</span>
                    </div>
                    <div class="detail-row highlight">
                        <span class="detail-label">⏱️ Total Hours:</span>
                        <span class="detail-value"><strong>${formatHoursMinutes(calculatedHours)}</strong></span>
                    </div>
                ` : ''}
                ${payload.tasksCompleted ? `
                    <div class="detail-row vertical">
                        <span class="detail-label">📝 Tasks:</span>
                        <span class="detail-value tasks">${payload.tasksCompleted}</span>
                    </div>
                ` : ''}
                <div class="detail-row vertical">
                    <span class="detail-label">📄 Reason:</span>
                    <span class="detail-value reason">${payload.adminReason}</span>
                </div>
            </div>

            <div class="confirm-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                    <strong>This action will be permanently logged</strong>
                    <p>Manual entries are recorded with your admin account for audit purposes</p>
                </div>
            </div>
        </div>
    `;

    // Store payload for submission
    modal.dataset.payload = JSON.stringify(payload);

    showModal('manualEntryConfirmModal');
}

/**
 * Execute the manual entry after confirmation
 */
async function executeManualEntry() {
    const modal = document.getElementById('manualEntryConfirmModal');
    const payload = JSON.parse(modal.dataset.payload);

    closeModal('manualEntryConfirmModal');
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/manual-entry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to create manual entry');
        }

        const result = await response.json();

        hideLoading();

        // Close the manual entry modal BEFORE showing result
        closeModal('manualEntryModal');

        // Show success modal
        showManualEntrySuccess(result);

        // Refresh relevant data
        await Promise.all([
            loadDashboard(),
            currentTab === 'attendance' ? loadAttendanceRecordsNew(
                document.getElementById('customStartDate').value || formatDate(new Date()),
                document.getElementById('customEndDate').value || formatDate(new Date())
            ) : Promise.resolve()
        ]);

    } catch (error) {
        hideLoading();
        console.error('Manual entry error:', error);
        showManualEntryError(error.message || 'Failed to create manual entry');
    }
}

/**
 * Show success modal
 */
function showManualEntrySuccess(result) {
    const modal = document.getElementById('manualEntryResultModal');
    const content = document.getElementById('manualEntryResultContent');

    content.innerHTML = `
        <div class="result-card success">
            <div class="result-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            </div>
            <h3>✅ Manual Entry Created Successfully!</h3>
            <p>The attendance record has been logged in the system</p>

            <div class="result-details">
                <div class="result-detail-item">
                    <span class="result-label">Student:</span>
                    <span class="result-value"><strong>${result.studentName || 'Unknown'}</strong></span>
                </div>
                <div class="result-detail-item">
                    <span class="result-label">Status:</span>
                    <span class="result-value">
                        <span class="status-badge status-${result.status?.toLowerCase().replace('_', '-')}">${result.status || 'RECORDED'}</span>
                    </span>
                </div>
                <div class="result-detail-item">
                    <span class="result-label">Hours Logged:</span>
                    <span class="result-value"><strong>${formatHoursMinutes(result.totalHours || 0)}</strong></span>
                </div>
                <div class="result-detail-item">
                    <span class="result-label">Date:</span>
                    <span class="result-value">${formatDate(result.attendanceDate || new Date())}</span>
                </div>
            </div>

            <div class="result-footer">
                <button class="btn btn-primary" onclick="closeModal('manualEntryResultModal')">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Done
                </button>
            </div>
        </div>
    `;

    showModal('manualEntryResultModal');
}

/**
 * Show error modal
 */
function showManualEntryError(errorMessage) {
    const modal = document.getElementById('manualEntryResultModal');
    const content = document.getElementById('manualEntryResultContent');

    content.innerHTML = `
        <div class="result-card error">
            <div class="result-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
            </div>
            <h3>❌ Failed to Create Entry</h3>
            <p>The manual attendance entry could not be created</p>

            <div class="result-error-message">
                <strong>Error Details:</strong>
                <p>${errorMessage}</p>
            </div>

            <div class="result-footer">
                <button class="btn btn-secondary" onclick="closeModal('manualEntryResultModal')">
                    Close
                </button>
                <button class="btn btn-primary" onclick="closeModal('manualEntryResultModal'); showManualEntryModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                    </svg>
                    Try Again
                </button>
            </div>
        </div>
    `;

    showModal('manualEntryResultModal');
}

/**
 * Set quick time presets
 */
function setQuickTime(type, preset) {
    const now = new Date();
    let targetTime;

    switch (preset) {
        case 'now':
            targetTime = now;
            break;
        case '6am':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0);
            break;
        case '8am':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
            break;
        case '10am':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
            break;
        case '12pm':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
            break;
        case '3pm':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
            break;
        case '5pm':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
            break;
        case '7pm':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
            break;
        case '9pm':
            targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0, 0);
            break;
        default:
            targetTime = now;
    }

    // Format to YYYY-MM-DDTHH:mm for datetime-local input
    const year = targetTime.getFullYear();
    const month = String(targetTime.getMonth() + 1).padStart(2, '0');
    const day = String(targetTime.getDate()).padStart(2, '0');
    const hours = String(targetTime.getHours()).padStart(2, '0');
    const minutes = String(targetTime.getMinutes()).padStart(2, '0');

    const timeString = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (type === 'in') {
        document.getElementById('manualTimeIn').value = timeString;
    } else if (type === 'out') {
        document.getElementById('manualTimeOut').value = timeString;
    }
}

// ==================== SCHEDULE MANAGEMENT ====================
async function loadScheduleOverview() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/schedules/summary`);
        if (response.ok) {
            const data = await response.json();
            displayScheduleOverview(data);
        } else {
            document.getElementById('scheduleOverviewContent').innerHTML =
                '<div class="empty-state"><h3>Failed to load schedule overview</h3></div>';
        }
    } catch (error) {
        console.error('Failed to load schedule overview:', error);
        showAlert('Failed to load schedule overview', 'error');
    }
}

function displayScheduleOverview(data) {
    const content = document.getElementById('scheduleOverviewContent');

    // Update sidebar stats
    updateScheduleSidebarStats(data);

    const complianceRate = data.studentsWithSchedule ?
        Math.round((data.studentsWithSchedule / data.totalStudents) * 100) : 0;

    content.innerHTML = `
        <div class="stats-row">
            <div class="stat-item">
                <div class="stat-label">Students with Schedules</div>
                <div class="stat-value text-success">${data.studentsWithSchedule || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Students w/out Schedules</div>
                <div class="stat-value text-warning">${data.studentsWithoutSchedule || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Active Schedules</div>
                <div class="stat-value text-info">${data.studentsWithSchedule || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Compliance Rate</div>
                <div class="stat-value text-primary">${complianceRate}%</div>
            </div>
        </div>
    `;
}

async function loadLateArrivals() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/late-arrivals`);
        const arrivals = response.ok ? await response.json() : [];
        displayLateArrivals(arrivals);
    } catch (error) {
        showAlert('Failed to load late arrivals', 'error');
    }
}

function displayLateArrivals(arrivals) {
    const tbody = document.getElementById('lateArrivalsBody');

    // Update sidebar
    updateLateArrivalsSidebar(arrivals);

    if (arrivals.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state-modern">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <h3>✅ No late arrivals today</h3>
                    <p>All students arrived on time!</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = arrivals.map(arrival => `
        <tr>
            <td><strong>${arrival.studentName}</strong></td>
            <td><span class="badge-number">${arrival.idBadge}</span></td>
            <td>${formatTimeOnly(arrival.scheduledStartTime)}</td>
            <td>${formatTimeOnly(arrival.actualArrivalTime)}</td>
            <td><span class="text-warning"><strong>${arrival.lateMinutes} min</strong></span></td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewStudentProgress('${arrival.idBadge}')">View Student</button>
            </td>
        </tr>
    `).join('');
}

async function loadStudentsForScheduling() {
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/students/all`);
        if (!response.ok) throw new Error('Failed to load students');

        const allStudents = await response.json();
        const studentsWithoutSchedule = allStudents.filter(student =>
            student.status === 'ACTIVE' &&
            (!student.scheduleActive || !student.scheduledStartTime)
        );

        if (studentsWithoutSchedule.length === 0) {
            showAlert('No students found without schedules. All active students already have schedules!', 'info');
            document.getElementById('studentSelectionArea').classList.add('d-none');
            return;
        }

        displayStudentsForScheduling(studentsWithoutSchedule);
        showAlert(`Found ${studentsWithoutSchedule.length} students without schedules`, 'success');

    } catch (error) {
        console.error('Failed to load students:', error);
        showAlert('Failed to load students without schedules', 'error');
    } finally {
        hideLoading();
    }
}

function displayStudentsForScheduling(students) {
    const tbody = document.getElementById('schedulingStudentsBody');
    const selectionArea = document.getElementById('studentSelectionArea');

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><h3>No students without schedules</h3></td></tr>';
        selectionArea.classList.add('d-none');
        return;
    }

    tbody.innerHTML = students.map(student => {
        const scheduleText = student.scheduleActive && student.scheduledStartTime
            ? `${student.scheduledStartTime} - ${student.scheduledEndTime}`
            : 'No Schedule';

        return `
            <tr class="student-row-selectable" onclick="toggleStudentSelection(${student.id}, event)" data-student-id="${student.id}">
                <td onclick="event.stopPropagation();">
                    <input type="checkbox" class="student-checkbox" id="checkbox-${student.id}" value="${student.id}" onchange="handleCheckboxChange(${student.id})">
                </td>
                <td><span class="badge-number">${student.idBadge || 'N/A'}</span></td>
                <td><strong>${student.fullName}</strong></td>
                <td class="school-cell" title="${student.school || 'N/A'}">${student.school || 'N/A'}</td>
                <td>
                    <span class="status-badge status-${(student.status || 'active').toLowerCase()}">
                        ${student.status || 'ACTIVE'}
                    </span>
                </td>
                <td>${scheduleText}</td>
            </tr>
        `;
    }).join('');

    selectionArea.classList.remove('d-none');
    selectedStudentsForScheduling.clear();
    updateSelectedCount();
    updateApplyButton();
}

function toggleStudentSelection(studentId, event) {
    if (event.target.type === 'checkbox') return;

    const checkbox = document.getElementById(`checkbox-${studentId}`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        handleCheckboxChange(studentId);
    }
}

function handleCheckboxChange(studentId) {
    const checkbox = document.getElementById(`checkbox-${studentId}`);
    const row = checkbox.closest('tr');

    if (checkbox.checked) {
        selectedStudentsForScheduling.add(studentId);
        row.classList.add('selected');
    } else {
        selectedStudentsForScheduling.delete(studentId);
        row.classList.remove('selected');
    }

    updateSelectedCount();
    updateApplyButton();
    updateSelectAllCheckbox();
}

function toggleAllStudents(checkbox) {
    const allCheckboxes = document.querySelectorAll('.student-checkbox');

    allCheckboxes.forEach(cb => {
        cb.checked = checkbox.checked;
        const studentId = parseInt(cb.value);
        const row = cb.closest('tr');

        if (checkbox.checked) {
            selectedStudentsForScheduling.add(studentId);
            row.classList.add('selected');
        } else {
            selectedStudentsForScheduling.delete(studentId);
            row.classList.remove('selected');
        }
    });

    updateSelectedCount();
    updateApplyButton();
}

function selectAllStudents() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    selectAllCheckbox.checked = true;
    toggleAllStudents(selectAllCheckbox);
}

function deselectAllStudents() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    selectAllCheckbox.checked = false;
    toggleAllStudents(selectAllCheckbox);
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const allCheckboxes = document.querySelectorAll('.student-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.student-checkbox:checked');

    if (allCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    } else if (checkedCheckboxes.length === allCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    }
}

function updateSelectedCount() {
    const countElement = document.getElementById('selectedCount');
    if (countElement) {
        countElement.textContent = selectedStudentsForScheduling.size;
    }
}

function updateApplyButton() {
    const applyBtn = document.getElementById('applyScheduleBtn');
    const warning = document.getElementById('scheduleSelectionWarning');

    if (selectedStudentsForScheduling.size > 0) {
        applyBtn.disabled = false;
        applyBtn.textContent = `Apply Schedule to ${selectedStudentsForScheduling.size} Student${selectedStudentsForScheduling.size !== 1 ? 's' : ''}`;
        warning.style.display = 'none';
    } else {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Apply Schedule to Selected Students';
        warning.style.display = 'none';
    }
}

async function submitBulkSchedule(event) {
    event.preventDefault();

    if (selectedStudentsForScheduling.size === 0) {
        document.getElementById('scheduleSelectionWarning').style.display = 'block';
        showAlert('Please select at least one student', 'error');
        return;
    }

    const startTime = document.getElementById('bulkStartTime').value;
    const endTime = document.getElementById('bulkEndTime').value;
    const gracePeriod = parseInt(document.getElementById('bulkGracePeriod').value);
    const active = document.getElementById('bulkScheduleActive').value === 'true';

    if (!startTime || !endTime) {
        showAlert('Please set both start and end times', 'error');
        return;
    }

    if (startTime >= endTime) {
        showAlert('Start time must be before end time', 'error');
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to apply this schedule to ${selectedStudentsForScheduling.size} student(s)?\n\n` +
        `Schedule: ${startTime} - ${endTime}\n` +
        `Grace Period: ${gracePeriod} minutes\n` +
        `Status: ${active ? 'Active' : 'Inactive'}`
    );

    if (!confirmed) return;

    showLoading();

    try {
        const studentIds = Array.from(selectedStudentsForScheduling);

        const response = await fetch(`${API_BASE_URL}/admin/students/bulk-schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentIds,
                startTime,
                endTime,
                gracePeriodMinutes: gracePeriod,
                active
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to apply bulk schedule');
        }

        const result = await response.json();

        showAlert(`✅ Schedule applied successfully to ${result.updatedCount} out of ${studentIds.length} students!`, 'success');

        selectedStudentsForScheduling.clear();
        clearBulkScheduleForm();
        await loadScheduleOverview();
        await loadAllStudents();

        setTimeout(() => {
            loadStudentsForScheduling();
        }, 1000);

    } catch (error) {
        console.error('Bulk schedule error:', error);
        showAlert(error.message || 'Failed to apply bulk schedule', 'error');
    } finally {
        hideLoading();
    }
}

function clearBulkScheduleForm() {
    document.getElementById('bulkScheduleForm').reset();
    document.getElementById('bulkStartTime').value = '10:00';
    document.getElementById('bulkEndTime').value = '19:00';
    document.getElementById('bulkGracePeriod').value = '5';
    document.getElementById('bulkScheduleActive').value = 'true';

    selectedStudentsForScheduling.clear();
    updateSelectedCount();
    updateApplyButton();

    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    document.querySelectorAll('.student-row-selectable').forEach(row => {
        row.classList.remove('selected');
    });

    document.querySelectorAll('.student-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
}

// ==================== LIVE TASK UPDATES ====================
function initializeLiveTaskUpdates() {
    loadLiveTaskUpdates();
    if (autoRefreshEnabled) {
        startLiveTaskPolling();
    }
}

function startLiveTaskPolling() {
    if (liveTaskInterval) clearInterval(liveTaskInterval);

    liveTaskInterval = setInterval(() => {
        if (currentTab === 'liveTasks' && autoRefreshEnabled) {
            loadLiveTaskUpdates(true);
        }
    }, 60000);
}

function stopLiveTaskPolling() {
    if (liveTaskInterval) {
        clearInterval(liveTaskInterval);
        liveTaskInterval = null;
    }
}

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const toggleBtn = document.getElementById('autoRefreshToggle');

    if (autoRefreshEnabled) {
        toggleBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Auto-Refresh: ON
        `;
        startLiveTaskPolling();
        showAlert('Auto-refresh enabled', 'success');
    } else {
        toggleBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            Auto-Refresh: OFF
        `;
        stopLiveTaskPolling();
        showAlert('Auto-refresh disabled', 'info');
    }
}

async function loadLiveTaskUpdates(silent = false) {
    if (!silent) showLoading();

    try {
        // ✅ FIX: Get ALL currently active sessions (regardless of date)
        const recordsResponse = await fetch(`${API_BASE_URL}/admin/attendance/active-sessions`);
        if (!recordsResponse.ok) throw new Error('Failed to fetch active sessions');

        const activeRecords = await recordsResponse.json();

        const taskPromises = activeRecords.map(async (record) => {
            try {
                const taskResponse = await fetch(`${API_BASE_URL}/admin/attendance/${record.id}/tasks`);
                if (taskResponse.ok) {
                    const taskData = await taskResponse.json();
                    return {
                        record,
                        tasks: taskData.tasks || [],
                        taskCount: taskData.taskCount || 0
                    };
                }
            } catch (error) {
                console.error(`Failed to fetch tasks for record ${record.id}`, error);
            }
            return { record, tasks: [], taskCount: 0 };
        });

        liveTaskData = await Promise.all(taskPromises);

        calculateProductivityStats();
        displayLiveTaskCards();

        lastTaskUpdateTime = new Date();
        updateLastRefreshTime();

        if (!silent) {
            showAlert(`Loaded ${liveTaskData.length} active students`, 'success');
        }

    } catch (error) {
        console.error('Failed to load live task updates:', error);
        if (!silent) {
            showAlert('Failed to load live task updates', 'error');
        }
    } finally {
        if (!silent) hideLoading();
    }
}

function calculateProductivityStats() {
    const stats = {
        totalActive: liveTaskData.length,
        veryActive: 0,
        active: 0,
        idle: 0,
        totalTasks: 0
    };

    const now = new Date();

    liveTaskData.forEach(student => {
        stats.totalTasks += student.taskCount;

        const timeInDate = new Date(student.record.timeIn);
        const hoursWorked = (now - timeInDate) / (1000 * 60 * 60);

        if (student.taskCount >= 5) {
            stats.veryActive++;
        } else if (student.taskCount >= 1) {
            stats.active++;
        } else if (hoursWorked >= 1) {
            stats.idle++;
        }
    });

    document.getElementById('statTotalActive').textContent = stats.totalActive;
    document.getElementById('statVeryActive').textContent = stats.veryActive;
    document.getElementById('statActive').textContent = stats.active;
    document.getElementById('statIdle').textContent = stats.idle;
    document.getElementById('statTotalTasks').textContent = stats.totalTasks;
}

// Display live task cards
function displayLiveTaskCards() {
    const container = document.getElementById('liveTaskCardsContainer');

    if (liveTaskData.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>📋 No active students currently</h3>
                <p>Students will appear here when they time in</p>
            </div>
        `;
        return;
    }

    // Sort by most recent activity
    const sortedData = sortLiveTaskData();

    container.innerHTML = sortedData.map(student => {
        const productivity = calculateProductivity(student);
        return createTaskCard(student, productivity);
    }).join('');
}

// Calculate productivity level for a student
function calculateProductivity(student) {
    const now = new Date();
    const timeInDate = new Date(student.record.timeIn);
    const hoursWorked = (now - timeInDate) / (1000 * 60 * 60);

    let level = 'idle';
    let color = '#ef4444'; // red
    let label = 'Idle';
    let icon = '🔴';

    if (student.taskCount >= 5) {
        level = 'very-active';
        color = '#10b981'; // green
        label = 'Very Active';
        icon = '🟢';
    } else if (student.taskCount >= 1) {
        level = 'active';
        color = '#f59e0b'; // yellow
        label = 'Active';
        icon = '🟡';
    } else if (hoursWorked < 1) {
        level = 'new';
        color = '#3b82f6'; // blue
        label = 'Just Started';
        icon = '🔵';
    }

    // Calculate last activity
    let lastActivity = 'No tasks yet';
    let idleWarning = false;

    if (student.tasks.length > 0) {
        const lastTask = student.tasks[student.tasks.length - 1];
        const lastTaskTime = new Date(lastTask.completedAt);
        const minutesSinceLastTask = (now - lastTaskTime) / (1000 * 60);

        lastActivity = `Last task: ${formatTimeAgo(lastTask.completedAt)}`;

        // Show idle warning if no tasks for 2+ hours
        if (minutesSinceLastTask > 120) {
            idleWarning = true;
        }
    }

    return {
        level,
        color,
        label,
        icon,
        lastActivity,
        idleWarning,
        hoursWorked
    };
}

// Create task card HTML
function createTaskCard(student, productivity) {
    const now = new Date();
    const timeInDate = new Date(student.record.timeIn);
    const workingTime = formatWorkingTime(timeInDate, now);

    // Get first 5 tasks
    const displayTasks = student.tasks.slice(-5).reverse();
    const hasMoreTasks = student.tasks.length > 5;

    return `
        <div class="task-card" data-productivity="${productivity.level}">
            <div class="task-card-header" style="background: ${productivity.color};">
                <div class="task-card-title">
                    <div class="task-card-name">${student.record.studentName}</div>
                    <div class="task-card-badge">${student.record.idBadge}</div>
                </div>
                <div class="task-card-status">
                    <span class="productivity-badge">${productivity.icon} ${productivity.label}</span>
                    <span class="task-count-badge">${student.taskCount} tasks</span>
                </div>
            </div>

            <div class="task-card-body">
                <div class="task-card-info">
                    <div class="info-item">
                        <span class="info-label">⏰ Working Time:</span>
                        <span class="info-value">${workingTime}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">📍 Status:</span>
                        <span class="info-value">${productivity.lastActivity}</span>
                    </div>
                    ${productivity.idleWarning ? `
                        <div class="idle-warning">
                            ⚠️ No tasks logged for 2+ hours
                        </div>
                    ` : ''}
                </div>

                <div class="task-list">
                    ${displayTasks.length > 0 ? `
                        <div class="task-list-header">Recent Tasks:</div>
                        ${displayTasks.map(task => `
                            <div class="task-item">
                                <div class="task-time">${formatTime(task.completedAt)}</div>
                                <div class="task-description">${truncateText(task.taskDescription, 80)}</div>
                                <div class="task-ago">${formatTimeAgo(task.completedAt)}</div>
                            </div>
                        `).join('')}
                        ${hasMoreTasks ? `
                            <button class="btn btn-sm btn-info view-all-tasks" onclick="showAllTasks(${student.record.id}, '${student.record.studentName}')">
                                View All ${student.taskCount} Tasks
                            </button>
                        ` : ''}
                    ` : `
                        <div class="no-tasks">
                            📝 No tasks logged yet
                        </div>
                    `}
                </div>
            </div>

            <div class="task-card-footer">
                <button class="btn btn-sm btn-info" onclick="viewStudentProgress('${student.record.idBadge}')">
                    👤 View Profile
                </button>
                <button class="btn btn-sm btn-success" onclick="showAllTasks(${student.record.id}, '${student.record.studentName}')">
                    📋 All Tasks
                </button>
            </div>
        </div>
    `;
}

// Show all tasks in modal
async function showAllTasks(recordId, studentName) {
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/${recordId}/tasks`);
        if (!response.ok) throw new Error('Failed to fetch tasks');

        const data = await response.json();

        const content = document.getElementById('allTasksContent');
        content.innerHTML = `
            <div class="student-detail">
                <h4>${studentName}</h4>
                <p><strong>Total Tasks Today:</strong> ${data.taskCount || 0}</p>
                <p><strong>Date:</strong> ${formatDate(data.attendanceDate)}</p>
            </div>

            <div class="student-detail">
                <h4>Task Timeline</h4>
                ${data.tasks && data.tasks.length > 0 ? `
                    <div class="task-timeline">
                        ${data.tasks.slice().reverse().map((task, index) => `
                            <div class="timeline-item">
                                <div class="timeline-marker">${data.tasks.length - index}</div>
                                <div class="timeline-content">
                                    <div class="timeline-time">
                                        ${formatTime(task.completedAt)}
                                        <span class="timeline-ago">(${formatTimeAgo(task.completedAt)})</span>
                                    </div>
                                    <div class="timeline-description">${task.taskDescription}</div>
                                    ${task.addedDuringTimeout ?
                                        '<span class="timeline-badge">Added during time-out</span>' :
                                        '<span class="timeline-badge timeline-badge-live">Real-time log</span>'
                                    }
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="empty-state">
                        <p>No tasks logged yet</p>
                    </div>
                `}
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('allTasksModal')">Close</button>
            </div>
        `;

        showModal('allTasksModal');
    } catch (error) {
        console.error('Failed to load all tasks:', error);
        showAlert('Failed to load tasks', 'error');
    } finally {
        hideLoading();
    }
}

function sortLiveTaskData() {
    const sortBy = document.getElementById('taskSortSelect')?.value || 'recent';

    return [...liveTaskData].sort((a, b) => {
        switch (sortBy) {
            case 'recent':
                const aLastTask = a.tasks.length > 0 ? new Date(a.tasks[a.tasks.length - 1].completedAt) : new Date(0);
                const bLastTask = b.tasks.length > 0 ? new Date(b.tasks[b.tasks.length - 1].completedAt) : new Date(0);
                return bLastTask - aLastTask;
            case 'tasks':
                return b.taskCount - a.taskCount;
            case 'name':
                return a.record.studentName.localeCompare(b.record.studentName);
            case 'time':
                return new Date(a.record.timeIn) - new Date(b.record.timeIn);
            default:
                return 0;
        }
    });
}

function filterLiveTasks() {
    const filterValue = document.getElementById('productivityFilter')?.value || 'all';
    const cards = document.querySelectorAll('.task-card');

    cards.forEach(card => {
        const productivity = card.getAttribute('data-productivity');
        card.style.display = (filterValue === 'all' || productivity === filterValue) ? 'block' : 'none';
    });

    const visibleCount = Array.from(cards).filter(c => c.style.display !== 'none').length;
    showAlert(`Showing ${visibleCount} of ${cards.length} students`, 'info');
}

function updateLastRefreshTime() {
    const element = document.getElementById('lastRefreshTime');
    if (element) {
        element.textContent = formatTime(lastTaskUpdateTime);
    }
}

function formatWorkingTime(startTime, currentTime) {
    const diff = currentTime - startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    else if (minutes === 0) return `${hours}h`;
    else return `${hours}h ${minutes}m`;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers to filter chips in Live Tasks
    const liveTasksTab = document.getElementById('liveTasks');
    if (liveTasksTab) {
        const filterChips = liveTasksTab.querySelectorAll('.filter-chip');
        filterChips.forEach(chip => {
            chip.addEventListener('click', function() {
                // Remove active class from all chips
                filterChips.forEach(c => c.classList.remove('active'));
                // Add active class to clicked chip
                this.classList.add('active');
            });
        });
    }
});

// ==================== REPORTS ====================
async function downloadCSVReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    if (!startDate || !endDate) {
        showAlert('Please select both start and end dates', 'warning');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/reports/csv?startDate=${startDate}&endDate=${endDate}`);

        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, `attendance-report-${startDate}-${endDate}.csv`);
            showAlert('CSV report downloaded successfully', 'success');
        } else {
            showAlert('Failed to generate CSV report', 'error');
        }
    } catch (error) {
        showAlert('Failed to generate CSV report', 'error');
    } finally {
        hideLoading();
    }
}

async function downloadExcelReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    if (!startDate || !endDate) {
        showAlert('Please select both start and end dates', 'warning');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/reports/excel?startDate=${startDate}&endDate=${endDate}`);

        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, `attendance-report-${startDate}-${endDate}.xlsx`);
            showAlert('Excel report downloaded successfully', 'success');
        } else {
            showAlert('Failed to generate Excel report', 'error');
        }
    } catch (error) {
        showAlert('Failed to generate Excel report', 'error');
    } finally {
        hideLoading();
    }
}

async function downloadStudentReport() {
    const studentId = document.getElementById('reportStudentId').value.trim();
    const startDate = document.getElementById('studentReportStart').value;
    const endDate = document.getElementById('studentReportEnd').value;

    if (!studentId || !startDate || !endDate) {
        showAlert('Please fill in all fields', 'warning');
        return;
    }

    if (!/^\d{4}$/.test(studentId)) {
        showAlert('Student ID must be exactly 4 digits', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/reports/student/${studentId}/csv?startDate=${startDate}&endDate=${endDate}`);

        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, `student-${studentId}-report-${startDate}-${endDate}.csv`);
            showAlert('Student report downloaded successfully', 'success');
        } else {
            showAlert('Failed to generate student report', 'error');
        }
    } catch (error) {
        showAlert('Failed to generate student report', 'error');
    } finally {
        hideLoading();
    }
}

function generateTodayReport() {
    const today = formatDate(new Date());
    document.getElementById('reportStartDate').value = today;
    document.getElementById('reportEndDate').value = today;
    downloadCSVReport();
}

function generateWeekReport() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    document.getElementById('reportStartDate').value = formatDate(startOfWeek);
    document.getElementById('reportEndDate').value = formatDate(today);
    downloadCSVReport();
}

function generateMonthReport() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('reportStartDate').value = formatDate(startOfMonth);
    document.getElementById('reportEndDate').value = formatDate(today);
    downloadCSVReport();
}

// ==================== ADDITIONAL STUDENT REPORT FUNCTIONS ====================

/**
 * Download only active students
 */
function downloadActiveStudentsCSV() {
    const activeStudents = studentsCache.filter(s => s.status === 'ACTIVE');

    if (activeStudents.length === 0) {
        showAlert('No active students to export', 'warning');
        return;
    }

    exportStudentsToCSV(activeStudents, 'active-students');
}

/**
 * Download progress report with detailed completion info
 */
function downloadProgressReport() {
    const studentsWithHours = studentsCache.filter(s => s.requiredHours && s.requiredHours > 0);

    if (studentsWithHours.length === 0) {
        showAlert('No students with required hours set', 'warning');
        return;
    }

    const headers = [
        'ID Badge',
        'Full Name',
        'School',
        'Status',
        'Required Hours',
        'Hours Completed',
        'Hours Remaining',
        'Progress (%)',
        'Completion Status'
    ];

    const csvRows = [headers.join(',')];

    studentsWithHours.forEach(student => {
        const totalHours = parseFloat(student.totalAccumulatedHours || 0);
        const requiredHours = parseFloat(student.requiredHours);
        const remaining = Math.max(0, requiredHours - totalHours);
        const progress = ((totalHours / requiredHours) * 100).toFixed(1);

        let completionStatus = 'In Progress';
        if (totalHours >= requiredHours) {
            completionStatus = 'Completed';
        } else if (progress >= 90) {
            completionStatus = 'Near Completion';
        } else if (progress >= 75) {
            completionStatus = 'Almost There';
        } else if (progress >= 60) {
            completionStatus = 'More Than Halfway';
        } else if (progress >= 50) {
            completionStatus = 'Halfway';
        } else if (progress >= 30) {
            completionStatus = 'Making Progress';
        } else if (progress >= 15) {
            completionStatus = 'Getting Started';
        } else if (progress >= 5) {
            completionStatus = 'Just Started';
        }

        const row = [
            student.idBadge,
            `"${student.fullName}"`,
            `"${student.school || 'N/A'}"`,
            student.status,
            requiredHours.toFixed(2),
            totalHours.toFixed(2),
            remaining.toFixed(2),
            progress,
            completionStatus
        ];

        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `progress-report-${dateStr}.csv`;

    downloadFile(blob, filename);
    showAlert(`✅ Progress report exported for ${studentsWithHours.length} student(s)!`, 'success');
}

/**
 * Helper function to export students array to CSV
 */
function exportStudentsToCSV(students, prefix = 'students') {
    const headers = [
        'ID Badge',
        'Full Name',
        'School',
        'Status',
        'Required Hours',
        'Total Hours',
        'Progress (%)',
        'Hours Remaining',
        'Schedule Start',
        'Schedule End',
        'Grace Period',
        'Schedule Active'
    ];

    const csvRows = [headers.join(',')];

    students.forEach(student => {
        const totalHours = parseFloat(student.totalAccumulatedHours || 0);
        const requiredHours = parseFloat(student.requiredHours || 0);
        const progress = requiredHours > 0 ? ((totalHours / requiredHours) * 100).toFixed(1) : 'N/A';
        const remaining = requiredHours > 0 ? Math.max(0, requiredHours - totalHours).toFixed(2) : 'N/A';

        const row = [
            student.idBadge || 'N/A',
            `"${student.fullName || 'Unknown'}"`,
            `"${student.school || 'N/A'}"`,
            student.status || 'ACTIVE',
            requiredHours > 0 ? requiredHours : 'Not Set',
            totalHours.toFixed(2),
            progress,
            remaining,
            student.scheduledStartTime || 'N/A',
            student.scheduledEndTime || 'N/A',
            student.gracePeriodMinutes || 'N/A',
            student.scheduleActive ? 'Yes' : 'No'
        ];

        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${prefix}-export-${dateStr}.csv`;

    downloadFile(blob, filename);
    showAlert(`✅ Exported ${students.length} student(s) successfully!`, 'success');
}

/**
 * Update report statistics in sidebar
 */
async function updateReportStats() {
    try {
        const studentsResponse = await fetch(`${API_BASE_URL}/students/all`);
        const students = studentsResponse.ok ? await studentsResponse.json() : [];

        const today = formatDate(new Date());
        const recordsResponse = await fetch(`${API_BASE_URL}/attendance/records?date=${today}`);
        const records = recordsResponse.ok ? await recordsResponse.json() : [];

        document.getElementById('reportTotalStudents').textContent = students.length;
        document.getElementById('reportActiveStudents').textContent = students.filter(s => s.status === 'ACTIVE').length;
        document.getElementById('reportTotalRecords').textContent = records.length;

        showAlert('Report statistics updated', 'success');
    } catch (error) {
        console.error('Failed to update report stats:', error);
    }
}

// Auto-update report stats when tab is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Update stats when Reports tab is clicked
    const reportsTab = document.querySelector('[onclick="switchTab(\'reports\')"]');
    if (reportsTab) {
        reportsTab.addEventListener('click', updateReportStats);
    }
});

// ==================== NOTIFICATIONS ====================
async function loadNotifications() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/unread`);
        if (response.ok) {
            const notifications = await response.json();
            currentNotifications = notifications;
            updateNotificationBadge(notifications.length);
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function updateNotificationBadge(count) {
    const navBadge = document.getElementById('navNotificationBadge');
    if (navBadge) {
        if (count > 0) {
            navBadge.textContent = count;
            navBadge.style.display = 'inline-flex';
        } else {
            navBadge.textContent = '0';
            navBadge.style.display = 'none';
        }
    }
}

async function displayNotifications() {
    const content = document.getElementById('notificationContent');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications`);
        if (response.ok) {
            const notifications = await response.json();

            // Update stats
            updateNotificationStats(notifications);

            if (notifications.length === 0) {
                content.innerHTML = `
                    <div class="notification-empty-state">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <h3>All Clear!</h3>
                        <p>You don't have any notifications</p>
                    </div>
                `;
                return;
            }

            content.innerHTML = notifications.map(notification => {
                const icon = getNotificationIcon(notification.notificationType);

                return `
                    <div class="notification-item-enhanced ${notification.isRead ? 'read' : 'unread'}"
                            onclick="markNotificationRead(${notification.id})"
                            data-read="${notification.isRead}">
                        <div class="notification-icon">${icon}</div>
                        <div class="notification-body">
                            <div class="notification-meta">
                                <span class="notification-type">${notification.notificationType.replace('_', ' ')}</span>
                                <span class="notification-time">${formatTimeAgo(notification.createdAt)}</span>
                            </div>
                            <div class="notification-message">${notification.message}</div>
                            ${!notification.isRead ? `
                                <div class="notification-actions">
                                    <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); markNotificationRead(${notification.id});">
                                        Mark as Read
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            content.innerHTML = `
                <div class="notification-empty-state">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Failed to Load</h3>
                    <p>Unable to load notifications</p>
                </div>
            `;
        }
    } catch (error) {
        content.innerHTML = `
            <div class="notification-empty-state">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Error</h3>
                <p>Failed to load notifications</p>
            </div>
        `;
    }
}

// Get icon based on notification type
function getNotificationIcon(type) {
    const icons = {
        'FORGOT_TIME_OUT': '⏰',
        'LATE_ARRIVAL': '⚠️',
        'TIME_CORRECTION': '✏️',
        'SYSTEM_ERROR': '🔧',
        'STUDENT_COMPLETED': '🎉',
        'AUTO_TIMEOUT': '🔔',
        'SCHEDULE_REMINDER': '📅'
    };
    return icons[type] || '🔔';
}

// Update notification stats
function updateNotificationStats(notifications) {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.isRead).length;
    const read = total - unread;

    document.getElementById('notifTotalCount').textContent = total;
    document.getElementById('notifUnreadCount').textContent = unread;
    document.getElementById('filterAllCount').textContent = total;
    document.getElementById('filterUnreadCount').textContent = unread;
    document.getElementById('filterReadCount').textContent = read;
}

// Filter notifications
function filterNotifications(filter) {
    // Update active tab
    document.querySelectorAll('.notification-filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    // Filter notification items
    const items = document.querySelectorAll('.notification-item-enhanced');
    items.forEach(item => {
        const isRead = item.getAttribute('data-read') === 'true';

        if (filter === 'all') {
            item.style.display = 'flex';
        } else if (filter === 'unread') {
            item.style.display = isRead ? 'none' : 'flex';
        } else if (filter === 'read') {
            item.style.display = isRead ? 'flex' : 'none';
        }
    });
}

async function markNotificationRead(notificationId) {
    try {
        await fetch(`${API_BASE_URL}/admin/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
        await loadNotifications();
        displayNotifications();
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        await fetch(`${API_BASE_URL}/admin/notifications/read-all`, {
            method: 'PUT'
        });
        showAlert('All notifications marked as read', 'success');
        await loadNotifications();
        displayNotifications();
    } catch (error) {
        showAlert('Failed to mark notifications as read', 'error');
    }
}

// ==================== NOTIFICATIONS TAB ====================

async function loadNotificationsTab() {
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications`);
        if (response.ok) {
            const notifications = await response.json();
            displayNotificationsTab(notifications);
            updateNotificationTabStats(notifications);
        } else {
            document.getElementById('notificationsTabContent').innerHTML = `
                <div class="empty-state-modern">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Failed to load notifications</h3>
                    <p>Please try refreshing the page</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
        showAlert('Failed to load notifications', 'error');
    } finally {
        hideLoading();
    }
}

function displayNotificationsTab(notifications) {
    const container = document.getElementById('notificationsTabContent');

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state-modern">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <h3>✅ All Clear!</h3>
                <p>You don't have any notifications</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notifications.map(notification => {
        const icon = getNotificationIcon(notification.notificationType);
        const isUnread = !notification.isRead;

        return `
            <div class="notification-item-tab ${isUnread ? 'unread' : 'read'}"
                 data-read="${notification.isRead}"
                 onclick="markNotificationReadTab(${notification.id})">
                <div class="notification-icon-tab">${icon}</div>
                <div class="notification-body-tab">
                    <div class="notification-meta-tab">
                        <span class="notification-type-tab">${notification.notificationType.replace('_', ' ')}</span>
                        <span class="notification-time-tab">${formatTimeAgo(notification.createdAt)}</span>
                    </div>
                    <div class="notification-message-tab">${notification.message}</div>
                    ${isUnread ? `
                        <button class="notification-mark-read-btn" onclick="event.stopPropagation(); markNotificationReadTab(${notification.id})">
                            Mark as Read
                        </button>
                    ` : ''}
                </div>
                <button class="notification-delete-btn-tab" onclick="event.stopPropagation(); deleteNotificationTab(${notification.id})" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

function updateNotificationTabStats(notifications) {
    const total = notifications.length;
    const unread = notifications.filter(n => !n.isRead).length;
    const read = total - unread;

    document.getElementById('sidebarNotifTotal').textContent = total;
    document.getElementById('sidebarNotifUnread').textContent = unread;
    document.getElementById('sidebarNotifRead').textContent = read;

    document.getElementById('filterAllCountTab').textContent = total;
    document.getElementById('filterUnreadCountTab').textContent = unread;
    document.getElementById('filterReadCountTab').textContent = read;
}

function filterNotificationsTab(filter) {
    // Update active filter chip
    document.querySelectorAll('#notifications .filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    document.querySelector(`#notifications [data-filter="${filter}"]`).classList.add('active');

    // Filter notification items
    const items = document.querySelectorAll('.notification-item-tab');
    items.forEach(item => {
        const isRead = item.getAttribute('data-read') === 'true';

        if (filter === 'all') {
            item.style.display = 'flex';
        } else if (filter === 'unread') {
            item.style.display = isRead ? 'none' : 'flex';
        } else if (filter === 'read') {
            item.style.display = isRead ? 'flex' : 'none';
        }
    });
}

async function markNotificationReadTab(notificationId) {
    try {
        await fetch(`${API_BASE_URL}/admin/notifications/${notificationId}/read`, {
            method: 'PUT'
        });
        await loadNotifications(); // Update badge
        await loadNotificationsTab(); // Refresh list
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

async function markAllNotificationsReadTab() {
    try {
        await fetch(`${API_BASE_URL}/admin/notifications/read-all`, {
            method: 'PUT'
        });
        showAlert('All notifications marked as read', 'success');
        await loadNotifications();
        await loadNotificationsTab();
    } catch (error) {
        showAlert('Failed to mark notifications as read', 'error');
    }
}

async function deleteNotificationTab(notificationId) {
    if (!confirm('Delete this notification?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/${notificationId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert('Notification deleted', 'success');
            await loadNotifications();
            await loadNotificationsTab();
        } else {
            showAlert('Failed to delete notification', 'error');
        }
    } catch (error) {
        console.error('Delete notification error:', error);
        showAlert('Failed to delete notification', 'error');
    }
}

async function clearReadNotificationsTab() {
    if (!confirm('Delete all read notifications?')) return;

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/clear-read`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(`${result.deletedCount} read notifications cleared`, 'success');
            await loadNotifications();
            await loadNotificationsTab();
        } else {
            showAlert('Failed to clear read notifications', 'error');
        }
    } catch (error) {
        console.error('Clear read notifications error:', error);
        showAlert('Failed to clear read notifications', 'error');
    } finally {
        hideLoading();
    }
}

async function clearAllNotificationsTab() {
    // Load current notification counts
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications`);
        if (response.ok) {
            const notifications = await response.json();
            const total = notifications.length;
            const unread = notifications.filter(n => !n.isRead).length;

            document.getElementById('clearAllTotalCount').textContent = total;
            document.getElementById('clearAllUnreadCount').textContent = unread;

            // Clear the confirmation input
            document.getElementById('clearAllConfirmInput').value = '';

            showModal('clearAllNotificationsModal');

            // Focus on input after modal animation
            setTimeout(() => {
                const input = document.getElementById('clearAllConfirmInput');
                if (input) input.focus();
            }, 300);
        }
    } catch (error) {
        console.error('Failed to load notification counts:', error);
        showAlert('Failed to load notification data', 'error');
    }
}

// ==================== NOTIFICATION MANAGEMENT ====================

/**
 * Delete a single notification
 */
async function deleteNotification(notificationId) {
    if (!confirm('Delete this notification?')) return;

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/${notificationId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showAlert('Notification deleted successfully', 'success');
            await loadNotifications();
            displayNotifications();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to delete notification', 'error');
        }
    } catch (error) {
        console.error('Delete notification error:', error);
        showAlert('Failed to delete notification', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Delete multiple notifications (bulk delete)
 */
async function deleteSelectedNotifications() {
    const checkboxes = document.querySelectorAll('.notification-checkbox:checked');
    const notificationIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (notificationIds.length === 0) {
        showAlert('Please select notifications to delete', 'warning');
        return;
    }

    const confirmed = confirm(`Delete ${notificationIds.length} notification(s)?`);
    if (!confirmed) return;

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/bulk`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificationIds)
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(`${result.deletedCount} notifications deleted`, 'success');
            await loadNotifications();
            displayNotifications();
        } else {
            showAlert('Failed to delete notifications', 'error');
        }
    } catch (error) {
        console.error('Bulk delete error:', error);
        showAlert('Failed to delete notifications', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Clear all read notifications
 */
async function clearReadNotifications() {
    const confirmed = confirm('Delete all read notifications? This cannot be undone.');
    if (!confirmed) return;

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/clear-read`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(`${result.deletedCount} read notifications cleared`, 'success');
            await loadNotifications();
            displayNotifications();
        } else {
            showAlert('Failed to clear read notifications', 'error');
        }
    } catch (error) {
        console.error('Clear read notifications error:', error);
        showAlert('Failed to clear read notifications', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Clear all notifications
 */
async function clearAllNotifications() {
    // Load current notification counts
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications`);
        if (response.ok) {
            const notifications = await response.json();
            const total = notifications.length;
            const unread = notifications.filter(n => !n.isRead).length;

            document.getElementById('clearAllTotalCount').textContent = total;
            document.getElementById('clearAllUnreadCount').textContent = unread;

            // Clear the confirmation input
            document.getElementById('clearAllConfirmInput').value = '';

            showModal('clearAllNotificationsModal');

            // Focus on input after modal animation
            setTimeout(() => {
                const input = document.getElementById('clearAllConfirmInput');
                if (input) input.focus();
            }, 300);
        }
    } catch (error) {
        console.error('Failed to load notification counts:', error);
        showAlert('Failed to load notification data', 'error');
    }
}

async function executeClearAllNotifications() {
    const typedText = document.getElementById('clearAllConfirmInput').value.trim().toUpperCase();

    if (typedText !== 'DELETE ALL') {
        showAlert('❌ Confirmation text does not match. Deletion cancelled.', 'error');
        return;
    }

    closeModal('clearAllNotificationsModal');
    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/clear-all?confirm=true`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(`✅ All notifications cleared (${result.deletedCount} deleted)`, 'success');
            await loadNotifications();

            // Check if we're on the notifications tab and reload it
            if (currentTab === 'notifications') {
                await loadNotificationsTab();
            }
        } else {
            showAlert('Failed to clear all notifications', 'error');
        }
    } catch (error) {
        console.error('Clear all notifications error:', error);
        showAlert('Failed to clear all notifications', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Cleanup old notifications
 */
async function cleanupOldNotifications(daysOld = 30) {
    showModal('cleanupNotificationsModal');
}

async function submitCleanupNotifications(event) {
    if (event) event.preventDefault();

    const daysOld = parseInt(document.getElementById('cleanupDays').value);

    if (daysOld < 1 || daysOld > 365) {
        showAlert('Please enter a valid number of days (1-365)', 'error');
        return;
    }

    const confirmed = confirm(`Delete all notifications older than ${daysOld} days?`);
    if (!confirmed) return;

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications/cleanup?daysOld=${daysOld}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const result = await response.json();
            showAlert(result.message + ` (${result.deletedCount} deleted)`, 'success');
            closeModal('cleanupNotificationsModal');
            await loadNotifications();
            displayNotifications();
        } else {
            showAlert('Failed to cleanup notifications', 'error');
        }
    } catch (error) {
        console.error('Cleanup notifications error:', error);
        showAlert('Failed to cleanup notifications', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Enhanced notification display with delete options
 */
async function displayNotifications() {
    const content = document.getElementById('notificationContent');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications`);
        if (response.ok) {
            const notifications = await response.json();

            if (notifications.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <h3>No notifications</h3>
                        <p>All caught up!</p>
                    </div>
                `;
                return;
            }

            // Add bulk action toolbar
            const notificationsList = notifications.map(notification => `
                <div class="notification-item-enhanced ${notification.isRead ? 'read' : 'unread'}">
                    <div class="notification-checkbox-wrapper">
                        <input type="checkbox" class="notification-checkbox" value="${notification.id}">
                    </div>
                    <div class="notification-body" onclick="markNotificationRead(${notification.id})">
                        <div class="notification-meta">
                            <div class="notification-type">${notification.notificationType.replace('_', ' ')}</div>
                            <div class="notification-time">${formatTimeAgo(notification.createdAt)}</div>
                        </div>
                        <div class="notification-message">${notification.message}</div>
                    </div>
                    <button class="notification-delete-btn" onclick="event.stopPropagation(); deleteNotification(${notification.id})" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `).join('');

            content.innerHTML = toolbar + notificationsList;
        } else {
            content.innerHTML = '<div class="empty-state"><h3>Failed to load notifications</h3></div>';
        }
    } catch (error) {
        content.innerHTML = '<div class="empty-state"><h3>Failed to load notifications</h3></div>';
    }
}

function selectAllNotifications() {
    document.querySelectorAll('.notification-checkbox').forEach(cb => cb.checked = true);
}

function deselectAllNotifications() {
    document.querySelectorAll('.notification-checkbox').forEach(cb => cb.checked = false);
}

// ==================== SETTINGS TAB ====================
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/auth/password-info/admin`);
        if (response.ok) {
            const data = await response.json();
            displayPasswordInfo(data);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

function displayPasswordInfo(data) {
    const lastChanged = data.lastChanged ? formatDateTime(data.lastChanged) : 'Never';
    document.getElementById('passwordLastChanged').textContent = lastChanged;
}

async function showChangePasswordModal() {
    document.getElementById('changePasswordForm').reset();
    showModal('changePasswordModal');
}

async function submitChangePassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showAlert('Password must be at least 8 characters long', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/auth/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                currentPassword: currentPassword,
                newPassword: newPassword
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showAlert('Password changed successfully!', 'success');
            closeModal('changePasswordModal');
            await loadSettings();
        } else {
            showAlert(data.message || 'Failed to change password', 'error');
        }

    } catch (error) {
        showAlert('Failed to change password: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function generateSecurePassword() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/auth/generate-password`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('newPassword').value = data.password;
            document.getElementById('confirmPassword').value = data.password;
            showAlert('Secure password generated! Please save it safely.', 'info');
        }
    } catch (error) {
        showAlert('Failed to generate password', 'error');
    }
}

// ==================== SIDEBAR STATS UPDATES ====================

// Update Attendance Sidebar Stats
function updateAttendanceSidebarStats(records) {
    const totalRecords = records.length;
    const totalHours = records.reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);
    const uniqueStudents = new Set(records.map(r => r.idBadge)).size;
    const averageHours = totalRecords > 0 ? totalHours / totalRecords : 0;

    document.getElementById('sidebarTotalRecords').textContent = totalRecords;
    document.getElementById('sidebarTotalHours').textContent = formatHoursMinutes(totalHours);
    document.getElementById('sidebarActiveCount').textContent = uniqueStudents;
    document.getElementById('sidebarAvgHours').textContent = formatHoursMinutes(averageHours);

    // Show/hide download button
    const downloadBtn = document.getElementById('sidebarDownloadBtn');
    if (downloadBtn) {
        downloadBtn.style.display = totalRecords > 0 ? 'flex' : 'none';
    }
}

// Update Schedule Sidebar Stats
function updateScheduleSidebarStats(data) {
    const withSchedule = data.studentsWithSchedule || 0;
    const withoutSchedule = data.studentsWithoutSchedule || 0;
    const total = withSchedule + withoutSchedule;
    const compliance = total > 0 ? Math.round((withSchedule / total) * 100) : 0;

    document.getElementById('sidebarWithSchedule').textContent = withSchedule;
    document.getElementById('sidebarWithoutSchedule').textContent = withoutSchedule;
    document.getElementById('sidebarCompliance').textContent = compliance + '%';
}

// Update Late Arrivals Sidebar
function updateLateArrivalsSidebar(arrivals) {
    const lateToday = arrivals.length || 0;
    const sidebarElement = document.getElementById('sidebarLateToday');
    if (sidebarElement) {
        sidebarElement.textContent = lateToday;
    }
}

// Update Corrections Sidebar Stats
function updateCorrectionsSidebarStats(records) {
    const pendingCount = records.length;

    // Count critical (12+ hours)
    const criticalCount = records.filter(r => {
        const hours = parseFloat(calculateElapsedHours(r.timeIn));
        return r.status === 'TIMED_IN' && hours >= 12;
    }).length;

    // Update main pending count
    document.getElementById('sidebarPendingCorrections').textContent = pendingCount;

    // Count this month's corrections
    const now = new Date();
    const thisMonth = records.filter(r => {
        const recordDate = new Date(r.attendanceDate);
        return recordDate.getMonth() === now.getMonth() &&
                recordDate.getFullYear() === now.getFullYear();
    }).length;

    const monthElement = document.getElementById('sidebarMonthCorrections');
    if (monthElement) {
        monthElement.textContent = thisMonth;
    }

    // Add critical count to sidebar if element exists
    const criticalElement = document.getElementById('sidebarCriticalCorrections');
    if (criticalElement) {
        criticalElement.textContent = criticalCount;
    }
}

// ==================== UTILITY FUNCTIONS ====================
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    document.body.style.overflow = '';
}

function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function formatDate(date) {
    if (!date) return '';
    if (typeof date === 'string') return date;
    return new Date(date).toISOString().split('T')[0];
}

function formatTime(timeString) {
    if (!timeString) return '';
    try {
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Invalid time';
    }
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    try {
        return new Date(dateTimeString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Invalid date/time';
    }
}

function formatTimeAgo(timeString) {
    if (!timeString) return '';
    try {
        const now = new Date();
        const time = new Date(timeString);
        const diffInSeconds = Math.floor((now - time) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch {
        return '';
    }
}

function formatHoursMinutes(decimalHours) {
    if (!decimalHours || decimalHours === 0) return "0h";

    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    else if (minutes === 0) return `${hours}h`;
    else return `${hours}h ${minutes}m`;
}

function formatTimeOnly(timeValue) {
    if (!timeValue) return 'N/A';

    try {
        if (typeof timeValue === 'string') {
            const timeParts = timeValue.split(':');
            if (timeParts.length >= 2) {
                let hours = parseInt(timeParts[0]);
                const minutes = timeParts[1].padStart(2, '0');
                const period = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                return `${hours}:${minutes} ${period}`;
            }
            return timeValue;
        }

        if (timeValue instanceof Date) {
            return timeValue.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }

        if (Array.isArray(timeValue) && timeValue.length >= 2) {
            let hours = parseInt(timeValue[0]);
            const minutes = timeValue[1].toString().padStart(2, '0');
            const period = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${hours}:${minutes} ${period}`;
        }

        return 'Invalid Time';
    } catch (error) {
        console.error('Error formatting time:', timeValue, error);
        return 'Invalid Time';
    }
}

function calculateElapsedHours(timeInString) {
    if (!timeInString) return '0.0';
    try {
        const now = new Date();
        const timeIn = new Date(timeInString);
        const diffInHours = (now - timeIn) / (1000 * 60 * 60);
        return Math.max(0, diffInHours).toFixed(1);
    } catch {
        return '0.0';
    }
}

function showLoading() {
    document.getElementById('loading').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('show');
}

function startPeriodicRefresh() {
    setInterval(() => {
        if (currentTab === 'dashboard') {
            loadDashboard();
        }
    }, 30000);

    setInterval(() => {
        loadNotifications();
    }, 60000);

    setInterval(() => {
        if (currentTab === 'students') {
            loadAllStudents();
        }
    }, 120000);
}

console.log('✅ TERA IT Admin Panel - Clean Version Loaded Successfully');