const API_BASE_URL = 'https://ojtattendanceapplication-production.up.railway.app/api';
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

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    setupEventListeners();
    loadInitialData();
    setDefaultDates();
    startPeriodicRefresh();
    initializeTabs();
});

document.getElementById('badgeManagementForm').addEventListener('submit', function(e) {
    e.preventDefault();
    submitBadgeChange(e);
});

const timeDisplay = document.getElementById('currentTime');
if (timeDisplay) {
    setInterval(() => {
        const now = new Date();
        timeDisplay.textContent = now.toLocaleTimeString([], {         weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true });
    }, 1000);
}

function calculateRealtimeTotalHours() {
    const now = new Date();
    let totalRealTimeHours = 0;

    // Add completed hours from today's records (records that are TIMED_OUT, AUTO_TIMED_OUT, etc.)
    allAttendanceRecords.forEach(record => {
        if (record.status !== 'TIMED_IN' && record.totalHours) {
            totalRealTimeHours += parseFloat(record.totalHours);
        }
    });

    // Add current working time for each timed-in student
    activeStudentsData.forEach(student => {
        if (student.timeIn) {
            const timeInDate = new Date(student.timeIn);
            const workingMilliseconds = now - timeInDate;
            const workingHours = workingMilliseconds / (1000 * 60 * 60);

            // Add current working hours (this will be cumulative for all active students)
            totalRealTimeHours += Math.max(0, workingHours);
        }
    });

    return totalRealTimeHours;
}

function formatRealtimeHours(decimalHours) {
    const totalMinutes = Math.floor(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes}m`;
    } else if (minutes === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${minutes}m`;
    }
}

function updateRealtimeStats() {
    if (activeStudentsData.length > 0) {
        const realtimeTotal = calculateRealtimeTotalHours();
        document.getElementById('totalHoursToday').textContent = formatRealtimeHours(realtimeTotal);
    }
}

function startRealtimeUpdates() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
    }

    if (activeStudentsData.length > 0) {
        realtimeInterval = setInterval(updateRealtimeStats, 60000); // Update every minute for smoother performance
    }
}

function stopRealtimeUpdates() {
    if (realtimeInterval) {
        clearInterval(realtimeInterval);
        realtimeInterval = null;
    }
}

function formatHoursMinutes(decimalHours) {
    if (!decimalHours || decimalHours === 0) {
        return "0h";
    }

    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
        return `${minutes}m`;
    } else if (minutes === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${minutes}m`;
    }
}

document.getElementById('scheduleManagementForm').addEventListener('submit', function(e) {
    e.preventDefault();
    submitScheduleChange(e);
});

// Authentication check
function checkAuthentication() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAuthenticated = urlParams.get('authenticated');

    if (!isAuthenticated || isAuthenticated !== 'true') {
        showAlert('Unauthorized access. Redirecting to login...', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
        return false;
    }
    return true;
}

// Setup event listeners
function setupEventListeners() {
    // ID badge formatting
    const idInputs = ['studentIdBadge', 'reportStudentId', 'newBadgeId', 'checkBadgeInput'];
    idInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', function() {
                this.value = this.value.replace(/\D/g, '');
                if (this.value.length > 4) {
                    this.value = this.value.slice(0, 4);
                }

                // Auto-check badge availability
                if (inputId === 'checkBadgeInput' && this.value.length === 4) {
                    performBadgeCheck();
                } else if (inputId === 'checkBadgeInput' && this.value.length < 4) {
                    document.getElementById('badgeCheckResult').innerHTML = '';
                }

                // Auto-validate student badge
                if (inputId === 'studentIdBadge' || inputId === 'newBadgeId') {
                    let validation;
                    if (inputId === 'newBadgeId') {
                        validation = document.getElementById('newBadgeValidation');
                    } else {
                        validation = document.getElementById('badgeValidation');
                    }

                    if (this.value.length === 4) {
                        if (validation) {
                            performBadgeValidation(this.value, validation);
                        }
                    } else {
                        // Clear validation if input is erased or incomplete
                        if (validation) {
                            validation.innerHTML = '';
                        }
                    }
                }
            });
        }
    });

    // Form submissions
    document.getElementById('studentRegistrationForm').addEventListener('submit', function(e) {
        e.preventDefault();
        registerStudentWithHours(e);
    });

    document.getElementById('timeCorrectionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitTimeCorrection(e);
    });

    document.getElementById('badgeManagementForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitBadgeChange(e);
    });

    // Modal management forms
    ['badgeManagementForm', 'hoursManagementForm', 'statusManagementForm'].forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                if (formId === 'badgeManagementForm') submitBadgeChange(e);
                else if (formId === 'hoursManagementForm') submitHoursChange(e);
                else if (formId === 'statusManagementForm') submitStatusChange(e);
            });
        }
    });

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('show');
            document.body.style.overflow = '';
        }
    });

    // Close notification panel when clicking outside
    document.addEventListener('click', function(event) {
        const panel = document.getElementById('notificationPanel');
        const btn = document.getElementById('notificationBtn');

        if (panel.classList.contains('open') &&
            !panel.contains(event.target) &&
            !btn.contains(event.target)) {
            panel.classList.remove('open');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                modal.classList.remove('show');
                document.body.style.overflow = '';
            });

            const panel = document.getElementById('notificationPanel');
            if (panel.classList.contains('open')) {
                panel.classList.remove('open');
            }
        }

        if (event.ctrlKey && event.key === 'r') {
            event.preventDefault();
            loadTabData(currentTab);
            showAlert('Data refreshed', 'info');
        }
    });
}

// Set default dates
function setDefaultDates() {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayStr = today.toISOString().split('T')[0];
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];

    const dateInputs = [
        'filterDate', 'filterStartDate', 'filterEndDate',
        'reportStartDate', 'reportEndDate',
        'studentReportStart', 'studentReportEnd'
    ];

    dateInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            if (inputId.includes('Start') || inputId === 'filterStartDate') {
                input.value = firstOfMonthStr;
            } else {
                input.value = todayStr;
            }
        }
    });
}

// Initialize tabs
function initializeTabs() {
    document.getElementById('dashboard').style.display = 'block';

    const tabs = ['students', 'attendance', 'corrections', 'reports'];
    tabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.style.display = 'none';
        }
    });
}

// Load initial data
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
        showAlert('Failed to load initial data. Please refresh the page.', 'error');
    } finally {
        hideLoading();
    }
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');

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

    // Stop real-time updates when leaving dashboard
    if (tabName !== 'dashboard') {
        stopRealtimeUpdates();
    }

    loadTabData(tabName);
}

// Load tab-specific data
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
        }
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const [studentsResponse, todayRecordsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/students/all`),
            fetch(`${API_BASE_URL}/attendance/records?date=${formatDate(new Date())}`)
        ]);

        if (studentsResponse.ok) {
            const students = await studentsResponse.json();
            allStudents = students;
            document.getElementById('totalStudents').textContent = students.length;
        }

        if (todayRecordsResponse.ok) {
            const records = await todayRecordsResponse.json();
            allAttendanceRecords = records;

            // Filter for currently timed-in students
            activeStudentsData = records.filter(r => r.status === 'TIMED_IN');
            const timedInCount = activeStudentsData.length;

            // Calculate completed hours (excluding currently active students)
            const completedHours = records
                .filter(r => r.status !== 'TIMED_IN')
                .reduce((sum, r) => sum + (parseFloat(r.totalHours) || 0), 0);

            document.getElementById('timedInStudents').textContent = timedInCount;
            document.getElementById('todayRecords').textContent = records.length;

            // Start or stop real-time updates based on active students
            if (activeStudentsData.length > 0) {
                // Initial calculation with real-time hours
                const initialTotal = calculateRealtimeTotalHours();
                document.getElementById('totalHoursToday').textContent = formatRealtimeHours(initialTotal);
                startRealtimeUpdates();
            } else {
                stopRealtimeUpdates();
                document.getElementById('totalHoursToday').textContent = formatHoursMinutes(completedHours);
            }

            displayDashboardRecords(records);
        }

        await loadWeeklyChart();
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showAlert('Failed to load dashboard data', 'error');
    }
}

// Chart loading
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

// Create chart
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

        const dayRecords = records.filter(record => {
            const recordDate = formatDate(record.attendanceDate);
            return recordDate === dateStr;
        });

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
                        title: {
                            display: true,
                            text: 'Hours'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error('Failed to create chart:', error);
    }
}

// Display dashboard records
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

// Student Management Functions
async function registerStudentWithHours(event) {
    if (event) event.preventDefault();

    const idBadge = document.getElementById('studentIdBadge').value.trim();
    const fullName = document.getElementById('studentFullName').value.trim();
    const school = document.getElementById('studentSchool').value.trim();
    const requiredHours = document.getElementById('studentRequiredHours').value.trim();

    if (!idBadge || !fullName || !school || !requiredHours) {
        showAlert('Please fill in all fields', 'warning');
        return;
    }

    if (!/^\d{4}$/.test(idBadge)) {
        showAlert('ID badge must be exactly 4 digits', 'error');
        return;
    }

    const hoursNum = parseInt(requiredHours);
    if (hoursNum < 1 || hoursNum > 2000) {
        showAlert('Required hours must be between 1 and 2000', 'error');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/students/register-with-hours`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idBadge,
                fullName,
                school,
                requiredHours: hoursNum
            })
        });

        if (response.ok) {
            const data = await response.json();
            showAlert(`Student ${data.fullName} registered successfully with ${hoursNum} required hours!`, 'success');
            clearRegistrationForm();
            await loadAllStudents();
            await loadDashboard();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('Registration failed. Please check your connection.', 'error');
    } finally {
        hideLoading();
    }
}

function clearRegistrationForm() {
    document.getElementById('studentRegistrationForm').reset();
    document.getElementById('badgeCheckResult').innerHTML = '';
    document.getElementById('checkBadgeInput').value = '';
    const validation = document.getElementById('badgeValidation');
    if (validation) validation.innerHTML = '';
}

async function loadAllStudents() {
    try {
        const response = await fetch(`${API_BASE_URL}/students/all`);
        if (response.ok) {
            const students = await response.json();
            allStudents = students;
            studentsCache = students;
            await displayStudentsTable(students);
        } else {
            showAlert('Failed to load students', 'error');
        }
    } catch (error) {
        console.error('Failed to load students:', error);
        showAlert('Failed to load students', 'error');
    }
}

async function displayStudentsTable(students) {
    const tbody = document.getElementById('studentsBody');

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <h3>No students found</h3>
                    <p>Try adjusting your filters or register new students</p>
                </td>
            </tr>
        `;
        updateStudentStats([]);
        return;
    }

    // Get today's attendance records
    let todayRecords = [];
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/records?date=${formatDate(new Date())}`);
        if (response.ok) {
            todayRecords = await response.json();
        }
    } catch (error) {
        console.error('Failed to load today\'s records:', error);
    }

    tbody.innerHTML = students.map(student => {
        const studentRecord = todayRecords.find(record => record.idBadge === student.idBadge);

        const totalHours = parseFloat(student.totalAccumulatedHours || 0);
        const requiredHours = student.requiredHours ? parseFloat(student.requiredHours) : null;
        const hasRequiredHours = requiredHours !== null && requiredHours > 0;

        let progressDisplay = 'N/A';
        let requiredHoursDisplay = 'N/A';

        if (hasRequiredHours) {
            const progressPercentage = Math.min((totalHours / requiredHours) * 100, 100);
            const progressClass = progressPercentage >= 90 ? '9' : progressPercentage >= 80 ? '8' : progressPercentage >= 70 ? '7' :
            progressPercentage >= 60 ? '6' : progressPercentage >= 50 ? '5' : progressPercentage >= 40 ? '4' : progressPercentage >= 30 ? '3' :
            progressPercentage >= 20 ? '2' : progressPercentage >= 10 ? '1' : '0';

            progressDisplay = `
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill progress-fill-${progressClass}" style="width: ${progressPercentage.toFixed(1)}%;"></div>
                    </div>
                    <div class="progress-text">${progressPercentage.toFixed(1)}%</div>
                </div>
            `;
            requiredHoursDisplay = `<strong>${formatHoursMinutes(requiredHours)}</strong>`;
        }

        const attendanceStatus = determineStudentAttendanceStatus(studentRecord);
        const scheduleInfo = getScheduleInfo(student);

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
                    </div>
                </td>
                <td>${requiredHoursDisplay}</td>
                <td>${newFormatDate(student.registrationDate)}</td>
                <td class="actions-column">
                    <div class="student-actions">
                        <button class="btn btn-sm btn-info" onclick="viewStudentProgress('${student.idBadge}')" title="View Details">
                            View
                        </button>
                        ${student.status !== 'COMPLETED' ? `
                            <button class="btn btn-sm btn-warning" onclick="showBadgeModal(${student.id}, '${student.idBadge}', '${student.fullName}')" title="Change Badge">
                                Badge
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="showHoursModal(${student.id}, '${student.fullName}', ${requiredHours || 0})" title="Set Required Hours">
                                Hours
                            </button>
                            <button class="btn btn-sm btn-success" onclick="showScheduleModal(${student.id}, '${student.fullName}')" title="Manage Schedule">
                                Schedule
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="showStatusModal(${student.id}, '${student.fullName}', '${student.status || 'ACTIVE'}')" title="Change Status">
                                Status
                            </button>
                        ` : `
                            <button class="btn btn-sm btn-success" disabled title="Student Completed">
                                Completed
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateStudentStats(students);
    updateFilterCounts(students);
}

function getScheduleInfo(student) {
    if (!student.scheduleActive || !student.scheduledStartTime) {
        return null;
    }
    return `${student.scheduledStartTime} - ${student.scheduledEndTime}`;
}

async function showScheduleModal(studentId, studentName) {
    currentManagementStudent = { id: studentId, name: studentName };

    // Load current schedule
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

            // Pre-fill form
            document.getElementById('scheduleStartTime').value = schedule.startTime || '10:00';
            document.getElementById('scheduleEndTime').value = schedule.endTime || '19:00';
            document.getElementById('gracePeriodMinutes').value = schedule.gracePeriodMinutes || 5;
            document.getElementById('scheduleActive').value = schedule.active ? 'true' : 'false';
        } else {
            // Default values for new schedule
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
                startTime: startTime,
                endTime: endTime,
                gracePeriodMinutes: gracePeriod,
                active: active
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

function determineStudentAttendanceStatus(record) {
    if (!record) {
        return {
            label: 'Not Active Today',
            class: 'not-active'
        };
    }

    switch (record.status) {
        case 'TIMED_IN':
            return {
                label: 'Currently Active',
                class: 'timed-in'
            };
        case 'TIMED_OUT':
            return {
                label: 'Completed Today',
                class: 'timed-out'
            };
        case 'AUTO_TIMED_OUT':
            return {
                label: 'Auto Timed Out',
                class: 'auto-timed-out'
            };
        case 'ADMIN_CORRECTED':
            return {
                label: 'Admin Corrected',
                class: 'admin-corrected'
            };
        default:
            return {
                label: 'Status Unknown',
                class: 'unknown'
            };
    }
}

function updateStudentStats(students) {
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'ACTIVE').length;
    const completedStudents = students.filter(s => s.status === 'COMPLETED').length;

    const totalHours = students.reduce((sum, s) => sum + parseFloat(s.totalAccumulatedHours || 0), 0);

    const studentsWithHours = students.filter(s => s.requiredHours && s.requiredHours > 0);
    let averageProgress = 0;
    if (studentsWithHours.length > 0) {
        const totalProgress = studentsWithHours.reduce((sum, s) => {
            const progress = Math.min((parseFloat(s.totalAccumulatedHours || 0) / parseFloat(s.requiredHours)) * 100, 100);
            return sum + progress;
        }, 0);
        averageProgress = totalProgress / studentsWithHours.length;
    }

    document.getElementById('totalStudentsStat').textContent = totalStudents;
    document.getElementById('activeStudentsStat').textContent = activeStudents;
    document.getElementById('completedStudentsStat').textContent = completedStudents;
    document.getElementById('averageProgressStat').textContent = averageProgress.toFixed(1) + '%';
    document.getElementById('totalHoursStat').textContent = formatHoursMinutes(totalHours);
}

function updateFilterCounts(students) {
    const counts = {
        all: students.length,
        active: students.filter(s => s.status === 'ACTIVE').length,
        completed: students.filter(s => s.status === 'COMPLETED').length,
        nearCompletion: students.filter(s => {
            if (!s.requiredHours || s.status !== 'ACTIVE') return false;
            const progress = (parseFloat(s.totalAccumulatedHours || 0) / parseFloat(s.requiredHours)) * 100;
            return progress >= 90 && progress < 100;
        }).length,
        readyCompletion: students.filter(s => {
            if (!s.requiredHours || s.status !== 'ACTIVE') return false;
            const progress = (parseFloat(s.totalAccumulatedHours || 0) / parseFloat(s.requiredHours)) * 100;
            return progress >= 100;
        }).length
    };

    const countElements = ['allCount', 'activeCount', 'completedCount', 'nearCompletionCount', 'readyCompletionCount'];
    countElements.forEach((elementId, index) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = Object.values(counts)[index];
        }
    });
}

// Badge Management Functions
async function performBadgeCheck() {
    const badgeId = document.getElementById('checkBadgeInput').value.trim();
    const resultDiv = document.getElementById('badgeCheckResult');

    if (!badgeId) {
        resultDiv.innerHTML = '';
        return;
    }

    if (!/^\d{4}$/.test(badgeId)) {
        resultDiv.innerHTML = '<div class="validation-message unavailable">Badge must be exactly 4 digits</div>';
        return;
    }

    resultDiv.innerHTML = '<div class="validation-message checking">Checking availability...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/students/check-badge/${badgeId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.available) {
                resultDiv.innerHTML = `<div class="validation-message available">✓ Badge ${badgeId} is available!</div>`;
                document.getElementById('studentIdBadge').value = badgeId;
            } else {
                resultDiv.innerHTML = `<div class="validation-message unavailable">✗ ${data.message}</div>`;
            }
        } else {
            resultDiv.innerHTML = '<div class="validation-message unavailable">Error checking badge availability</div>';
        }
    } catch (error) {
        console.error('Badge check error:', error);
        resultDiv.innerHTML = '<div class="validation-message unavailable">Network error checking badge</div>';
    }
}

async function performBadgeValidation(badgeId, validationDiv) {
    try {
        const response = await fetch(`${API_BASE_URL}/students/check-badge/${badgeId}`);
        if (response.ok) {
            const data = await response.json();
            if (data.available) {
                validationDiv.innerHTML = '<div class="validation-message available">✓ Badge available</div>';
            } else {
                validationDiv.innerHTML = '<div class="validation-message unavailable">✗ Badge is not available</div>';
            }
        }
    } catch (error) {
        validationDiv.innerHTML = '<div class="validation-message checking">Checking...</div>';
    }
}

// Student Filtering and Sorting
function filterStudents() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filteredStudents = studentsCache.filter(student => {
        const matchesSearch = !searchTerm ||
            student.fullName.toLowerCase().includes(searchTerm) ||
            student.idBadge.toLowerCase().includes(searchTerm) ||
            (student.school && student.school.toLowerCase().includes(searchTerm));

        const matchesStatus = statusFilter === 'all' ||
            (student.status || 'ACTIVE').toLowerCase() === statusFilter;

        return matchesSearch && matchesStatus;
    });

    displayStudentsTable(filteredStudents);
}

function sortStudentsTable(column) {
    const th = document.querySelector(`th[onclick="sortStudentsTable('${column}')"]`);

    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
    });
    th.classList.add(currentSortDirection);

    const sortedStudents = [...studentsCache].sort((a, b) => {
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
            case 'registrationDate':
                aValue = new Date(a.registrationDate);
                bValue = new Date(b.registrationDate);
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

    displayStudentsTable(sortedStudents);
}

async function loadStudentsByStatus(statusFilter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-filter="${statusFilter}"]`).classList.add('active');

    showLoading();
    try {
        let students;
        switch (statusFilter) {
            case 'active':
                const activeResponse = await fetch(`${API_BASE_URL}/admin/students/active`);
                students = activeResponse.ok ? await activeResponse.json() : [];
                break;
            case 'completed':
                const completedResponse = await fetch(`${API_BASE_URL}/admin/students/completed`);
                students = completedResponse.ok ? await completedResponse.json() : [];
                break;
            case 'near-completion':
                const nearResponse = await fetch(`${API_BASE_URL}/admin/students/near-completion`);
                students = nearResponse.ok ? await nearResponse.json() : [];
                break;
            case 'ready-completion':
                const readyResponse = await fetch(`${API_BASE_URL}/admin/students/ready-for-completion`);
                students = readyResponse.ok ? await readyResponse.json() : [];
                break;
            default:
                const allResponse = await fetch(`${API_BASE_URL}/students/all`);
                students = allResponse.ok ? await allResponse.json() : [];
        }

        studentsCache = students;
        await displayStudentsTable(students);

        const filterLabel = statusFilter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        showAlert(`Loaded ${students.length} ${filterLabel.toLowerCase()} students`, 'info');
    } catch (error) {
        console.error('Failed to load students:', error);
        showAlert('Failed to load students', 'error');
    } finally {
        hideLoading();
    }
}

// Student Progress View
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
        const progressClass = progressPercentage >= 90 ? 'high' : progressPercentage >= 70 ? 'medium' : 'low';

        progressSection = `
            <div class="student-detail">
                <h4>Progress Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Progress</div>
                        <div class="detail-value">
                            <div class="progress-container" style="margin-bottom: 0.5rem;">
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
                                '<span class="status-badge" style="background: var(--success-color); color: white;">Ready to Complete</span>' :
                                '<span class="status-badge" style="background: var(--info-color); color: white;">In Progress</span>'
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
            <h4>Recent Attendance History</h4>
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
            <button class="btn btn-primary" onclick="generateStudentReport('${student.idBadge}')">Download Report</button>
            <button class="btn btn-secondary" onclick="closeModal('studentProgressModal')">Close</button>
        </div>
    `;

    showModal('studentProgressModal');
}

// Student Management Modal Functions
function showBadgeModal(studentId, currentBadge, studentName) {
    currentManagementStudent = { id: studentId, badge: currentBadge, name: studentName };

    document.getElementById('badgeStudentInfo').innerHTML = `
        <div class="student-detail">
            <h4>${studentName}</h4>
            <p><strong>Current Badge:</strong> ${currentBadge}</p>
        </div>
    `;

    document.getElementById('newBadgeId').value = '';
    // Clear validation when modal opens
    document.getElementById('newBadgeValidation').innerHTML = '';

    showModal('badgeManagementModal');
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

function showStatusModal(studentId, studentName, currentStatus) {
    currentManagementStudent = { id: studentId, name: studentName, status: currentStatus };

    document.getElementById('statusStudentInfo').innerHTML = `
        <div class="student-detail">
            <h4>${studentName}</h4>
            <p><strong>Current Status:</strong> <span class="status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span></p>
        </div>
    `;

    document.getElementById('newStudentStatus').value = currentStatus;

    const warningDiv = document.getElementById('completionWarning');
    const submitBtn = document.getElementById('statusSubmitBtn');

    document.getElementById('newStudentStatus').addEventListener('change', function() {
        if (this.value === 'COMPLETED') {
            warningDiv.classList.remove('d-none');
            submitBtn.textContent = 'Complete Student';
            submitBtn.className = 'btn btn-warning';
        } else {
            warningDiv.classList.add('d-none');
            submitBtn.textContent = 'Update Status';
            submitBtn.className = 'btn btn-primary';
        }
    });

    showModal('statusManagementModal');
}

// Modal Form Submissions
async function submitBadgeChange(event) {
    event.preventDefault();

    const newBadge = document.getElementById('newBadgeId').value.trim();

    if (!/^\d{4}$/.test(newBadge)) {
        showAlert('Badge must be exactly 4 digits', 'error');
        return;
    }

    showLoading();
    try {
        // Use the correct field name that matches your DTO
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/badge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newIdBadge: newBadge,  // Changed from badgeId to newIdBadge
                reason: "Badge updated via admin panel"  // Optional reason
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

// Separate function for the actual badge change API call
async function proceedWithBadgeChange(newBadge) {
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/badge`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ badgeId: newBadge })
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

async function submitStatusChange(event) {
    event.preventDefault();

    const newStatus = document.getElementById('newStudentStatus').value;

    if (!newStatus) {
        showAlert('Please select a status', 'error');
        return;
    }

    showLoading();
    try {
        let response;
        if (newStatus === 'COMPLETED') {
            response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            response = await fetch(`${API_BASE_URL}/admin/students/${currentManagementStudent.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
        }

        if (response.ok) {
            showAlert(`Student status changed to ${newStatus} successfully!`, 'success');
            closeModal('statusManagementModal');
            await loadAllStudents();
        } else {
            const errorData = await response.json();
            showAlert(errorData.message || 'Failed to update student status', 'error');
        }
    } catch (error) {
        showAlert('Failed to update student status', 'error');
    } finally {
        hideLoading();
    }
}

// Attendance Records Functions
async function filterByDate() {
    const date = document.getElementById('filterDate').value;
    if (!date) {
        showAlert('Please select a date', 'warning');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/records?date=${date}`);
        if (response.ok) {
            const records = await response.json();
            allAttendanceRecords = records;
            displayAttendanceRecords(records);
            showAlert(`Found ${records.length} records for ${formatDate(date)}`, 'info');
        } else {
            showAlert('Failed to load records', 'error');
        }
    } catch (error) {
        showAlert('Failed to load records', 'error');
    } finally {
        hideLoading();
    }
}

async function filterByDateRange() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;

    if (!startDate || !endDate) {
        showAlert('Please select both start and end dates', 'warning');
        return;
    }

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/records?startDate=${startDate}&endDate=${endDate}`);
        if (response.ok) {
            const records = await response.json();
            allAttendanceRecords = records;
            displayAttendanceRecords(records);
            showAlert(`Found ${records.length} records from ${formatDate(startDate)} to ${formatDate(endDate)}`, 'info');
        } else {
            showAlert('Failed to load records', 'error');
        }
    } catch (error) {
        showAlert('Failed to load records', 'error');
    } finally {
        hideLoading();
    }
}

function clearFilters() {
    const tbody = document.getElementById('attendanceBody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><h3>Use filters above to view attendance records</h3></td></tr>';
    allAttendanceRecords = [];
    showAlert('Filters cleared', 'info');
}

function displayAttendanceRecords(records) {
    const tbody = document.getElementById('attendanceBody');

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><h3>No records found for selected criteria</h3></td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => `
        <tr>
            <td>${formatDate(record.attendanceDate)}</td>
            <td><strong>${record.studentName || 'Unknown'}</strong></td>
            <td><span class="badge-number">${record.idBadge}</span></td>
            <td>${record.timeIn ? formatTime(record.timeIn) : '-'}</td>
            <td>${record.timeOut ? formatTime(record.timeOut) : '-'}</td>
            <td><strong>${record.totalHours || '0'}h</strong></td>
            <td><span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">${record.status?.replace('_', ' ') || 'Unknown'}</span></td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewAttendanceRecord(${record.id})">View Details</button>
            </td>
        </tr>
    `).join('');
}

function viewAttendanceRecord(recordId) {
    const record = allAttendanceRecords.find(r => r.id === recordId);
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
                    <div class="detail-value"><strong>${record.totalHours || '0'}h</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Regular Hours</div>
                    <div class="detail-value">${record.regularHours || '0'}h</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Overtime Hours</div>
                    <div class="detail-value">${record.overtimeHours || '0'}h</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Undertime Hours</div>
                    <div class="detail-value">${record.undertimeHours || '0'}h</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Break Deducted</div>
                    <div class="detail-value">${record.breakDeducted ? 'Yes (1 hour)' : 'No'}</div>
                </div>
            </div>
        </div>

        ${record.tasksCompleted ? `
            <div class="student-detail">
                <h4>Tasks Completed</h4>
                <div style="background: var(--bg-primary); padding: 1rem; border-radius: var(--border-radius-lg); border: 1px solid var(--border-color); white-space: pre-wrap; line-height: 1.5;">
                    ${record.tasksCompleted}
                </div>
            </div>
        ` : ''}

        <div class="modal-actions">
            ${(record.status === 'AUTO_TIMED_OUT' || record.status === 'INCOMPLETE') ?
                `<button class="btn btn-warning" onclick="correctTime(${record.id})">Correct Time</button>` : ''
            }
            <button class="btn btn-secondary" onclick="closeModal('attendanceViewModal')">Close</button>
        </div>
    `;

    showModal('attendanceViewModal');
}

// Time Corrections Functions
async function loadIncompleteRecords() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/incomplete`);
        if (response.ok) {
            const records = await response.json();
            displayIncompleteRecords(records);
        } else {
            showAlert('Failed to load incomplete records', 'error');
        }
    } catch (error) {
        console.error('Failed to load incomplete records:', error);
        showAlert('Failed to load incomplete records', 'error');
    }
}

function displayIncompleteRecords(records) {
    const container = document.getElementById('correctionsList');

    if (records.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No records requiring correction</h3>
                <p>All attendance records are complete</p>
            </div>
        `;
        return;
    }

    container.innerHTML = records.map(record => `
        <div class="card" style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                <div>
                    <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">${record.studentName} (<span class="badge-number">${record.idBadge}</span>)</h4>
                    <p><strong>Date:</strong> ${formatDate(record.attendanceDate)}</p>
                    <p><strong>Time In:</strong> ${formatTime(record.timeIn)}</p>
                    <p><strong>Current Status:</strong> <span class="status-badge status-${record.status?.toLowerCase().replace('_', '-')}">${record.status?.replace('_', ' ') || 'Unknown'}</span></p>
                    <p><strong>Hours Worked:</strong> ${formatHoursMinutes(parseFloat(calculateElapsedHours(record.timeIn)))} (estimated)</p>
                </div>
                <button class="btn btn-warning" onclick="correctTime(${record.id})">Correct Time</button>
            </div>
        </div>
    `).join('');
}

async function correctTime(recordId) {
    try {
        let record = allAttendanceRecords.find(r => r.id === recordId);

        if (!record) {
            const response = await fetch(`${API_BASE_URL}/attendance/records?startDate=2024-01-01&endDate=${formatDate(new Date())}`);
            if (response.ok) {
                const records = await response.json();
                record = records.find(r => r.id === recordId);
            }
        }

        if (record) {
            currentCorrectionRecord = record;

            const statusText = record.status === 'AUTO_TIMED_OUT' ?
                'AUTO TIMED OUT (System automatically timed out after 16 hours)' :
                record.status;

            document.getElementById('correctionDetails').innerHTML = `
                <div class="alert alert-info">
                    <div><strong>Student:</strong> ${record.studentName} (<span class="badge-number">${record.idBadge}</span>)</div>
                    <div><strong>Date:</strong> ${formatDate(record.attendanceDate)}</div>
                    <div><strong>Time In:</strong> ${formatTime(record.timeIn)}</div>
                    <div><strong>Status:</strong> ${statusText}</div>
                    <div><strong>Current Hours:</strong> ${formatHoursMinutes(parseFloat(calculateElapsedHours(record.timeIn)))}</div>
                    ${record.status === 'AUTO_TIMED_OUT' ?
                        '<div style="color: var(--warning-color); font-weight: 600;">⚠️ This record was automatically processed by the system</div>' :
                        ''
                    }
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

    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/admin/attendance/correct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attendanceRecordId: currentCorrectionRecord.id,
                correctedHours: correctedHours,
                correctionReason: correctionReason
            })
        });

        if (response.ok) {
            showAlert('Time correction applied successfully!', 'success');
            closeModal('timeCorrectionModal');
            document.getElementById('timeCorrectionForm').reset();
            currentCorrectionRecord = null;
            await loadIncompleteRecords();
            await loadNotifications();
            await loadDashboard();
        } else {
            const data = await response.json();
            showAlert(data.message || 'Correction failed', 'error');
        }
    } catch (error) {
        showAlert('Correction failed. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Notification Functions
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
    const badge = document.getElementById('notificationBadge');
    if (count > 0) {
        badge.textContent = count;
        badge.classList.add('show');
    } else {
        badge.classList.remove('show');
    }
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel.classList.toggle('open');

    if (panel.classList.contains('open')) {
        displayNotifications();
    }
}

async function displayNotifications() {
    const content = document.getElementById('notificationContent');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/notifications`);
        if (response.ok) {
            const notifications = await response.json();

            if (notifications.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <h3>No notifications</h3>
                        <p>All caught up!</p>
                    </div>
                `;
                return;
            }

            content.innerHTML = notifications.map(notification => `
                <div class="notification-item ${notification.isRead ? 'read' : 'unread'}" onclick="markNotificationRead(${notification.id})">
                    <div class="notification-meta">
                        <div class="notification-type">${notification.notificationType.replace('_', ' ')}</div>
                        <div class="notification-time">${formatTimeAgo(notification.createdAt)}</div>
                    </div>
                    <div class="notification-message">${notification.message}</div>
                    ${!notification.isRead ? '<div style="margin-top: 0.5rem;"><button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); markNotificationRead(' + notification.id + ');">Mark as Read</button></div>' : ''}
                </div>
            `).join('');
        } else {
            content.innerHTML = '<div class="empty-state"><h3>Failed to load notifications</h3></div>';
        }
    } catch (error) {
        content.innerHTML = '<div class="empty-state"><h3>Failed to load notifications</h3></div>';
    }
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

// Schedule Management Tab Functions
async function loadScheduleOverview() {
    try {
        const data = await getBulkScheduleData();
        if (data) {
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

async function getBulkScheduleData() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/schedules/summary`);
        if (response.ok) {
            const data = await response.json();
            // Map the backend response to match your frontend expectations
            return {
                studentsWithSchedules: data.studentsWithSchedule || 0,
                studentsWithoutSchedules: data.studentsWithoutSchedule || 0,
                activeSchedules: data.studentsWithSchedule || 0,
                totalStudents: data.totalStudents || 0,
                complianceRate: data.studentsWithSchedule ?
                    Math.round((data.studentsWithSchedule / data.totalStudents) * 100) : 0,
                scheduleFrequency: data.scheduleFrequency || {}
            };
        }
        return null;
    } catch (error) {
        console.error('Failed to load schedule summary:', error);
        return null;
    }
}

async function getLateArrivals() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/late-arrivals`);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Failed to load late arrivals:', error);
        return [];
    }
}

async function getScheduleViolations() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/students/schedule-violations`);
        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error('Failed to load schedule violations:', error);
        return [];
    }
}

async function setBulkSchedule(scheduleData) {
    try {
        // First, get the student IDs based on the target
        let studentIds = [];

        switch (scheduleData.target) {
            case 'all-active':
                const activeResponse = await fetch(`${API_BASE_URL}/admin/students/active`);
                if (activeResponse.ok) {
                    const activeStudents = await activeResponse.json();
                    studentIds = activeStudents.map(student => student.id);
                }
                break;

            case 'no-schedule':
                // Get all students and filter those without schedules
                const allResponse = await fetch(`${API_BASE_URL}/students/all`);
                if (allResponse.ok) {
                    const allStudents = await allResponse.json();
                    // Filter students without active schedules (you'll need to check this logic)
                    studentIds = allStudents
                        .filter(student => !student.scheduleActive || !student.scheduledStartTime)
                        .map(student => student.id);
                }
                break;

            case 'selected':
                // For now, this will apply to all active students
                // You can enhance this later with checkboxes for selection
                const selectedResponse = await fetch(`${API_BASE_URL}/admin/students/active`);
                if (selectedResponse.ok) {
                    const selectedStudents = await selectedResponse.json();
                    studentIds = selectedStudents.map(student => student.id);
                }
                break;
        }

        if (studentIds.length === 0) {
            throw new Error('No students found for the selected target');
        }

        // Create the bulk request that matches your backend DTO
        const bulkRequest = {
            studentIds: studentIds,
            startTime: scheduleData.startTime,
            endTime: scheduleData.endTime,
            gracePeriodMinutes: scheduleData.gracePeriodMinutes,
            active: scheduleData.active
        };

        const response = await fetch(`${API_BASE_URL}/admin/students/bulk-schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bulkRequest)
        });

        if (response.ok) {
            return await response.json();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to set bulk schedule');
        }
    } catch (error) {
        console.error('Failed to set bulk schedule:', error);
        throw error;
    }
}

function displayScheduleOverview(data) {
    const content = document.getElementById('scheduleOverviewContent');
    content.innerHTML = `
        <div class="stats-row">
            <div class="stat-item">
                <div class="stat-label">Students with Schedules</div>
                <div class="stat-value text-success">${data.studentsWithSchedules || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Students without Schedules</div>
                <div class="stat-value text-warning">${data.studentsWithoutSchedules || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Active Schedules</div>
                <div class="stat-value text-info">${data.activeSchedules || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Today's Compliance Rate</div>
                <div class="stat-value text-primary">${data.complianceRate || 0}%</div>
            </div>
        </div>
    `;
}

async function loadLateArrivals() {
    try {
        const lateArrivals = await getLateArrivals();
        displayLateArrivals(lateArrivals);
    } catch (error) {
        showAlert('Failed to load late arrivals', 'error');
    }
}

function displayLateArrivals(arrivals) {
    const tbody = document.getElementById('lateArrivalsBody');

    if (arrivals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><h3>No late arrivals today</h3></td></tr>';
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

async function loadScheduleViolations() {
    try {
        const violations = await getScheduleViolations();
        displayScheduleViolations(violations);
    } catch (error) {
        showAlert('Failed to load schedule violations', 'error');
    }
}

function displayScheduleViolations(violations) {
    const tbody = document.getElementById('violationsBody');

    if (violations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><h3>No schedule violations found</h3></td></tr>';
        return;
    }

    tbody.innerHTML = violations.map(violation => `
        <tr>
            <td><strong>${violation.studentName}</strong></td>
            <td><span class="badge-number">${violation.idBadge}</span></td>
            <td>${formatDate(new Date())}</td>
            <td><span class="status-badge status-${violation.violationType.toLowerCase().replace('_', '-')}">${violation.violationType.replace('_', ' ')}</span></td>
            <td>${violation.description || 'No details available'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewStudentProgress('${violation.idBadge}')">View Student</button>
            </td>
        </tr>
    `).join('');
}

async function submitBulkSchedule(event) {
    event.preventDefault();

    const startTime = document.getElementById('bulkStartTime').value;
    const endTime = document.getElementById('bulkEndTime').value;
    const gracePeriod = parseInt(document.getElementById('bulkGracePeriod').value);
    const target = document.getElementById('bulkScheduleTarget').value;

    if (!startTime || !endTime) {
        showAlert('Please set both start and end times', 'error');
        return;
    }

    if (startTime >= endTime) {
        showAlert('Start time must be before end time', 'error');
        return;
    }

    const confirmed = confirm(`Are you sure you want to apply this schedule to ${target.replace('-', ' ')} students?`);
    if (!confirmed) return;

    showLoading();
    try {
        const scheduleData = {
            startTime: startTime,
            endTime: endTime,
            gracePeriodMinutes: gracePeriod,
            target: target,
            active: true
        };

        const result = await setBulkSchedule(scheduleData);
        showAlert(`Schedule applied to ${result.updatedCount || 0} students successfully!`, 'success');
        await loadScheduleOverview();
        await loadAllStudents();
    } catch (error) {
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
}

// Report Functions
async function generateStudentReport(idBadge) {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = formatDate(firstOfMonth);
    const endDate = formatDate(today);

    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/reports/student/${idBadge}/csv?startDate=${startDate}&endDate=${endDate}`);

        if (response.ok) {
            const blob = await response.blob();
            downloadFile(blob, `student-${idBadge}-report-${startDate}-${endDate}.csv`);
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

// Utility Functions
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

function newFormatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
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

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; margin-left: auto; padding: 0 0.5rem;">×</button>
    `;

    alertContainer.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function formatTimeOnly(timeValue) {
    if (!timeValue) return 'N/A';

    // Handle different time formats
    try {
        // If it's already a time string like "10:30:00" or "10:30"
        if (typeof timeValue === 'string') {
        // Remove seconds if present and convert to 12-hour format
        const timeParts = timeValue.split(':');
        if (timeParts.length >= 2) {
            let hours = parseInt(timeParts[0]);
            const minutes = timeParts[1].padStart(2, '0');

            // Convert to 12-hour format
            const period = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 should be 12

            return `${hours}:${minutes} ${period}`;
        }
        return timeValue;
        }

        // If it's a Date object, extract time in 12-hour format
        if (timeValue instanceof Date) {
        return timeValue.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        }

        // If it's an array (some APIs return time as [hour, minute, second])
        if (Array.isArray(timeValue) && timeValue.length >= 2) {
        let hours = parseInt(timeValue[0]);
        const minutes = timeValue[1].toString().padStart(2, '0');

        // Convert to 12-hour format
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12

        return `${hours}:${minutes} ${period}`;
        }

        return 'Invalid Time';
    } catch (error) {
        console.error('Error formatting time:', timeValue, error);
        return 'Invalid Time';
    }
}

function showLoading() {
    document.getElementById('loading').classList.add('show');
}

function hideLoading() {
    document.getElementById('loading').classList.remove('show');
}

function startPeriodicRefresh() {
    // Refresh dashboard data every 30 seconds (but keep real-time counter running)
    setInterval(() => {
        if (currentTab === 'dashboard') {
            loadDashboard();
        }
    }, 30000);

    // Check for new notifications every 60 seconds
    setInterval(() => {
        loadNotifications();
    }, 60000);

    // Refresh student statuses every 2 minutes
    setInterval(() => {
        if (currentTab === 'students') {
            loadAllStudents();
        }
    }, 120000);
}

// Update all hours displays
function updateAllHoursDisplays() {
    document.querySelectorAll('.hours-value, [id$="Hours"], [id$="HoursToday"]').forEach(element => {
        const text = element.textContent;
        const match = text.match(/(\d+(?:\.\d+)?)h?/);
        if (match) {
            const hours = parseFloat(match[1]);
            element.textContent = text.replace(match[0], formatHoursMinutes(hours));
        }
    });
}

console.log('Enhanced OJT Attendance Admin Panel Loaded Successfully');