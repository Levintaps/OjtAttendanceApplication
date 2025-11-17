// Configuration
const API_BASE_URL = 'http://localhost:8080/api';
const STANDARD_WORK_HOURS = 8;

// Global variables
let currentStudentData = null;
let pendingTimeOut = false;
let lastAttendanceAction = null;
let actionCooldown = false;
let todayHoursInterval = null;
let currentTimeInTimestamp = null;
let isTaskLoggingEnabled = false;
let addTaskButton = null;
let taskCountInterval = null;
let totpSetupInProgress = false;
let currentTotpStudent = null;

// DOM Elements
const elements = {
    idBadge: () => document.getElementById('idBadge'),
    currentTime: () => document.getElementById('currentTime'),
    alertContainer: () => document.getElementById('alertContainer'),
    currentStatusDisplay: () => document.getElementById('currentStatusDisplay'),
    currentStatusText: () => document.getElementById('currentStatusText'),
    currentStatusTime: () => document.getElementById('currentStatusTime'),
    timeInBtn: () => document.getElementById('timeInBtn'),
    timeOutBtn: () => document.getElementById('timeOutBtn'),
    validationWarning: () => document.getElementById('validationWarning'),
    loading: () => document.getElementById('loading'),
    dashboardCard: () => document.getElementById('dashboardModal'),
    registerModal: () => document.getElementById('registerModal'),
    taskModal: () => document.getElementById('taskModal'),
    adminModal: () => document.getElementById('adminModal'),
};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    elements.idBadge().focus();
    setupEventListeners();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    updateButtonStates();
}

// Event Listeners Setup
function setupEventListeners() {
    setupIdInputListeners();
    setupFormListeners();
    setupModalListeners();
}

function clearEarlyArrivalState() {
    earlyArrivalData = null;
    hideScheduleInfo();
}

function setupIdInputListeners() {
    const idInput = elements.idBadge();

    idInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
        if (this.value.length > 4) {
            this.value = this.value.slice(0, 4);
        }
        hideValidationWarning();

        clearEarlyArrivalState();

        if (this.value.length === 4) {
            checkStudentStatus(this.value);
        } else {
            resetButtonStates();
            hideDashboard();
        }
    });

    idInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleEnterKey();
        }
    });

    const regIdBadge = document.getElementById('regIdBadge');
    if (regIdBadge) {
        regIdBadge.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
            if (this.value.length > 4) {
                this.value = this.value.slice(0, 4);
            }
        });
    }
}

function setupFormListeners() {
    document.getElementById('taskForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitTimeOut();
    });

    document.getElementById('adminForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitAdminAccess();
    });

    document.getElementById('registerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitRegistration();
    });

    document.getElementById('addTaskForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitTask(e);
    });
}

function setupModalListeners() {
    document.addEventListener('click', function(event) {
        const modals = ['taskModal', 'adminModal', 'registerModal', 'addTaskModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && event.target === modal) {
                modal.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// Help Guide Functions
function showHelpGuide() {
    const modal = document.getElementById('helpGuideModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeHelpGuide() {
    const modal = document.getElementById('helpGuideModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Add click outside to close for help guide modal
document.addEventListener('click', function(event) {
    const helpModal = document.getElementById('helpGuideModal');
    const dashboardModal = document.getElementById('dashboardModal');

    // Check if help modal is open and click is outside modal-content
    if (helpModal &&
        helpModal.classList.contains('show') &&
        event.target === helpModal) {
        closeHelpGuide();
    }

    if (dashboardModal &&
        dashboardModal.classList.contains('show') &&
        event.target === dashboardModal) {
        closeDashboardModal();
    }
});

// Time and Status Management
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    elements.currentTime().textContent = timeString;
}

async function checkStudentStatus(idBadge) {
    if (!isValidIdBadge(idBadge)) {
        resetButtonStates();
        return;
    }

    earlyArrivalData = null;
    hideScheduleInfo();

    try {
        // First check TOTP status
        const totpResponse = await fetch(`${API_BASE_URL}/totp/status/${idBadge}`);

        if (!totpResponse.ok) {
            if (totpResponse.status === 404) {
                showRegisterPrompt(idBadge);
                resetButtonStates();
                return;
            }
            throw new Error('Unable to verify student status');
        }

        const totpData = await totpResponse.json();

        // If TOTP requires setup, show setup flow
        if (totpData.requiresSetup || !totpData.totpEnabled) {
            await showTotpSetup(idBadge, totpData);
            return;
        }


        try {
            const sessionResponse = await fetch(`${API_BASE_URL}/attendance/session/${idBadge}`);
            if (sessionResponse.ok) {
                // Has active session - show time out button
                const sessionData = await sessionResponse.json();
                const dashboardData = {
                    currentStatus: 'TIMED_IN',
                    attendanceHistory: [{
                        timeIn: sessionData.timeIn,
                        timeOut: null,
                        status: 'TIMED_IN'
                    }],
                    todayTasksCount: sessionData.tasksLoggedCount
                };
                currentStudentData = dashboardData;
                await updateButtonStates(dashboardData);
                return;
            }
        } catch (sessionError) {
            // No active session, continue to dashboard check
            console.log('No active session found, checking dashboard');
        }

        // No active session - get dashboard data
        const dashboardResponse = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
        if (!dashboardResponse.ok) {
            throw new Error('Unable to verify student status');
        }

        const studentData = await dashboardResponse.json();
        currentStudentData = studentData;
        await updateButtonStates(studentData);

    } catch (error) {
        console.error('Failed to check student status:', error);
        resetButtonStates();
    }
}

async function showTotpSetup(idBadge, totpData) {
    try {
        showLoading();

        // Generate TOTP secret and QR code
        const setupResponse = await fetch(`${API_BASE_URL}/totp/setup/${idBadge}`, {
            method: 'POST'
        });

        if (!setupResponse.ok) {
            throw new Error('Failed to generate TOTP setup');
        }

        const setupData = await setupResponse.json();

        hideLoading();
        displayTotpSetupModal(setupData);

    } catch (error) {
        hideLoading();
        showAlert('Failed to setup authentication: ' + error.message, 'error');
    }
}

function displayTotpSetupModal(setupData) {
    const modal = document.getElementById('totpSetupModal') || createTotpSetupModal();

    const qrImage = modal.querySelector('#totpQrCode');
    const secretText = modal.querySelector('#totpSecretText');

    qrImage.src = setupData.qrCodeDataUrl;
    secretText.textContent = setupData.secret;

    currentTotpStudent = setupData;
    totpSetupInProgress = true;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    modal.querySelector('#totpVerifyCode').focus();
}

function createTotpSetupModal() {
    const modal = document.createElement('div');
    modal.id = 'totpSetupModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <button class="modal-close" onclick="closeTotpSetupModal()">×</button>
            <div class="modal-header">
                <h3>🔒 Security Setup Required</h3>
                <p>Set up Google Authenticator for secure attendance</p>
            </div>
            <div class="totp-setup-content" style="padding: 0 1rem;">
                <div class="totp-instructions" style="background: var(--bg-secondary); padding: 1.5rem; border-radius: var(--border-radius-lg); margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem; color: var(--text-primary);">Setup Instructions:</h4>
                    <ol style="margin-left: 1.5rem; line-height: 1.8; color: var(--text-secondary);">
                        <li>Install <strong>Google Authenticator</strong> app on your phone</li>
                        <li>Open the app and tap <strong>"+"</strong> or <strong>"Add account"</strong></li>
                        <li>Select <strong>"Scan QR code"</strong></li>
                        <li>Scan the QR code below</li>
                        <li>Enter the 6-digit code shown in the app</li>
                    </ol>
                </div>

                <div class="qr-code-container" style="text-align: center; margin: 2rem 0;">
                    <div style="background: white; padding: 2rem; border-radius: var(--border-radius-lg); display: inline-block; box-shadow: var(--shadow-md);">
                        <img id="totpQrCode" src="" alt="QR Code" style="width: 250px; height: 250px; display: block;">
                    </div>
                    <div style="margin-top: 1rem;">
                        <p style="font-size: 0.85rem; color: var(--text-muted);">Manual entry code:</p>
                        <code id="totpSecretText" style="background: var(--bg-tertiary); padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.9rem; display: inline-block; margin-top: 0.5rem;"></code>
                    </div>
                </div>

                <form id="totpVerifyForm" onsubmit="verifyTotpSetup(event)">
                    <div class="form-group">
                        <label for="totpVerifyCode">Enter 6-digit code from your app:</label>
                        <input type="text" id="totpVerifyCode" maxlength="6" placeholder="000000"
                            style="text-align: center; font-size: 1.5rem; letter-spacing: 0.5em; font-weight: 700;" required>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeTotpSetupModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary" id="verifyTotpBtn">Verify & Complete Setup</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const codeInput = modal.querySelector('#totpVerifyCode');
    codeInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });

    return modal;
}

async function verifyTotpSetup(event) {
    event.preventDefault();

    const totpCode = document.getElementById('totpVerifyCode').value.trim();

    if (totpCode.length !== 6) {
        showAlert('Please enter a valid 6-digit code', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/totp/verify/${currentTotpStudent.idBadge}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ totpCode: totpCode })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            hideLoading();
            closeTotpSetupModal();
            showAlert('Authentication setup complete! You can now log attendance.', 'success');

            setTimeout(() => {
                checkStudentStatus(currentTotpStudent.idBadge);
            }, 500);
        } else {
            hideLoading();
            showAlert(data.message || 'Invalid code. Please try again.', 'error');
            document.getElementById('totpVerifyCode').value = '';
            document.getElementById('totpVerifyCode').focus();
        }

    } catch (error) {
        hideLoading();
        showAlert('Verification failed: ' + error.message, 'error');
    }
}

function closeTotpSetupModal() {
    const modal = document.getElementById('totpSetupModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        document.getElementById('totpVerifyForm').reset();
        totpSetupInProgress = false;
        currentTotpStudent = null;

        document.getElementById('idBadge').value = '';
        resetButtonStates();
    }
}

async function updateButtonStates(studentData = null) {
    const statusDisplay = elements.currentStatusDisplay();
    const statusText = elements.currentStatusText();
    const statusTime = elements.currentStatusTime();
    const timeInBtn = elements.timeInBtn();
    const timeOutBtn = elements.timeOutBtn();

    if (addTaskButton) {
        addTaskButton.remove();
        addTaskButton = null;
    }

    if (!studentData) {
        statusDisplay.classList.add('d-none');
        timeInBtn.style.display = 'none';
        timeOutBtn.style.display = 'none';
        isTaskLoggingEnabled = false;
        hideScheduleInfo();
        return;
    }

    statusDisplay.classList.remove('d-none');
    statusDisplay.style.background = '';
    statusDisplay.style.border = '';

    if (studentData && studentData.currentStatus === 'TIMED_IN') {
        await checkEarlyArrival(studentData);
    } else {
        hideScheduleInfo();
    }

    if (studentData.currentStatus === 'TIMED_IN') {
        statusText.textContent = 'On Duty';
        statusText.style.color = 'var(--success-color)';

        const activeRecord = studentData.attendanceHistory?.find(record => record.timeIn && !record.timeOut);
        if (activeRecord) {
            currentTimeInTimestamp = new Date(activeRecord.timeIn);
            statusTime.textContent = `Since: ${formatTime(activeRecord.timeIn)}`;
            startTodayHoursTimer();
        }

        timeInBtn.style.display = 'none';
        timeOutBtn.style.display = 'flex';

        const idBadge = elements.idBadge().value.trim();
        if (idBadge) {
            try {
                const taskStatus = await checkCanLogTasks(idBadge);
                if (taskStatus.canLogTasks) {
                    isTaskLoggingEnabled = true;
                    createAddTaskButton();
                }
            } catch (error) {
                console.error('Error checking task logging:', error);
            }
        }
    }

    else {
        stopTodayHoursTimer();

        // Get today's completed session
        const today = new Date().toDateString();
        const todayRecord = studentData.attendanceHistory?.find(record => {
            const recordDate = new Date(record.attendanceDate).toDateString();
            return recordDate === today && record.timeOut != null;
        });

        const totalHours = parseFloat(studentData.totalAccumulatedHours || 0);
        const requiredHours = studentData.requiredHours || 0;
        const hasRequiredHours = requiredHours > 0;

        if (todayRecord && todayRecord.timeOut) {
            const timeOutDate = new Date(todayRecord.timeOut);
            const now = new Date();
            const hoursSinceTimeOut = (now - timeOutDate) / (1000 * 60 * 60);

            if (hoursSinceTimeOut < 4) {
                statusText.textContent = 'Session Complete';
                statusText.style.color = 'var(--info-color)';

                const hoursWorked = parseFloat(todayRecord.totalHours || 0);
                const timeOutTime = formatTime(todayRecord.timeOut);

                statusTime.innerHTML = `
                    <span style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                        <span style="font-weight: 600; color: var(--success-color);">
                            ✓ Completed ${hoursWorked.toFixed(0)} hours today
                        </span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">
                            Timed out at ${timeOutTime}
                        </span>
                    </span>
                `;
            } else {
                showReadyStatus(hasRequiredHours, totalHours, requiredHours, studentData);
            }
        }

        else {
            showReadyStatus(hasRequiredHours, totalHours, requiredHours, studentData);
        }

        timeInBtn.style.display = 'flex';
        timeOutBtn.style.display = 'none';
        isTaskLoggingEnabled = false;
    }
}

function showReadyStatus(hasRequiredHours, totalHours, requiredHours, studentData) {
    const statusText = elements.currentStatusText();
    const statusTime = elements.currentStatusTime();

    // Check if student has completed their hours
    if (hasRequiredHours && totalHours >= requiredHours) {
        statusText.textContent = '🎉 OJT Hours Complete!';
        statusText.style.color = 'var(--success-color)';

        statusTime.innerHTML = `
            <span style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <span style="font-weight: 600; color: var(--success-color);">
                    Congratulations! You've completed all required hours.
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                    ${totalHours.toFixed(0)}h / ${requiredHours.toFixed(0)}h (100%)
                </span>
            </span>
        `;
    }
    // Show progress towards completion
    else if (hasRequiredHours && totalHours < requiredHours) {
        statusText.textContent = 'Ready for Next Session';
        statusText.style.color = 'var(--text-primary)';

        const remainingHours = requiredHours - totalHours;
        const estimate = calculateEstimatedDaysAndHours(remainingHours, studentData);
        const completionPercent = ((totalHours / requiredHours) * 100).toFixed(0);

        statusTime.innerHTML = `
            <span style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <span style="font-weight: 600; color: var(--primary-color);">
                    📊 ${completionPercent}% Complete
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                    ${remainingHours.toFixed(0)}h remaining • Est. ${estimate.formatted} to complete
                </span>
            </span>
        `;
    }
    // No required hours set
    else {
        statusText.textContent = 'Ready to Time In';
        statusText.style.color = 'var(--text-primary)';

        statusTime.innerHTML = `
            <span style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <span style="font-weight: 500;">Start tracking your hours</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                    Total accumulated: ${totalHours.toFixed(0)}h
                </span>
            </span>
        `;
    }
}

function createDashboardTabs(studentData) {
    const dynamicMetric = document.getElementById('dynamicMetric');

    if (!dynamicMetric) return;

    const totalHoursValue = parseFloat(studentData.totalAccumulatedHours || 0);
    const requiredHoursValue = studentData.requiredHours ? parseFloat(studentData.requiredHours) : 0;
    const hasRequiredHours = requiredHoursValue > 0;
    const remainingHours = hasRequiredHours ? requiredHoursValue - totalHoursValue : 0;
    const estimatedDays = hasRequiredHours ? calculateEstimatedDays(remainingHours, studentData) : 0;
    const taskCount = studentData.todayTasksCount || 0;

    const tabsHTML = `
        <div class="dashboard-tabs">
            <div class="tab-buttons">
                <button class="tab-btn active" data-tab="tasks">
                    <span class="tab-icon">📋</span>
                    <span class="tab-label">Tasks</span>
                </button>
                <button class="tab-btn" data-tab="days">
                    <span class="tab-icon">📅</span>
                    <span class="tab-label">Days Left</span>
                </button>
            </div>
            <div class="tab-content">
                <div class="tab-pane active" id="tab-tasks">
                    <div class="label">Total Tasks Today</div>
                    <div class="value" id="dynamicValue">${taskCount}</div>
                </div>
                <div class="tab-pane" id="tab-days">
                    <div class="label">Days to Complete</div>
                    <div class="value" id="daysValue">
                        ${hasRequiredHours && totalHoursValue < requiredHoursValue
                            ? (() => {
                                const remainingHours = requiredHoursValue - totalHoursValue;
                                const estimate = calculateEstimatedDaysAndHours(remainingHours, studentData);
                                return `<span style="display: flex; flex-direction: column; gap: 0.25rem;">
                                    <span style="font-size: 1.4rem;">${estimate.formatted}</span>
                                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                                        ${remainingHours.toFixed(0)}h remaining
                                    </span>
                                </span>`;
                            })()
                            : hasRequiredHours
                                ? '<span style="color: var(--success-color);">Complete! ✓</span>'
                                : 'Not Set'}
                    </div>
                </div>
            </div>
        </div>
    `;

    dynamicMetric.innerHTML = tabsHTML;

    // Add tab switching functionality
    const tabButtons = dynamicMetric.querySelectorAll('.tab-btn');
    const tabPanes = dynamicMetric.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });
}

function calculateEstimatedDaysAndHours(remainingHours) {
    if (remainingHours <= 0) {
        return { days: 0, hours: 0, formatted: 'Complete!' };
    }

    const HOURS_PER_DAY = 8;
    const fullDays = Math.floor(remainingHours / HOURS_PER_DAY);
    const remainingHoursAfterDays = remainingHours - (fullDays * HOURS_PER_DAY);
    const roundedHours = Math.floor(remainingHoursAfterDays * 2) / 2;

    let formatted = '';
    if (fullDays > 0 && roundedHours > 0) {
        formatted = `${fullDays}d ${roundedHours}h`;
    } else if (fullDays > 0) {
        formatted = `${fullDays} day${fullDays !== 1 ? 's' : ''}`;
    } else if (roundedHours > 0) {
        formatted = `${roundedHours}h`;
    } else {
        formatted = '< 1h';
    }

    return {
        days: fullDays,
        hours: roundedHours,
        formatted: formatted,
        totalDays: fullDays + (roundedHours > 0 ? 1 : 0)
    };
}

function calculateEstimatedDays(remainingHours, studentData) {
    const result = calculateEstimatedDaysAndHours(remainingHours, studentData);
    return result.totalDays;
}

function createAddTaskButton() {
    if (addTaskButton) return;

    const actionButtons = document.querySelector('.action-buttons');
    if (!actionButtons) return;

    addTaskButton = document.createElement('button');
    addTaskButton.className = 'btn btn-secondary add-task-btn';
    addTaskButton.innerHTML = '➕ Add Task';
    addTaskButton.onclick = addTask;

    const timeOutBtn = elements.timeOutBtn();
    if (timeOutBtn && actionButtons.contains(timeOutBtn)) {
        actionButtons.insertBefore(addTaskButton, timeOutBtn.nextSibling);
    } else {
        actionButtons.appendChild(addTaskButton);
    }
}

function resetButtonStates() {
    const statusDisplay = elements.currentStatusDisplay();
    const timeInBtn = elements.timeInBtn();
    const timeOutBtn = elements.timeOutBtn();

    statusDisplay.classList.add('d-none');
    timeInBtn.style.display = 'none';
    timeOutBtn.style.display = 'none';

    if (addTaskButton) {
        addTaskButton.remove();
        addTaskButton = null;
    }

    earlyArrivalData = null;
    hideScheduleInfo();
}

function showRegisterPrompt(idBadge) {
    const statusDisplay = elements.currentStatusDisplay();
    const statusText = elements.currentStatusText();
    const statusTime = elements.currentStatusTime();

    statusDisplay.classList.remove('d-none');
    statusDisplay.style.background = '#fff5f5';
    statusDisplay.style.border = '1px solid #fecaca';

    statusText.textContent = 'Student Not Registered';
    statusText.style.color = 'var(--error-color)';
    statusTime.innerHTML = `<button class="btn btn-primary" onclick="showRegisterModal('${idBadge}')" style="margin-top: 0.5rem; padding: 0.5rem 1rem; font-size: 0.85rem;">Register Now</button>`;
}

// Attendance Actions - TIME IN
async function performTimeIn() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) return;
    if (actionCooldown) {
        showValidationWarning();
        return;
    }

    // Show TOTP verification for Time In
    showTotpVerificationModal('TIME_IN');
}

async function updateUIAfterTimeIn(data) {
    const statusText = elements.currentStatusText();
    const statusTime = elements.currentStatusTime();
    const timeInBtn = elements.timeInBtn();
    const timeOutBtn = elements.timeOutBtn();

    statusText.textContent = 'On Duty';
    statusText.style.color = 'var(--success-color)';
    statusTime.textContent = `Since: ${formatTime(data.timeIn)}`;

    timeInBtn.style.display = 'none';
    timeOutBtn.style.display = 'flex';
    currentTimeInTimestamp = new Date(data.timeIn);
    startTodayHoursTimer();

    // Use SweetAlert2 instead of toast
    showTimeInSuccess(data.studentName, formatTime(data.timeIn));

    const idBadge = elements.idBadge().value.trim();
    await checkPendingOverrideRequests(idBadge);
}

// TIME OUT - Shows task summary first, then TOTP
async function performTimeOut() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) return;
    if (actionCooldown) {
        showValidationWarning();
        return;
    }

    // Get existing tasks first
    const existingTasks = await getCurrentSessionTasks(idBadge);

    // Check if user has logged any tasks
    if (existingTasks.length === 0) {
        showAlert('You must log at least one task before timing out. Please add a task using the "Add Task" button.', 'warning');
        return;
    }

    // Has tasks - show task summary modal
    showTaskSummaryModal(existingTasks);
}

// Create TOTP verify modal
function createTotpVerifyModal() {
    const modal = document.createElement('div');
    modal.id = 'totpVerifyModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="closeTotpVerifyModal()">×</button>
            <div class="modal-header">
                <h3>Enter Authentication Code</h3>
                <p>Enter the 6-digit code from your Google Authenticator app</p>
            </div>
            <form id="totpActionForm" onsubmit="submitWithTotp(event)">
                <div class="form-group">
                    <label for="totpActionCode">Authenticator Code:</label>
                    <input type="text" id="totpActionCode" maxlength="6" placeholder="000000"
                        style="text-align: center; font-size: 2rem; letter-spacing: 0.5em; font-weight: 700;" required>
                </div>
                <input type="hidden" id="totpTasksData" value="">
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeTotpVerifyModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Verify & Continue</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    const codeInput = modal.querySelector('#totpActionCode');
    codeInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
    });

    return modal;
}

// Submit with TOTP verification
async function submitWithTotp(event) {
    event.preventDefault();

    const idBadge = elements.idBadge().value.trim();
    const totpCode = document.getElementById('totpActionCode').value.trim();
    const modal = document.getElementById('totpVerifyModal');
    const action = modal.dataset.action;
    const additionalTasks = document.getElementById('totpTasksData').value || '';

    if (totpCode.length !== 6) {
        showAlert('Please enter a valid 6-digit code', 'error');
        return;
    }

    showLoading();
    closeTotpVerifyModal();
    setActionCooldown();

    try {
        // FIRST: If this is a time-out AND there are additional tasks, submit them BEFORE timing out
        if (action === 'TIME_OUT' && additionalTasks.trim().length > 0) {
            console.log('Submitting additional tasks before time-out...');

            // Split by newlines to handle multiple tasks
            const taskLines = additionalTasks.split('\n')
                .map(line => line.trim())
                .filter(line => line.length >= 5);

            if (taskLines.length > 0) {
                const now = new Date();
                const completedAt = now.getFullYear() + '-' +
                                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                                    String(now.getDate()).padStart(2, '0') + 'T' +
                                    String(now.getHours()).padStart(2, '0') + ':' +
                                    String(now.getMinutes()).padStart(2, '0') + ':' +
                                    String(now.getSeconds()).padStart(2, '0');

                // Submit each additional task
                for (const task of taskLines) {
                    const requestBody = {
                        idBadge: idBadge,
                        taskDescription: task,
                        completedAt: completedAt,
                        addedDuringTimeout: true  // Mark as added during timeout
                    };

                    try {
                        const taskResponse = await fetch(`${API_BASE_URL}/tasks/add`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody)
                        });

                        if (taskResponse.ok) {
                            console.log('✓ Additional task saved:', task);
                        } else {
                            console.error('✗ Failed to save task:', task);
                        }
                    } catch (error) {
                        console.error('Error submitting task:', error);
                    }
                }

                // Small delay to ensure tasks are saved
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // SECOND: Now perform the actual time-in or time-out
        const response = await fetch(`${API_BASE_URL}/attendance/log-with-totp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idBadge: idBadge,
                totpCode: totpCode,
                tasksCompleted: '' // Don't pass tasks here, they're already saved above
            })
        });

        const data = await response.json();

        if (response.ok) {
            if (action === 'TIME_IN') {
                updateUIAfterTimeIn(data);
            } else {
                handleSuccessfulTimeOut(data);
            }
        } else {
            showAlert(data.message || 'Invalid TOTP, Please try again!', 'error');
            if (data.message && data.message.includes('Invalid TOTP')) {
                setTimeout(() => showTotpVerificationModal(action, additionalTasks), 1000);
            }
        }

    } catch (error) {
        showAlert('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showTotpVerificationModal(action, tasksCompleted = '') {
    const modal = document.getElementById('totpVerifyModal') || createTotpVerifyModal();
    const actionText = action === 'TIME_IN' ? 'Time In' : 'Time Out';

    modal.querySelector('.modal-header h3').textContent = `${actionText} - Enter Code`;
    modal.querySelector('.modal-header p').textContent = 'Enter the 6-digit code from your Google Authenticator app';

    modal.dataset.action = action;
    document.getElementById('totpTasksData').value = tasksCompleted;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    modal.querySelector('#totpActionCode').value = '';
    modal.querySelector('#totpActionCode').focus();
}

// Original submitTimeOut for legacy task modal
async function submitTimeOut() {
    const idBadge = elements.idBadge().value.trim();
    const tasksCompleted = document.getElementById('tasksCompleted').value.trim();

    if (!validateTimeOutForm(tasksCompleted)) return;

    closeTaskModal();

    // Now show TOTP modal with the tasks
    showTotpVerificationModal('TIME_OUT', tasksCompleted);
}

function closeTotpVerifyModal() {
    const modal = document.getElementById('totpVerifyModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        document.getElementById('totpActionForm').reset();
    }
}

function handleSuccessfulTimeOut(data) {
    lastAttendanceAction = {
        idBadge: elements.idBadge().value.trim(),
        status: 'TIMED_OUT',
        timestamp: Date.now()
    };

    // Use SweetAlert2 instead of toast
    showTimeOutSuccess(
        data.studentName,
        formatTime(data.timeOut),
        data.totalHours,
        data.breakDeducted,
        data.overtimeHours
    );

    const studentData = { currentStatus: 'TIMED_OUT', attendanceHistory: [{ timeOut: data.timeOut }] };
    updateButtonStates(studentData);

    clearIdInput();
    clearTaskInput();
    hideScheduleInfo();
    clearEarlyArrivalState();
}

function handleTimeOutError(data) {
    showAlert(data.message || 'Time out failed', 'error');
    if (pendingTimeOut) {
        setTimeout(() => showTaskModal(), 1000);
    }
}

async function checkCanLogTasks(idBadge) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/can-log-tasks/${idBadge}`);
        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            return { canLogTasks: false };
        }
    } catch (error) {
        console.error('Error checking can log tasks:', error);
        return { canLogTasks: false };
    }
}

async function addTask() {
    const idBadge = elements.idBadge().value.trim();
    if (!validateIdBadge(idBadge)) return;
    showAddTaskModal();
}

function showAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    if (modal) {
        const textarea = document.getElementById('taskDescription');

        // Load any saved draft
        loadDraftTask();

        // Load task history for autocomplete
        loadTaskHistory();

        // If no draft, clear and focus
        if (!textarea.value) {
            textarea.value = '';
        }
        textarea.focus();

        // Add auto-save on input
        textarea.removeEventListener('input', saveDraftTask);
        textarea.addEventListener('input', saveDraftTask);

        // Add Shift+Enter handler for multiple tasks
        textarea.removeEventListener('keydown', handleTaskTextareaKeydown);
        textarea.addEventListener('keydown', handleTaskTextareaKeydown);

        modal.classList.add('show');
        document.body.style.overflow = 'hidden';

        // Update helper text if not already added
        updateTaskModalHelper();
    }
}

// Handle keyboard events in task textarea
function handleTaskTextareaKeydown(e) {
    if (e.key === 'Enter' && e.shiftKey) {
        // Allow Shift+Enter to create new line for multiple tasks
        return;
    } else if (e.key === 'Enter' && !e.shiftKey) {
        // Prevent regular Enter from submitting
        e.preventDefault();
    }
}

function updateTaskModalHelper() {
    const modal = document.getElementById('addTaskModal');
    const formGroup = modal.querySelector('.form-group');

    if (!document.getElementById('task-helper-text')) {
        const helperText = document.createElement('div');
        helperText.id = 'task-helper-text';
        helperText.style.cssText = 'font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;';
        helperText.innerHTML = `
            <span style="font-size: 0.75rem; color: var(--success-color);">✓ Auto-saved • Start typing for suggestions</span>
            <br><br>
            <button type="button" class="preset-toggle-btn" onclick="openPresetModal()">
                <span>🎯</span>
                <span>Quick Select from Presets</span>
            </button>
            <p style="margin-top: 0.5rem; font-style: italic;">
                💡 <strong>Tip:</strong> Press <kbd style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">Shift + Enter</kbd> for multiple tasks
            </p>
        `;
        formGroup.appendChild(helperText);
    }
}

function closeAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        document.getElementById('addTaskForm').reset();
    }
}

async function submitTask(event) {
    event.preventDefault();

    const idBadge = elements.idBadge().value.trim();
    const taskDescription = document.getElementById('taskDescription').value.trim();

    if (!taskDescription || taskDescription.length < 5) {
        showAlert('Please enter a meaningful task description (minimum 5 characters)', 'warning');
        return;
    }

    // Split by newlines to handle multiple tasks
    const taskLines = taskDescription.split('\n')
        .map(line => line.trim())
        .filter(line => line.length >= 5);

    if (taskLines.length === 0) {
        showAlert('Please enter at least one valid task (minimum 5 characters per task)', 'warning');
        return;
    }

    showLoading();
    closeAddTaskModal();

    try {
        const now = new Date();
        const completedAt = now.getFullYear() + '-' +
                            String(now.getMonth() + 1).padStart(2, '0') + '-' +
                            String(now.getDate()).padStart(2, '0') + 'T' +
                            String(now.getHours()).padStart(2, '0') + ':' +
                            String(now.getMinutes()).padStart(2, '0') + ':' +
                            String(now.getSeconds()).padStart(2, '0');

        let successCount = 0;
        let failCount = 0;

        // Submit each task separately
        for (const task of taskLines) {
            const requestBody = {
                idBadge: idBadge,
                taskDescription: task,
                completedAt: completedAt,
                addedDuringTimeout: false
            };

            try {
                const response = await fetch(`${API_BASE_URL}/tasks/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
            }
        }

        // **IMPORTANT: Clear draft only after successful submission**
        if (successCount > 0) {
            clearDraftTask();
        }

        // Fetch updated dashboard data to get accurate task count
        try {
            const updatedDashboard = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
            if (updatedDashboard.ok) {
                const dashboardData = await updatedDashboard.json();
                const taskCount = dashboardData.todayTasksCount || 0;

                hideLoading();

                if (failCount === 0) {
                    showTaskAddedSuccess(taskCount, taskLines.length);
                } else if (successCount > 0) {
                    showAlert(`${successCount} task(s) added successfully. ${failCount} failed. Total tasks today: ${taskCount}`, 'warning');
                } else {
                    showErrorAlert('Failed to add tasks. Please try again.', 'Failed to Log Tasks');
                }

                // Update the dynamic metric in dashboard if it's open
                const dynamicValue = document.getElementById('dynamicValue');
                if (dynamicValue && elements.dashboardCard().classList.contains('show')) {
                    dynamicValue.textContent = taskCount;
                    setTimeout(() => {
                        viewDashboard();
                    }, 500);
                }
            } else {
                hideLoading();
                if (failCount === 0) {
                    showTaskAddedSuccess(successCount, taskLines.length);
                } else {
                    showAlert(`${successCount} task(s) added, ${failCount} failed`, 'warning');
                }
            }
        } catch (dashboardError) {
            console.error('Failed to fetch updated task count:', dashboardError);
            hideLoading();
            if (failCount === 0) {
                showTaskAddedSuccess(successCount, taskLines.length);
            }
        }
    } catch (error) {
        console.error('Network error:', error);
        hideLoading();
        showErrorAlert('Network error: Unable to connect to server', 'Connection Error');
    }
}

function saveDraftTask() {
    const taskDescription = document.getElementById('taskDescription');
    if (taskDescription) {
        const draftText = taskDescription.value.trim();
        if (draftText.length > 0) {
            localStorage.setItem('draftTask', draftText);
            // Show visual feedback
            showDraftSavedIndicator();
        } else {
            localStorage.removeItem('draftTask');
        }
    }
}

function showDraftSavedIndicator() {
    const textarea = document.getElementById('taskDescription');
    if (!textarea) return;

    // Add a temporary "saved" class for visual feedback
    textarea.style.borderColor = 'var(--success-color)';
    setTimeout(() => {
        textarea.style.borderColor = '';
    }, 300);
}

function loadDraftTask() {
    const taskDescription = document.getElementById('taskDescription');
    const draftText = localStorage.getItem('draftTask');

    if (draftText && taskDescription) {
        taskDescription.value = draftText;

        // Show a notification that draft was restored
        const formGroup = taskDescription.closest('.form-group');
        if (formGroup && !document.getElementById('draft-restored-msg')) {
            const draftMsg = document.createElement('div');
            draftMsg.id = 'draft-restored-msg';
            draftMsg.style.cssText = `
                font-size: 0.85rem;
                color: var(--success-color);
                margin-top: 0.5rem;
                font-style: italic;
                animation: fadeIn 0.3s ease-out;
            `;
            draftMsg.innerHTML = '✓ Draft restored';
            formGroup.appendChild(draftMsg);

            // Remove message after 3 seconds
            setTimeout(() => {
                draftMsg.remove();
            }, 3000);
        }
    }
}

function clearDraftTask() {
    localStorage.removeItem('draftTask');
}



async function getCurrentSessionTasks(idBadge) {
    try {
        // Get dashboard which now properly handles active sessions
        const dashboardResponse = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
        if (dashboardResponse.ok) {
            const dashboardData = await dashboardResponse.json();
            return dashboardData.todayTasks || [];
        }
        return [];
    } catch (error) {
        console.error('Failed to get current session tasks:', error);
        return [];
    }
}

function checkAdminAccess() {
    showAdminModal();
}

async function submitAdminAccess() {
    const adminUsername = document.getElementById('adminUsername').value.trim();
    const adminPassword = document.getElementById('adminPassword').value.trim();

    if (!adminUsername || !adminPassword) {
        showAlert('Please enter username and password', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: adminUsername,
                password: adminPassword
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            closeAdminModal();
            showAlert('Welcome, Administrator! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = `admin.html?authenticated=true&admin=${encodeURIComponent(data.username)}`;
            }, 1500);
        } else {
            showAlert(data.message || 'Invalid credentials. Access denied.', 'error');
            document.getElementById('adminPassword').focus();
        }

    } catch (error) {
        showAlert('Login failed. Please check your connection.', 'error');
    } finally {
        hideLoading();
    }
}

// Dashboard Functions
async function viewDashboard() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) return;

    showLoading();
    hideAlerts();

    try {
        const response = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Student not found. Please register first.');
            }
            throw new Error('Unable to load dashboard.');
        }

        const data = await response.json();
        await displayDashboard(data);
        showAlert(`Welcome back, ${data.fullName}! Dashboard loaded successfully.`, 'info');
        addOverrideRequestsButton();

    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function displayDashboard(data) {
    const dashboardModal = document.getElementById('dashboardModal');
    const dashboardTitle = document.getElementById('dashboardTitle');
    const studentInfo = document.getElementById('studentInfo');
    const currentStatus = document.getElementById('currentStatus');
    const totalHours = document.getElementById('totalHours');
    const requiredHours = document.getElementById('requiredHours');
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const modalActions = document.querySelector('#dashboardModal .modal-actions');

    dashboardTitle.textContent = `${getGreeting()}, ${data.fullName}`;

    let schoolName = data.school || 'N/A';
    if (!data.school && data.idBadge) {
        schoolName = await fetchSchoolName(data.idBadge) || schoolName;
    }

    studentInfo.textContent = `ID: ${data.idBadge} | School: ${schoolName}`;

    const activeRecord = data.attendanceHistory?.find(record => record.timeIn && !record.timeOut);
    const actualStatus = activeRecord ? 'TIMED_IN' : (data.currentStatus || 'TIMED_OUT');

    if (actualStatus === 'TIMED_IN') {
        currentStatus.textContent = 'Currently Working';
        currentStatus.style.color = 'var(--success-color)';
        currentStatus.style.fontWeight = '600';
    } else {
        // Check if worked today
        const today = new Date().toDateString();
        const todayRecord = data.attendanceHistory?.find(record => {
            const recordDate = new Date(record.attendanceDate).toDateString();
            return recordDate === today && record.timeOut != null;
        });

        if (todayRecord && todayRecord.timeOut) {
            const timeOutDate = new Date(todayRecord.timeOut);
            const now = new Date();
            const hoursSinceTimeOut = (now - timeOutDate) / (1000 * 60 * 60);

            if (hoursSinceTimeOut < 4) {
                const hoursWorked = parseFloat(todayRecord.totalHours || 0);
                currentStatus.textContent = `✓ Completed Today (${hoursWorked.toFixed(0)}h)`;
                currentStatus.style.color = 'var(--info-color)';
                currentStatus.style.fontWeight = '600';
            } else {
                currentStatus.textContent = 'Ready to Time In';
                currentStatus.style.color = 'var(--text-secondary)';
                currentStatus.style.fontWeight = '500';
            }
        } else {
            currentStatus.textContent = 'Ready to Time In';
            currentStatus.style.color = 'var(--text-secondary)';
            currentStatus.style.fontWeight = '500';
        }
    }

    let studentFullData = data;
    try {
        const studentResponse = await fetch(`${API_BASE_URL}/students/all`);
        if (studentResponse.ok) {
            const allStudents = await studentResponse.json();
            const currentStudent = allStudents.find(s => s.idBadge === data.idBadge);
            if (currentStudent) {
                studentFullData = { ...data, requiredHours: currentStudent.requiredHours };
            }
        }
    } catch (error) {
        console.error('Failed to fetch student full data:', error);
    }

    const totalHoursValue = parseFloat(studentFullData.totalAccumulatedHours || 0);
    const requiredHoursValue = studentFullData.requiredHours ? parseFloat(studentFullData.requiredHours) : 0;
    const hasRequiredHours = requiredHoursValue > 0;

    // Create tabs when timed in, regular display when timed out
    if (actualStatus === 'TIMED_IN') {
        createDashboardTabs(studentFullData);
        startTaskCountUpdate(studentFullData.idBadge);

        if (activeRecord) {
            currentTimeInTimestamp = new Date(activeRecord.timeIn);
            startTodayHoursTimer();
        }
    } else {
        stopTaskCountUpdate();

        // For timed out status, show regular metric display
        const dynamicMetric = document.getElementById('dynamicMetric');
        if (dynamicMetric) {
            dynamicMetric.innerHTML = `
                <div class="label" id="dynamicLabel">Days to Complete</div>
                <div class="value" id="dynamicValue">0</div>
            `;

            const dynamicLabel = document.getElementById('dynamicLabel');
            const dynamicValue = document.getElementById('dynamicValue');

            if (hasRequiredHours && totalHoursValue < requiredHoursValue) {
                const remainingHours = requiredHoursValue - totalHoursValue;
                const estimate = calculateEstimatedDaysAndHours(remainingHours, studentFullData);
                dynamicLabel.textContent = 'Est. Time to Complete';
                dynamicValue.textContent = estimate.formatted;
                dynamicValue.style.color = 'var(--info-color)';
            } else if (hasRequiredHours && totalHoursValue >= requiredHoursValue) {
                dynamicLabel.textContent = 'Status';
                dynamicValue.textContent = '🎉 Complete!';
                dynamicValue.style.color = 'var(--success-color)';
            } else {
                dynamicLabel.textContent = 'Required Hours';
                dynamicValue.textContent = 'Not Set';
                dynamicValue.style.color = 'var(--text-muted)';
            }
        }
    }

    totalHours.textContent = formatHoursMinutes(totalHoursValue);

    if (hasRequiredHours) {
        requiredHours.textContent = formatHoursMinutes(requiredHoursValue);
    } else {
        requiredHours.textContent = 'N/A';
    }

    if (hasRequiredHours) {
        const progressPercent = Math.min((totalHoursValue / requiredHoursValue) * 100, 100);
        progressFill.style.width = progressPercent.toFixed(0) + '%';
        progressPercentage.textContent = progressPercent.toFixed(0) + '%';

        const progressClass = getProgressClass(progressPercent);
        progressFill.className = `progress-fill-dashboard ${progressClass}`;
    } else {
        progressFill.style.width = '0%';
        progressPercentage.textContent = 'N/A';
        progressFill.className = 'progress-fill-dashboard';
    }

    if (!document.getElementById('weeklyReportBtn')) {
        const weeklyBtn = document.createElement('button');
        weeklyBtn.id = 'weeklyReportBtn';
        weeklyBtn.className = 'btn btn-info';
        weeklyBtn.innerHTML = '📄 Weekly Report';
        weeklyBtn.onclick = () => showWeeklyReportOptions();

        modalActions.insertBefore(weeklyBtn, modalActions.firstChild);
    }

    dashboardModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    displayAttendanceHistory(studentFullData.attendanceHistory);
}

function getGreeting() {
    const hour = new Date().getHours();
    const greetings = {
        night: ['Good evening', 'Hello', 'Welcome back'],
        morning: ['Good morning', 'Hi there', 'Welcome'],
        noon: ['Good noon', 'Hello', 'Welcome'],
        afternoon: ['Good afternoon', 'Hi', 'Welcome back'],
        evening: ['Good evening', 'Hello', 'Welcome']
    };

    let timeOfDay;
    if (hour >= 5 && hour < 12) {
        timeOfDay = 'morning';
    } else if (hour >= 12 && hour < 13) {
        timeOfDay = 'noon';
    } else if (hour >= 13 && hour < 18) {
        timeOfDay = 'afternoon';
    } else if (hour >= 18 && hour < 21) {
        timeOfDay = 'evening';
    } else {
        timeOfDay = 'night';
    }

    const greetingArray = greetings[timeOfDay];
    return greetingArray[Math.floor(Math.random() * greetingArray.length)];
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

function getProgressClass(percentage) {
    if (percentage >= 90) return 'progress-fill-9';
    if (percentage >= 80) return 'progress-fill-8';
    if (percentage >= 70) return 'progress-fill-7';
    if (percentage >= 60) return 'progress-fill-6';
    if (percentage >= 50) return 'progress-fill-5';
    if (percentage >= 40) return 'progress-fill-4';
    if (percentage >= 30) return 'progress-fill-3';
    if (percentage >= 20) return 'progress-fill-2';
    if (percentage >= 10) return 'progress-fill-1';
    return 'progress-fill-0';
}

function startTaskCountUpdate(idBadge) {
    if (taskCountInterval) {
        clearInterval(taskCountInterval);
    }

    taskCountInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
            if (response.ok) {
                const data = await response.json();

                // Update task count - this now reflects the ACTIVE SESSION
                const dynamicValue = document.getElementById('dynamicValue');
                if (dynamicValue) {
                    dynamicValue.textContent = data.todayTasksCount || 0;
                }

                // Update days value if it exists
                const daysValue = document.getElementById('daysValue');
                if (daysValue) {
                    const totalHoursValue = parseFloat(data.totalAccumulatedHours || 0);
                    const requiredHoursValue = data.requiredHours ? parseFloat(data.requiredHours) : 0;
                    const hasRequiredHours = requiredHoursValue > 0;

                    if (hasRequiredHours && totalHoursValue < requiredHoursValue) {
                        const remainingHours = requiredHoursValue - totalHoursValue;
                        const estimatedDays = calculateEstimatedDays(remainingHours, data);
                        daysValue.innerHTML = `${estimatedDays} day(s)`;
                    } else if (hasRequiredHours && totalHoursValue >= requiredHoursValue) {
                        daysValue.innerHTML = '<span style="color: var(--success-color);">Complete!</span>';
                    } else {
                        daysValue.textContent = 'Not Set';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update dashboard metrics:', error);
        }
    }, 120000); // Update every 2 minutes
}

function stopTaskCountUpdate() {
    if (taskCountInterval) {
        clearInterval(taskCountInterval);
        taskCountInterval = null;
    }
}

async function fetchSchoolName(idBadge) {
    try {
        const studentsResponse = await fetch(`${API_BASE_URL}/students/all`);
        if (studentsResponse.ok) {
            const students = await studentsResponse.json();
            const student = students.find(s => s.idBadge === idBadge);
            return student?.school;
        }
    } catch (error) {
        console.error('Failed to fetch school data:', error);
    }
    return null;
}

function displayAttendanceHistory(history) {
    const historySection = document.getElementById('historySection');
    const historyBody = document.getElementById('historyBody');

    if (history && history.length > 0) {
        historyBody.innerHTML = history.slice(0, 10).map(record => {
            const timeInOut = record.timeOut
                ? `${formatTime(record.timeIn)} - ${formatTime(record.timeOut)}`
                : `${formatTime(record.timeIn)} - Active`;

            let hoursDisplay;
            if (!record.timeOut && currentTimeInTimestamp) {
                // This will be updated by updateTodayHours() function
                hoursDisplay = `<strong>0h 0m 0s</strong>`;
            } else {
                hoursDisplay = `<strong>${record.totalHours || '0.0'}h</strong>`;
            }

            return `
                <tr>
                    <td>${formatDate(record.attendanceDate)}</td>
                    <td>${timeInOut}</td>
                    <td>${hoursDisplay}</td>
                    <td><span class="status-badge status-${record.status.toLowerCase().replace('_', '-')}">${record.status.replace('_', ' ')}</span></td>
                </tr>
            `;
        }).join('');

        historySection.classList.add('show');
    } else {
        historyBody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 2rem; color: var(--text-muted);">No attendance records found</td></tr>';
        historySection.classList.add('show');
    }
}

async function downloadReport() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) {
        showErrorAlert('Please enter your ID badge first');
        return;
    }

    showLoading();

    try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const response = await fetch(`${API_BASE_URL}/reports/student/${idBadge}/csv?startDate=${startDate}&endDate=${endDate}`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-report-${idBadge}-${startDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            hideLoading();
            // Use SweetAlert2 instead of toast
            showCSVDownloadSuccess();
        } else {
            hideLoading();
            showErrorAlert('Failed to download report');
        }

    } catch (error) {
        hideLoading();
        showErrorAlert('Failed to download report. Please try again.');
    }
}

function hideDashboard() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
    stopTaskCountUpdate();
}

function closeDashboardModal() {
    hideDashboard();
    clearEarlyArrivalState();
}

// Modal Management
function showTaskModal() {
    const modal = elements.taskModal();
    if (modal) {
        document.getElementById('tasksCompleted').focus();
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeTaskModal() {
    const modal = elements.taskModal();
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        clearTaskInput();
        pendingTimeOut = false;
    }
}

function showAdminModal() {
    const modal = elements.adminModal();
    if (modal) {
        document.getElementById('adminPassword').focus();
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function closeAdminModal() {
    const modal = elements.adminModal();
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        document.getElementById('adminPassword').value = '';
    }
}

function showRegisterModal(prefillId = '') {
    const modal = elements.registerModal();
    const regIdBadge = document.getElementById('regIdBadge');

    if (prefillId) {
        regIdBadge.value = prefillId;
        document.getElementById('regFullName').focus();
    } else {
        regIdBadge.focus();
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeRegisterModal() {
    const modal = elements.registerModal();
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        document.getElementById('registerForm').reset();
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    });

    const forms = ['registerForm', 'taskForm', 'adminForm', 'addTaskForm'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) form.reset();
    });

    pendingTimeOut = false;
}

// Task Summary Modal - Shows tasks review before TOTP
function showTaskSummaryModal(tasks) {
    const modal = elements.taskModal();
    const modalHeader = modal.querySelector('.modal-header h3');
    const modalContent = modal.querySelector('.modal-header p');
    const form = document.getElementById('taskForm');

    modalHeader.textContent = 'Time Out Summary';
    modalContent.innerHTML = `You've logged ${tasks.length} task${tasks.length !== 1 ? 's' : ''} today. Review and add any missing tasks before timing out.`;

    form.innerHTML = `
        <div class="task-summary">
            <h4>Today's Tasks:</h4>
            <div class="tasks-list">
                ${tasks.map((task, index) => `
                    <div class="task-item">
                        <strong>${index + 1}.</strong> ${task.taskDescription}
                        <div class="task-time">Completed: ${formatTime(task.completedAt)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="form-group" style="margin-top: 1.5rem;">
                <label for="additionalTasks">Add any missed tasks (optional):</label>
                <textarea id="additionalTasks" name="additionalTasks" placeholder="Add any tasks you may have forgotten to log earlier..."></textarea>
            </div>
        </div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" onclick="closeTaskModal()">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitEnhancedTimeOut()">Continue to Time Out</button>
        </div>
    `;

    pendingTimeOut = true;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Time Out - Shows TOTP after task review
async function submitEnhancedTimeOut() {
    const additionalTasks = document.getElementById('additionalTasks')?.value.trim() || '';

    closeTaskModal();

    // Show TOTP modal with the additional tasks
    showTotpVerificationModal('TIME_OUT', additionalTasks);
}

// Validation Functions
function isValidIdBadge(idBadge) {
    return /^\d{4}$/.test(idBadge);
}

function validateIdBadge(idBadge) {
    if (!idBadge) {
        showAlert('Please enter your ID badge', 'error');
        elements.idBadge().focus();
        return false;
    }

    if (!isValidIdBadge(idBadge)) {
        showAlert('ID badge must be exactly 4 digits', 'error');
        elements.idBadge().focus();
        return false;
    }

    return true;
}

function validateTimeOutForm(tasksCompleted) {
    if (!tasksCompleted) {
        showAlert('Please describe your completed tasks', 'error');
        return false;
    }

    if (tasksCompleted.length < 10) {
        showAlert('Please provide more detailed description (minimum 10 characters)', 'error');
        return false;
    }

    return true;
}

function validateRegistrationForm(idBadge, fullName, school) {
    if (!idBadge || !isValidIdBadge(idBadge)) {
        showAlert('ID badge must be exactly 4 digits', 'error');
        return false;
    }

    if (!fullName || fullName.length < 2) {
        showAlert('Please enter your full name', 'error');
        return false;
    }

    if (!school || school.length < 2) {
        showAlert('Please enter your school name', 'error');
        return false;
    }

    return true;
}

// Utility Functions
function handleEnterKey() {
    const idBadge = elements.idBadge().value.trim();

    if (!isValidIdBadge(idBadge)) {
        showAlert('Please enter a valid 4-digit ID badge first', 'warning');
        return;
    }

    const timeInBtn = elements.timeInBtn();
    const timeOutBtn = elements.timeOutBtn();

    if (timeInBtn.style.display !== 'none') {
        performTimeIn();
    } else if (timeOutBtn.style.display !== 'none') {
        performTimeOut();
    }
}

function setActionCooldown() {
    actionCooldown = true;
    setTimeout(() => { actionCooldown = false; }, 3000);
}

function disableButtons() {
    elements.timeInBtn().disabled = true;
    elements.timeOutBtn().disabled = true;
}

function enableButtons() {
    elements.timeInBtn().disabled = false;
    elements.timeOutBtn().disabled = false;
}

function showValidationWarning() {
    const warning = elements.validationWarning();
    warning.classList.add('show');
    setTimeout(() => hideValidationWarning(), 5000);
}

function hideValidationWarning() {
    elements.validationWarning().classList.remove('show');
}

function showAlert(message, type) {
    const alertContainer = elements.alertContainer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = message;
    alertContainer.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 6000);
}

function hideAlerts() {
    elements.alertContainer().innerHTML = '';
}

function showLoading() {
    elements.loading().classList.add('show');
}

function hideLoading() {
    elements.loading().classList.remove('show');
}

function clearIdInput() {
    elements.idBadge().value = '';
    resetButtonStates();
    hideDashboard();
    hideScheduleInfo();
    clearEarlyArrivalState();
    elements.idBadge().focus();
}

function clearTaskInput() {
    const tasksCompleted = document.getElementById('tasksCompleted');
    if (tasksCompleted) {
        tasksCompleted.value = '';
    }
}

function formatTime(timeString) {
    if (!timeString) return 'N/A';
    try {
        const date = new Date(timeString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        return 'Invalid time';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
        });
    } catch (error) {
        return 'Invalid date';
    }
}

function startTodayHoursTimer() {
    if (todayHoursInterval) {
        clearInterval(todayHoursInterval);
    }

    todayHoursInterval = setInterval(updateTodayHours, 1000);
    updateTodayHours();
}

function stopTodayHoursTimer() {
    if (todayHoursInterval) {
        clearInterval(todayHoursInterval);
        todayHoursInterval = null;
    }
    currentTimeInTimestamp = null;
}

async function updateTodayHours() {
    if (!currentTimeInTimestamp) return;

    const now = new Date();
    const idBadge = elements.idBadge().value.trim();

    let shouldShowOnHold = false;
    let effectiveStartTime = null;

    if (idBadge && isValidIdBadge(idBadge)) {
        try {
            // Get student's schedule
            const studentsResponse = await fetch(`${API_BASE_URL}/students/all`);
            if (studentsResponse.ok) {
                const allStudents = await studentsResponse.json();
                const currentStudent = allStudents.find(s => s.idBadge === idBadge);

                if (currentStudent && currentStudent.scheduleActive) {
                    // Check for approved override for THIS session
                    const overrideResponse = await fetch(`${API_BASE_URL}/schedule-override/my-requests/${idBadge}`);
                    let hasApprovedOverride = false;

                    if (overrideResponse.ok) {
                        const overrideData = await overrideResponse.json();
                        if (overrideData.success && overrideData.requests) {
                            // Check if there's an approved request for TODAY
                            const todayStr = new Date().toDateString();
                            const approvedRequest = overrideData.requests.find(req => {
                                const reqDate = new Date(req.requestedAt).toDateString();
                                return req.status === 'APPROVED' && reqDate === todayStr;
                            });
                            hasApprovedOverride = !!approvedRequest;
                        }
                    }

                    if (!hasApprovedOverride) {
                        // No override - enforce schedule
                        const scheduledStart = currentStudent.scheduledStartTime;
                        const [schedHours, schedMinutes] = scheduledStart.split(':').map(Number);

                        // Create today's scheduled start time
                        const todayScheduled = new Date();
                        todayScheduled.setHours(schedHours, schedMinutes, 0, 0);

                        if (now < todayScheduled) {
                            // Current time is before schedule - ON HOLD
                            shouldShowOnHold = true;
                        } else {
                            // Current time is after schedule - count from scheduled time
                            effectiveStartTime = todayScheduled;
                        }
                    } else {
                        // Has approved override - count from actual time in
                        effectiveStartTime = currentTimeInTimestamp;
                    }
                } else {
                    // No schedule active - count from actual time in
                    effectiveStartTime = currentTimeInTimestamp;
                }
            } else {
                // Can't fetch students - count from actual time in
                effectiveStartTime = currentTimeInTimestamp;
            }
        } catch (error) {
            console.error('Error checking schedule for timer:', error);
            // On error - count from actual time in
            effectiveStartTime = currentTimeInTimestamp;
        }
    } else {
        // No valid badge - count from actual time in
        effectiveStartTime = currentTimeInTimestamp;
    }

    // Update the display
    const historyBody = document.getElementById('historyBody');
    if (historyBody) {
        const activeRow = historyBody.querySelector('tr:first-child td:nth-child(3)');
        if (activeRow) {
            if (shouldShowOnHold) {
                activeRow.innerHTML = `<strong style="color: #f59e0b;">⏸️ On Hold</strong>`;
            } else if (effectiveStartTime) {
                const diffMs = now - effectiveStartTime;

                if (diffMs < 0) {
                    // This shouldn't happen, but just in case
                    activeRow.innerHTML = `<strong style="color: #f59e0b;">⏸️ On Hold</strong>`;
                } else {
                    const hours = Math.floor(diffMs / (1000 * 60 * 60));
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                    const timeString = `${hours}h ${minutes}m ${seconds}s`;
                    activeRow.innerHTML = `<strong>${timeString}</strong>`;
                }
            }
        }
    }
}

const totpStyles = `
<style>
.totp-setup-content ol li {
    margin-bottom: 0.5rem;
}

.totp-setup-content strong {
    color: var(--primary-color);
}

#totpActionCode:focus {
    border-color: var(--success-color);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

#totpVerifyCode:focus {
    border-color: var(--success-color);
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}
</style>
`;

if (!document.getElementById('totp-custom-styles')) {
    const styleSheet = document.createElement('div');
    styleSheet.id = 'totp-custom-styles';
    styleSheet.innerHTML = totpStyles;
    document.head.appendChild(styleSheet);
}

async function downloadWeeklyReport(weekType = 'current') {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) {
        showAlert('Please enter your ID badge', 'error');
        return;
    }

    showLoading();

    try {
        let url;

        if (weekType === 'current') {
            // Current week (Monday to Sunday)
            url = `${API_BASE_URL}/reports/weekly-pdf/${idBadge}/current-week`;
        } else if (weekType === 'custom') {
            // Custom date range
            const startDate = prompt('Enter start date (YYYY-MM-DD):');
            const endDate = prompt('Enter end date (YYYY-MM-DD):');

            if (!startDate || !endDate) return;

            url = `${API_BASE_URL}/reports/weekly-pdf/${idBadge}?startDate=${startDate}&endDate=${endDate}`;
        }

        const response = await fetch(url);

        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `weekly-report-${idBadge}-${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            showAlert('Weekly report downloaded successfully!', 'success');
        } else {
            showAlert('Failed to generate weekly report', 'error');
        }

    } catch (error) {
        showAlert('Failed to download report: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function showWeeklyReportOptions() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) {
        showAlert('Please enter your ID badge first', 'error');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);

        if (!response.ok) {
            throw new Error('Failed to load student data');
        }

        const studentData = await response.json();

        const studentResponse = await fetch(`${API_BASE_URL}/students/all`);
        if (!studentResponse.ok) {
            throw new Error('Failed to load student information');
        }

        const allStudents = await studentResponse.json();
        const currentStudent = allStudents.find(s => s.idBadge === idBadge);

        if (!currentStudent) {
            throw new Error('Student not found');
        }

        // Use first attendance date if OJT start date not set
        let ojtStartDate;
        if (currentStudent.ojtStartDate) {
            ojtStartDate = new Date(currentStudent.ojtStartDate);
        } else if (studentData.attendanceHistory && studentData.attendanceHistory.length > 0) {
            // Get earliest attendance date
            const dates = studentData.attendanceHistory.map(r => new Date(r.attendanceDate));
            ojtStartDate = new Date(Math.min(...dates));
        } else {
            hideLoading();
            showAlert('No attendance records found. Please complete at least one session first.', 'warning');
            return;
        }

        hideLoading();
        displayWeeklyReportModal(currentStudent, ojtStartDate);

    } catch (error) {
        hideLoading();
        showAlert('Failed to load weekly report options: ' + error.message, 'error');
    }
}

function displayWeeklyReportModal(student, ojtStartDate) {
    // ojtStartDate is now passed as parameter (already calculated)
    const firstMonday = getNextOrSameMonday(ojtStartDate);
    const totalWeeks = calculateTotalCalendarWeeks(ojtStartDate);

    const modalHTML = `
        <div class="modal" id="weeklyReportOptionsModal" style="display: flex;">
            <div class="modal-content" style="max-width: 600px;">
                <button class="modal-close" onclick="closeWeeklyReportOptions()">×</button>
                <div class="modal-header">
                    <h3>📄 Download Weekly Report</h3>
                    <p>Select which week you want to download (Calendar weeks: Monday-Sunday)</p>
                </div>
                <div style="padding: 0 1rem;">
                    <div style="background: var(--bg-secondary); padding: 1rem; border-radius: var(--border-radius-lg); margin-bottom: 1.5rem;">
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <strong>OJT Start Date:</strong> ${formatRegistrationDate(ojtStartDate)}
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <strong>First Week Monday:</strong> ${formatRegistrationDate(firstMonday)}
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">
                            <strong>Available Weeks:</strong> Week 1 to Week ${totalWeeks}
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="weekSelector">Select Week Number:</label>
                        <select id="weekSelector" class="week-selector" style="width: 100%; padding: 1rem; border: 2px solid var(--border-color); border-radius: var(--border-radius-lg); font-size: 1rem; background: var(--bg-secondary);">
                            ${generateWeekOptions(totalWeeks)}
                        </select>
                    </div>

                    <div class="week-info" id="weekInfo" style="background: var(--bg-tertiary); padding: 1rem; border-radius: var(--border-radius-lg); margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                        <strong>Selected Week Range:</strong> <span id="weekRange">Select a week</span>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
                        <button class="btn btn-primary" onclick="downloadWeeklyReportByNumber()">
                            📥 Download Selected Week
                        </button>
                        <button class="btn btn-info" onclick="downloadCurrentWeek()">
                            📅 Download Current Week
                        </button>
                        <button class="btn btn-secondary" onclick="showCustomDateRange()">
                            🗓️ Custom Date Range
                        </button>
                        <button class="btn btn-secondary" onclick="closeWeeklyReportOptions()">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('weeklyReportOptionsModal');
    if (existingModal) {
        existingModal.remove();
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);

    const weekSelector = document.getElementById('weekSelector');
    weekSelector.addEventListener('change', function() {
        updateWeekRange(ojtStartDate, parseInt(this.value));
    });

    updateWeekRange(ojtStartDate, 1);
}

function getNextOrSameMonday(date) {
    const d = new Date(date);
    const day = d.getDay();

    // If already Monday, return same day
    if (day === 1) {
        return d;
    }

    // Calculate days until next Monday
    const daysUntilMonday = day === 0 ? 1 : (8 - day);
    d.setDate(d.getDate() + daysUntilMonday);
    return d;
}

function calculateTotalCalendarWeeks(ojtStartDate) {
    const today = new Date();

    const firstMonday = getMondayOfWeek(ojtStartDate);
    const currentMonday = getMondayOfWeek(today);

    const daysBetween = Math.floor((currentMonday - firstMonday) / (1000 * 60 * 60 * 24));
    const weeksBetween = Math.floor(daysBetween / 7);

    return weeksBetween + 1;
}

function getMondayOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getWeekDateRange(ojtStartDate, weekNumber) {
    const firstMonday = getMondayOfWeek(ojtStartDate);

    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + ((weekNumber - 1) * 7));

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return { start: weekStart, end: weekEnd };
}

function updateWeekRange(ojtStartDate, weekNumber) {
    const weekRange = getWeekDateRange(ojtStartDate, weekNumber);
    const weekStartDate = weekRange.start;
    const weekEndDate = weekRange.end;

    const today = new Date();
    const isAvailable = weekStartDate <= today;

    const weekRangeElement = document.getElementById('weekRange');
    if (weekRangeElement) {
        if (isAvailable) {
            weekRangeElement.innerHTML = `Mon ${formatDateShort(weekStartDate)} - Sun ${formatDateShort(weekEndDate)} <span style="color: var(--success-color);">✓ Available</span>`;
            weekRangeElement.style.color = 'var(--text-primary)';
        } else {
            weekRangeElement.innerHTML = `Mon ${formatDateShort(weekStartDate)} - Sun ${formatDateShort(weekEndDate)} <span style="color: var(--error-color);">✗ Not Available Yet</span>`;
            weekRangeElement.style.color = 'var(--text-muted)';
        }
    }
}



async function downloadCurrentWeek() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) {
        showErrorAlert('Please enter your ID badge');
        return;
    }

    showLoading();
    closeWeeklyReportOptions();

    try {
        const url = `${API_BASE_URL}/reports/weekly-pdf/${idBadge}/current-week`;
        const response = await fetch(url);

        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const today = new Date().toISOString().split('T')[0];
            a.download = `weekly-report-${idBadge}-current-${today}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            hideLoading();
            // Use SweetAlert2 with current week info
            showWeeklyReportDownloadSuccess(getCurrentWeekDates());
        } else {
            hideLoading();
            throw new Error('Failed to generate current week report');
        }

    } catch (error) {
        hideLoading();
        showErrorAlert('Failed to download report: ' + error.message);
    }
}

function generateWeekOptions(totalWeeks) {
    let options = '';
    for (let i = 1; i <= totalWeeks; i++) {
        options += `<option value="${i}">Week ${i}</option>`;
    }
    return options;
}

async function downloadWeeklyReportByNumber() {
    const idBadge = elements.idBadge().value.trim();
    const weekNumber = parseInt(document.getElementById('weekSelector').value);

    if (!validateIdBadge(idBadge)) {
        showErrorAlert('Please enter your ID badge');
        return;
    }

    showLoading();
    closeWeeklyReportOptions();

    try {
        const url = `${API_BASE_URL}/reports/weekly-pdf/${idBadge}/week/${weekNumber}`;
        const response = await fetch(url);

        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `weekly-report-${idBadge}-week${weekNumber}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            hideLoading();
            // Use SweetAlert2 with week number
            showWeeklyReportDownloadSuccess(`Week ${weekNumber}`);
        } else {
            hideLoading();
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to generate weekly report');
        }

    } catch (error) {
        hideLoading();
        showErrorAlert('Failed to download report: ' + error.message);
    }
}

function closeWeeklyReportOptions() {
    const modal = document.getElementById('weeklyReportOptionsModal');
    if (modal) {
        modal.remove();
    }
}

function showCustomDateRange() {
    closeWeeklyReportOptions();

    const modalHTML = `
        <div class="modal" id="customDateRangeModal" style="display: flex;">
            <div class="modal-content">
                <button class="modal-close" onclick="closeCustomDateRange()">×</button>
                <div class="modal-header">
                    <h3>🗓️ Custom Date Range</h3>
                    <p>Select start and end dates for your report</p>
                </div>
                <form id="customDateForm" onsubmit="downloadCustomDateRange(event)">
                    <div class="form-group">
                        <label for="customStartDate">Start Date:</label>
                        <input type="date" id="customStartDate" class="form-control" required
                            style="width: 100%; padding: 0.75rem; border: 2px solid var(--border-color); border-radius: var(--border-radius-lg); font-size: 1rem;">
                    </div>
                    <div class="form-group">
                        <label for="customEndDate">End Date:</label>
                        <input type="date" id="customEndDate" class="form-control" required
                            style="width: 100%; padding: 0.75rem; border: 2px solid var(--border-color); border-radius: var(--border-radius-lg); font-size: 1rem;">
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeCustomDateRange()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Download Report</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('customStartDate').max = today;
    document.getElementById('customEndDate').max = today;
}

async function downloadCustomDateRange(event) {
    event.preventDefault();

    const idBadge = elements.idBadge().value.trim();
    const startDate = document.getElementById('customStartDate').value;
    const endDate = document.getElementById('customEndDate').value;

    if (!validateIdBadge(idBadge)) {
        showErrorAlert('Please enter your ID badge');
        return;
    }

    if (!startDate || !endDate) {
        showErrorAlert('Please select both start and end dates');
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        showErrorAlert('Start date must be before end date');
        return;
    }

    showLoading();
    closeCustomDateRange();

    try {
        const url = `${API_BASE_URL}/reports/weekly-pdf/${idBadge}?startDate=${startDate}&endDate=${endDate}`;
        const response = await fetch(url);

        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `weekly-report-${idBadge}-${startDate}-to-${endDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            hideLoading();
            // Use SweetAlert2 with date range
            showWeeklyReportDownloadSuccess(`${startDate} to ${endDate}`);
        } else {
            hideLoading();
            throw new Error('Failed to generate custom date range report');
        }

    } catch (error) {
        hideLoading();
        showErrorAlert('Failed to download report: ' + error.message);
    }
}

function closeCustomDateRange() {
    const modal = document.getElementById('customDateRangeModal');
    if (modal) {
        modal.remove();
    }
}

function getCurrentWeekDates() {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${formatDate(monday)} - ${formatDate(sunday)}`;
}

/**
 * Helper function to format registration date
 */
function formatRegistrationDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Helper function to format date short
 */
function formatDateShort(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Get current week date range string
 */
function getCurrentWeekDates() {
    const today = new Date();
    const monday = getMondayOfWeek(today);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `${formatDate(monday)} - ${formatDate(sunday)}`;
}




// ============================================
// PRESET MODAL FUNCTIONALITY
// ============================================

let selectedPresets = [];
let taskHistory = [];
let selectedRoom = null;

// Open Preset Modal
function openPresetModal() {
    const modal = document.getElementById('taskPresetModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Load task history from localStorage or backend
    loadTaskHistory();
}

// Close Preset Modal
function closePresetModal() {
    const modal = document.getElementById('taskPresetModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Toggle Category
function toggleCategory(categoryId) {
    const content = document.getElementById(categoryId);
    const header = content.previousElementSibling;

    // Close all other categories
    document.querySelectorAll('.category-content').forEach(cat => {
        if (cat.id !== categoryId) {
            cat.classList.remove('show');
            cat.previousElementSibling.classList.remove('active');
        }
    });

    // Toggle current category
    content.classList.toggle('show');
    header.classList.toggle('active');
}

// Select Preset
function selectPreset(taskText) {
    const index = selectedPresets.indexOf(taskText);

    if (index > -1) {
        // Deselect
        selectedPresets.splice(index, 1);
    } else {
        // Select
        selectedPresets.push(taskText);
    }

    updateSelectedPreview();
    updatePresetButtons();
}

function selectRoom(roomName) {
    const allRoomButtons = document.querySelectorAll('.room-buttons .preset-btn');

    // If clicking the same room, deselect it
    if (selectedRoom === roomName) {
        selectedRoom = null;
        allRoomButtons.forEach(btn => btn.classList.remove('selected'));
    } else {
        // Select new room
        selectedRoom = roomName;

        // Update visual state
        allRoomButtons.forEach(btn => {
            const btnRoom = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            if (btnRoom === roomName) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    updateSelectedPreview();
}

// Update Selected Preview
function updateSelectedPreview() {
    const preview = document.getElementById('selectedPreview');
    const list = document.getElementById('selectedList');

    const hasSelections = selectedPresets.length > 0 || selectedRoom !== null;

    if (!hasSelections) {
        preview.style.display = 'none';
        return;
    }

    preview.style.display = 'block';

    let items = [];

    // Show selected tasks
    if (selectedPresets.length > 0) {
        items = selectedPresets.map(task => {
            const displayText = selectedRoom ? `${task} | ${selectedRoom}` : task;
            return `
                <div class="selected-item">
                    <span>${displayText}</span>
                    <button onclick="selectPreset('${task.replace(/'/g, "\\'")}')">×</button>
                </div>
            `;
        });
    }

    // Show selected room separately if no tasks selected
    if (selectedRoom && selectedPresets.length === 0) {
        items.push(`
            <div class="selected-item room-only">
                <span>📍 ${selectedRoom}</span>
                <button onclick="selectRoom('${selectedRoom.replace(/'/g, "\\'")}')">×</button>
            </div>
        `);
    }

    list.innerHTML = items.join('');
}

// Update Preset Button States
function updatePresetButtons() {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        const text = btn.textContent;
        const fullText = btn.getAttribute('onclick').match(/'([^']+)'/)[1];

        if (selectedPresets.includes(fullText)) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// Clear Selected Presets
function clearSelectedPresets() {
    selectedPresets = [];
    selectedRoom = null;
    updateSelectedPreview();
    updatePresetButtons();

    // Clear room button states
    document.querySelectorAll('.room-buttons .preset-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Insert Presets to Task Textarea
function insertPresetsToTask() {
    const taskDescription = document.getElementById('taskDescription');
    const currentText = taskDescription.value.trim();

    if (selectedPresets.length === 0 && !selectedRoom) {
        showAlert('Please select at least one task or room', 'warning');
        return;
    }

    let tasksToInsert = [];

    if (selectedPresets.length > 0) {
        // Format tasks with room if room is selected
        tasksToInsert = selectedPresets.map(task => {
            return selectedRoom ? `${task} | ${selectedRoom}` : task;
        });
    } else if (selectedRoom) {
        // Only room selected, just add the room name
        tasksToInsert = [selectedRoom];
    }

    const presetsText = tasksToInsert.join('\n');

    if (currentText) {
        taskDescription.value = currentText + '\n' + presetsText;
    } else {
        taskDescription.value = presetsText;
    }

    // Clear selections
    const count = tasksToInsert.length;
    clearSelectedPresets();
    closePresetModal();

    // Show success feedback
    showAlert(`${count} task(s) added!`, 'success');

    // Save draft
    saveDraftTask();
}

// Filter Presets by Search
function filterPresets() {
    const searchTerm = document.getElementById('presetSearch').value.toLowerCase();
    const allButtons = document.querySelectorAll('.preset-btn');
    const allSubcategories = document.querySelectorAll('.preset-subcategory');
    const allCategories = document.querySelectorAll('.preset-category');

    if (!searchTerm) {
        // Show all
        allButtons.forEach(btn => btn.style.display = '');
        allSubcategories.forEach(sub => sub.style.display = '');
        allCategories.forEach(cat => cat.style.display = '');
        return;
    }

    // Filter buttons
    allButtons.forEach(btn => {
        const text = btn.textContent.toLowerCase();
        const onclick = btn.getAttribute('onclick').toLowerCase();

        if (text.includes(searchTerm) || onclick.includes(searchTerm)) {
            btn.style.display = '';
        } else {
            btn.style.display = 'none';
        }
    });

    // Hide empty subcategories
    allSubcategories.forEach(sub => {
        const visibleButtons = sub.querySelectorAll('.preset-btn:not([style*="display: none"])');
        sub.style.display = visibleButtons.length > 0 ? '' : 'none';
    });

    // Hide empty categories
    allCategories.forEach(cat => {
        const visibleSubs = cat.querySelectorAll('.preset-subcategory:not([style*="display: none"])');
        const visibleRoomButtons = cat.querySelectorAll('.room-buttons .preset-btn:not([style*="display: none"])');

        cat.style.display = (visibleSubs.length > 0 || visibleRoomButtons.length > 0) ? '' : 'none';

        // Auto-expand categories with results
        if (visibleSubs.length > 0 || visibleRoomButtons.length > 0) {
            const content = cat.querySelector('.category-content');
            const header = cat.querySelector('.category-header');
            content.classList.add('show');
            header.classList.add('active');
        }
    });
}

// ============================================
// AUTOCOMPLETE FUNCTIONALITY
// ============================================

let autocompleteIndex = -1;

// Setup autocomplete on task textarea
function setupTaskAutocomplete() {
    const taskTextarea = document.getElementById('taskDescription');

    if (!taskTextarea) return;

    // Create autocomplete dropdown
    const wrapper = document.createElement('div');
    wrapper.className = 'task-input-wrapper';
    taskTextarea.parentNode.insertBefore(wrapper, taskTextarea);
    wrapper.appendChild(taskTextarea);

    const dropdown = document.createElement('div');
    dropdown.id = 'taskAutocomplete';
    dropdown.className = 'autocomplete-dropdown';
    wrapper.appendChild(dropdown);

    // Listen for input
    taskTextarea.addEventListener('input', handleAutocompleteInput);
    taskTextarea.addEventListener('keydown', handleAutocompleteKeyboard);

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// Handle Autocomplete Input
function handleAutocompleteInput(e) {
    const textarea = e.target;
    const dropdown = document.getElementById('taskAutocomplete');
    const value = textarea.value;

    // Get current line being typed
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const currentLine = textBeforeCursor.split('\n').pop();

    if (currentLine.length < 2) {
        dropdown.classList.remove('show');
        return;
    }

    // Search task history with cleaned text
    const matches = taskHistory.filter(task =>
        task.toLowerCase().includes(currentLine.toLowerCase())
    ).slice(0, 8); // Show top 8 matches

    if (matches.length === 0) {
        dropdown.classList.remove('show');
        return;
    }

    // Show suggestions WITHOUT timestamps or system messages
    dropdown.innerHTML = matches.map((task, index) => `
        <div class="autocomplete-item" data-index="${index}" onclick="selectAutocomplete(\`${task.replace(/`/g, '\\`')}\`)">
            <span>${task}</span>
            <span class="autocomplete-meta">Previously used</span>
        </div>
    `).join('');

    dropdown.classList.add('show');
    autocompleteIndex = -1;
}

// Handle Autocomplete Keyboard Navigation
function handleAutocompleteKeyboard(e) {
    const dropdown = document.getElementById('taskAutocomplete');
    if (!dropdown.classList.contains('show')) return;

    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocompleteIndex = Math.min(autocompleteIndex + 1, items.length - 1);
        updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocompleteIndex = Math.max(autocompleteIndex - 1, 0);
        updateAutocompleteSelection(items);
    } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
        e.preventDefault();
        items[autocompleteIndex].click();
    } else if (e.key === 'Escape') {
        dropdown.classList.remove('show');
    }
}

// Update Autocomplete Selection Visual
function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        if (index === autocompleteIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

// Select Autocomplete Item
function selectAutocomplete(taskText) {
    const textarea = document.getElementById('taskDescription');
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Get text before and after cursor
    const textBefore = value.substring(0, cursorPos);
    const textAfter = value.substring(cursorPos);

    // Replace current line with selected task
    const lines = textBefore.split('\n');
    lines[lines.length - 1] = taskText;

    textarea.value = lines.join('\n') + textAfter;

    // Move cursor to end of inserted text
    const newCursorPos = lines.join('\n').length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();

    // Hide dropdown
    document.getElementById('taskAutocomplete').classList.remove('show');

    // Save draft
    saveDraftTask();
}

// Load Task History from Backend
async function loadTaskHistory() {
    const idBadge = document.getElementById('idBadge').value.trim();
    if (!idBadge) return;

    try {
        const response = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
        if (response.ok) {
            const data = await response.json();

            // Extract and clean tasks from attendance history
            const tasks = new Set();

            if (data.attendanceHistory) {
                data.attendanceHistory.forEach(record => {
                    if (record.tasksCompleted) {
                        // Split by newlines and clean each task
                        const taskLines = record.tasksCompleted.split('\n')
                            .map(line => line.trim())
                            .filter(line => line.length > 0);

                        taskLines.forEach(task => {
                            const cleanTask = cleanTaskText(task);
                            if (cleanTask && cleanTask.length > 5) {
                                tasks.add(cleanTask);
                            }
                        });
                    }
                });
            }

            // Convert to array and sort (most recent first, but you can change sorting)
            taskHistory = Array.from(tasks);

            // Store in localStorage for offline access
            localStorage.setItem(`taskHistory_${idBadge}`, JSON.stringify(taskHistory));

            console.log('Task history loaded:', taskHistory.length, 'unique tasks');
        }
    } catch (error) {
        console.error('Failed to load task history:', error);

        // Try to load from localStorage
        const stored = localStorage.getItem(`taskHistory_${idBadge}`);
        if (stored) {
            taskHistory = JSON.parse(stored);
        }
    }
}

function cleanTaskText(task) {
    if (!task || typeof task !== 'string') return '';

    let cleaned = task.trim();

    // REMOVE ALL TIMESTAMP PATTERNS

    // Pattern 1: [HH:MM:SS] at start
    cleaned = cleaned.replace(/^\[?\d{1,2}:\d{2}:\d{2}\]?\s*/g, '');

    // Pattern 2: (HH:MM:SS) at start
    cleaned = cleaned.replace(/^\(\d{1,2}:\d{2}:\d{2}\)\s*/g, '');

    // Pattern 3: [HH:MM:SS] anywhere in text
    cleaned = cleaned.replace(/\[\d{1,2}:\d{2}:\d{2}\]/g, '');

    // Pattern 4: (HH:MM:SS) anywhere in text
    cleaned = cleaned.replace(/\(\d{1,2}:\d{2}:\d{2}\)/g, '');

    // Pattern 5: HH:MM:SS at start (without brackets)
    cleaned = cleaned.replace(/^\d{1,2}:\d{2}:\d{2}\s*/g, '');

    // Pattern 6: Timestamp at end
    cleaned = cleaned.replace(/\s*\d{1,2}:\d{2}:\d{2}\s*$/g, '');

    // Pattern 7: Time with AM/PM (e.g., "07:07 AM", "10:30 PM")
    cleaned = cleaned.replace(/\d{1,2}:\d{2}\s*[AP]M/gi, '');

    // SKIP SYSTEM MESSAGES ENTIRELY

    const systemKeywords = [
        'AUTO TIME-OUT',
        'AUTO TIME OUT',
        'AUTO TIMED OUT',
        'ADMIN CORRECTION',
        'ADMIN CORRECTED',
        'ADMIN MANUAL ENTRY',
        '[ADMIN',
        'ADMIN:',
        '=== Tasks Completed',
        '=== Additional Tasks',
        '=== Tasks Added',
        'Student did not time out',
        'Added during time-out',
        'Completed:',
        'Added at:',
        'Logged at:'
    ];

    for (const keyword of systemKeywords) {
        if (cleaned.toUpperCase().includes(keyword.toUpperCase())) {
            return ''; // Skip this line entirely
        }
    }

    // ===================================
    // REMOVE FORMATTING MARKERS
    // ===================================

    // Remove bullet points, numbering, dashes at start
    cleaned = cleaned.replace(/^[•\-\*\d+.)\]\s]+/, '').trim();

    // Remove "Completed: HH:MM AM/PM" patterns
    cleaned = cleaned.replace(/\s*Completed:\s*\d{1,2}:\d{2}\s*[AP]M\s*/gi, '');

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // ===================================
    // FINAL VALIDATION
    // ===================================

    // Must be at least 5 characters
    if (cleaned.length < 5) return '';

    // Must not be just a timestamp
    if (/^\d{1,2}:\d{2}/.test(cleaned)) return '';

    return cleaned;
}

// Initialize autocomplete when page loads
document.addEventListener('DOMContentLoaded', function() {
    // ... existing initialization code ...

    // Setup autocomplete after a short delay to ensure DOM is ready
    setTimeout(() => {
        setupTaskAutocomplete();
    }, 500);
});


// Global variables for schedule tracking
let studentScheduleData = null;
let earlyArrivalData = null;

// Check for early arrival
async function checkEarlyArrival(studentData) {
    const idBadge = elements.idBadge().value.trim();

    if (!idBadge || !isValidIdBadge(idBadge)) {
        hideScheduleInfo();
        earlyArrivalData = null;
        return;
    }

    if (!studentData || studentData.currentStatus !== 'TIMED_IN') {
        hideScheduleInfo();
        earlyArrivalData = null;
        return;
    }

    try {
        // Get student schedule
        const studentsResponse = await fetch(`${API_BASE_URL}/students/all`);
        if (!studentsResponse.ok) {
            hideScheduleInfo();
            earlyArrivalData = null;
            return;
        }

        const allStudents = await studentsResponse.json();
        const currentStudent = allStudents.find(s => s.idBadge === idBadge);

        if (!currentStudent || !currentStudent.scheduleActive) {
            hideScheduleInfo();
            earlyArrivalData = null;
            return;
        }

        // Get current session
        const sessionResponse = await fetch(`${API_BASE_URL}/attendance/session/${idBadge}`);
        if (!sessionResponse.ok) {
            hideScheduleInfo();
            earlyArrivalData = null;
            return;
        }

        const sessionData = await sessionResponse.json();

        // Store the CORRECT recordId from session
        const currentRecordId = sessionData.recordId;

        const timeIn = new Date(sessionData.timeIn);
        const timeInTime = timeIn.toTimeString().split(' ')[0];

        const scheduledStart = currentStudent.scheduledStartTime;
        const scheduledEnd = currentStudent.scheduledEndTime;
        const gracePeriod = currentStudent.gracePeriodMinutes || 5;

        const [schedHours, schedMinutes] = scheduledStart.split(':').map(Number);
        const [actualHours, actualMinutes] = timeInTime.split(':').map(Number);

        const scheduledStartMinutes = (schedHours * 60) + schedMinutes - gracePeriod;
        const actualTimeMinutes = (actualHours * 60) + actualMinutes;

        // Check if arrived early
        if (actualTimeMinutes < scheduledStartMinutes) {
            const earlyByMinutes = scheduledStartMinutes - actualTimeMinutes;

            if (earlyByMinutes > 45) {
                // Store early arrival data with student ID for validation
                earlyArrivalData = {
                    scheduledTime: scheduledStart,
                    scheduledEnd: scheduledEnd,
                    actualTime: timeInTime,
                    earlyMinutes: earlyByMinutes,
                    recordId: currentRecordId,
                    studentName: currentStudent.fullName,
                    studentId: idBadge // CRITICAL: Store student ID for validation
                };

                // Check existing request with correct recordId
                await checkAndShowOverrideButton(idBadge, currentRecordId);
            } else {
                hideScheduleInfo();
                earlyArrivalData = null;
            }
        } else {
            hideScheduleInfo();
            earlyArrivalData = null;
        }

    } catch (error) {
        console.error('Error checking early arrival:', error);
        hideScheduleInfo();
        earlyArrivalData = null;
    }
}

async function checkAndShowOverrideButton(idBadge, recordId) {
    // Validate we still have early arrival data
    if (!earlyArrivalData || earlyArrivalData.recordId !== recordId) {
        hideScheduleInfo();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/schedule-override/my-requests/${idBadge}`);

        if (response.ok) {
            const data = await response.json();

            if (data.success && data.requests && data.requests.length > 0) {
                // Find request for CURRENT record ONLY (must match recordId exactly)
                const currentRequest = data.requests.find(req =>
                    req.attendanceRecordId === recordId
                );

                if (currentRequest) {
                    // Has a request - show status button
                    showOverrideStatusButton(currentRequest);
                    return;
                }
            }
        }

        // No matching request found - show the REQUEST button (not status)
        showScheduleInfo(earlyArrivalData);

    } catch (error) {
        console.error('Error checking override request:', error);
        showScheduleInfo(earlyArrivalData);
    }
}

function showOverrideStatusButton(request) {
    const indicator = document.getElementById('earlyArrivalIndicator');

    if (!indicator) return;

    // Validate that this request belongs to current student's session
    const currentIdBadge = elements.idBadge().value.trim();
    if (!earlyArrivalData ||
        earlyArrivalData.recordId !== request.attendanceRecordId ||
        !currentIdBadge) {
        console.log('Request does not match current session, hiding');
        hideScheduleInfo();
        return;
    }

    // Clear existing content
    indicator.classList.remove('d-none');

    // Build button based on status
    let buttonHtml = '';

    if (request.status === 'PENDING') {
        // ⏳ PENDING - Yellow/Orange with pulse animation
        buttonHtml = `
            <button class="status-btn status-pending" onclick="viewRequestDetails(${request.id})" title="Request Pending - Click for details">
                <div class="status-icon pulse">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <span class="status-text">
                    <strong>Request Pending</strong>
                    <small>Waiting for admin review</small>
                </span>
            </button>
        `;
    } else if (request.status === 'APPROVED') {
        // ✅ APPROVED - Green with success animation
        buttonHtml = `
            <button class="status-btn status-approved" onclick="viewRequestDetails(${request.id})" title="Request Approved! Click for details">
                <div class="status-icon bounce">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <span class="status-text">
                    <strong>✅ Request Approved!</strong>
                    <small>Early hours counted - Click for details</small>
                </span>
            </button>
        `;
    } else if (request.status === 'REJECTED') {
        // ❌ REJECTED - Red with shake animation
        buttonHtml = `
            <button class="status-btn status-rejected" onclick="viewRequestDetails(${request.id})" title="Request Rejected - Click to view reason">
                <div class="status-icon shake">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="icon">
                        <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <span class="status-text">
                    <strong>❌ Request Rejected</strong>
                    <small>Click to view admin's reason</small>
                </span>
            </button>
        `;
    }

    indicator.innerHTML = `<div class="override-status-container">${buttonHtml}</div>`;
}

function viewRequestDetails(requestId) {
    const idBadge = elements.idBadge().value.trim();

    showLoading();

    fetch(`${API_BASE_URL}/schedule-override/request/${requestId}`)
        .then(response => response.json())
        .then(data => {
            hideLoading();

            if (data.success && data.request) {
                displaySingleRequestModal(data.request);
            } else {
                showAlert('Failed to load request details', 'error');
            }
        })
        .catch(error => {
            hideLoading();
            showAlert('Network error: ' + error.message, 'error');
        });
}

function displaySingleRequestModal(req) {
    const statusColor = req.status === 'APPROVED' ? '#10b981' :
                      req.status === 'REJECTED' ? '#ef4444' : '#f59e0b';

    const statusIcon = req.status === 'APPROVED' ? '✅' :
                      req.status === 'REJECTED' ? '❌' : '⏳';

    Swal.fire({
        title: `${statusIcon} Request #${req.id}`,
        html: `
            <div style="text-align: left; padding: 1rem;">

                <!-- Status Banner -->
                <div style="background: ${statusColor}; color: white; padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; text-align: center;">
                    <h3 style="margin: 0; font-size: 1.3rem;">${req.status}</h3>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.9;">
                        ${req.status === 'PENDING' ? 'Waiting for admin review' :
                          req.status === 'APPROVED' ? 'Your early hours have been counted!' :
                          'Normal schedule rules apply'}
                    </p>
                </div>

                <!-- Details Card -->
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Scheduled</div>
                            <div style="font-size: 1.1rem; font-weight: 600;">${formatTimeShort(req.scheduledTime)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Your Time In</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: #dc2626;">${formatTimeShort(req.actualTime)}</div>
                        </div>
                    </div>
                    <div style="background: white; padding: 0.75rem; border-radius: 8px; text-align: center;">
                        <strong style="color: #dc2626;">Early by ${req.earlyMinutes} minutes</strong>
                    </div>
                </div>

                <!-- Your Reason -->
                <div style="background: white; padding: 1rem; border-radius: 12px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem;">Your Reason:</div>
                    <div style="font-size: 0.9rem; line-height: 1.6; color: var(--text-primary);">${req.reason}</div>
                </div>

                ${req.status === 'APPROVED' && req.adminResponse ? `
                    <!-- Admin Approval Message -->
                    <div style="background: #d1fae5; padding: 1rem; border-radius: 12px; border-left: 4px solid #10b981;">
                        <div style="font-weight: 700; color: #065f46; margin-bottom: 0.5rem;">
                            💬 Admin's Message:
                        </div>
                        <div style="font-size: 0.9rem; color: #047857; line-height: 1.6;">
                            "${req.adminResponse}"
                        </div>
                        <div style="font-size: 0.8rem; color: #059669; margin-top: 0.75rem;">
                            — ${req.reviewedBy} • ${formatDateTime(req.reviewedAt)}
                        </div>
                    </div>
                ` : ''}

                ${req.status === 'REJECTED' && req.adminResponse ? `
                    <!-- Admin Rejection Message -->
                    <div style="background: #fee2e2; padding: 1rem; border-radius: 12px; border-left: 4px solid #ef4444;">
                        <div style="font-weight: 700; color: #991b1b; margin-bottom: 0.5rem;">
                            💬 Admin's Reason:
                        </div>
                        <div style="font-size: 0.9rem; color: #7f1d1d; line-height: 1.6;">
                            "${req.adminResponse}"
                        </div>
                        <div style="font-size: 0.8rem; color: #991b1b; margin-top: 0.75rem;">
                            — ${req.reviewedBy} • ${formatDateTime(req.reviewedAt)}
                        </div>
                    </div>
                ` : ''}

                ${req.status === 'PENDING' ? `
                    <!-- Pending Info -->
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 12px; border-left: 4px solid #f59e0b;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 0.5rem;">
                            ⏳ Pending Review
                        </div>
                        <div style="font-size: 0.85rem; color: #78350f; line-height: 1.6;">
                            Your request was submitted on ${formatDateTime(req.requestedAt)}. Admin will review it soon.
                        </div>
                    </div>
                ` : ''}

            </div>
        `,
        width: '600px',
        confirmButtonText: 'Close',
        confirmButtonColor: statusColor
    });
}

function addOverrideRequestsButton() {
    const modalActions = document.querySelector('#dashboardModal .modal-actions');

    if (!document.getElementById('viewOverrideRequestsBtn')) {
        const requestsBtn = document.createElement('button');
        requestsBtn.id = 'viewOverrideRequestsBtn';
        requestsBtn.className = 'btn btn-info';
        requestsBtn.innerHTML = '📋 Override Requests';
        requestsBtn.onclick = () => viewMyOverrideRequests();

        // Insert before close button
        const closeBtn = modalActions.querySelector('button:last-child');
        modalActions.insertBefore(requestsBtn, closeBtn);
    }
}

// Show schedule information box
function showScheduleInfo(data) {
    const indicator = document.getElementById('earlyArrivalIndicator');

    if (!indicator || !data) return;

    // Show the request button (for students who haven't requested yet)
    indicator.innerHTML = `
        <button class="info-icon-btn" onclick="showEarlyArrivalModal()" title="Important: Early Arrival Policy">
            <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <line x1="12" y1="16" x2="12" y2="12" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="8" x2="12.01" y2="8" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="indicator-text">You arrived early - Click for info</span>
        </button>
    `;

    indicator.classList.remove('d-none');
}

/**
 * Hide schedule information box
 */
function hideScheduleInfo() {
    const indicator = document.getElementById('earlyArrivalIndicator');

    if (indicator) {
        indicator.classList.add('d-none');
        indicator.innerHTML = '';
    }

    earlyArrivalData = null;
}

function showEarlyArrivalModal() {
    // VALIDATION: Check if we have early arrival data
    if (!earlyArrivalData) {
        console.warn('No early arrival data available');
        hideScheduleInfo();
        return;
    }

    // VALIDATION: Check if student is still timed in
    const idBadge = elements.idBadge().value.trim();
    if (!idBadge || !isValidIdBadge(idBadge)) {
        console.warn('Invalid ID badge');
        hideScheduleInfo();
        return;
    }

    const modal = document.getElementById('earlyArrivalModal');

    // Update modal content
    document.getElementById('modalScheduledTime').textContent =
        `${formatTimeOnly(parseTimeString(earlyArrivalData.scheduledTime))} - ${formatTimeOnly(parseTimeString(earlyArrivalData.scheduledEnd))}`;

    document.getElementById('modalActualTime').textContent =
        formatTimeOnly(parseTimeString(earlyArrivalData.actualTime));

    const hours = Math.floor(earlyArrivalData.earlyMinutes / 60);
    const minutes = earlyArrivalData.earlyMinutes % 60;
    const timeText = hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min` : `${minutes} minutes`;
    document.getElementById('modalEarlyMinutes').textContent = timeText;

    // Show/hide emergency card based on early time (45+ minutes)
    const emergencyCard = document.getElementById('emergencyOverrideCard');
    if (emergencyCard) {
        if (earlyArrivalData.earlyMinutes >= 45) {
            emergencyCard.style.display = 'block';
        } else {
            emergencyCard.style.display = 'none';
        }
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeEarlyArrivalModal() {
    const modal = document.getElementById('earlyArrivalModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

function openOverrideRequest() {
    closeEarlyArrivalModal();
    requestScheduleOverride();
}

/**
 * Request schedule override
 */
function requestScheduleOverride() {
    if (!earlyArrivalData) {
        showAlert('No early arrival detected', 'error');
        return;
    }

    const modal = document.getElementById('scheduleOverrideModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    document.getElementById('overrideReason').focus();
}

/**
 * Close schedule override modal
 */
function closeScheduleOverrideModal() {
    const modal = document.getElementById('scheduleOverrideModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    document.getElementById('scheduleOverrideForm').reset();
}

/**
 * Submit schedule override request
 */
async function submitScheduleOverride(event) {
    event.preventDefault();

    const idBadge = elements.idBadge().value.trim();
    const reason = document.getElementById('overrideReason').value.trim();

    if (reason.length < 20) {
        showAlert('Please provide a detailed reason (minimum 20 characters)', 'warning');
        return;
    }

    if (!earlyArrivalData) {
        showAlert('No early arrival data found', 'error');
        return;
    }

    showLoading();
    closeScheduleOverrideModal();

    try {
        const requestData = {
            idBadge: idBadge,
            recordId: earlyArrivalData.recordId,
            scheduledTime: earlyArrivalData.scheduledTime.substring(0, 5),
            actualTime: earlyArrivalData.actualTime.substring(0, 5),
            earlyMinutes: earlyArrivalData.earlyMinutes,
            reason: reason
        };

        console.log('Submitting override request:', requestData);

        const response = await fetch(`${API_BASE_URL}/schedule-override/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        hideLoading();

        if (response.ok && data.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Request Submitted!',
                html: `
                    <div style="text-align: left; padding: 1rem;">
                        <p style="margin-bottom: 1rem;"><strong>Your schedule override request has been sent to admin.</strong></p>
                        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                            <p style="margin: 0.5rem 0;"><strong>Request ID:</strong> #${data.request.id}</p>
                            <p style="margin: 0.5rem 0;"><strong>Early by:</strong> ${earlyArrivalData.earlyMinutes} minutes</p>
                            <p style="margin: 0.5rem 0;"><strong>Status:</strong> <span style="color: #f59e0b; font-weight: 600;">⏳ PENDING</span></p>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted);">
                            You'll be notified when admin reviews your request. Check your requests status in the dashboard.
                        </p>
                    </div>
                `,
                confirmButtonText: 'OK',
                confirmButtonColor: '#10b981'
            });

            const indicator = document.getElementById('earlyArrivalIndicator');
            if (indicator) {
                indicator.classList.add('d-none');
            }

            earlyArrivalData = null;

        } else {
            showAlert(data.message || 'Failed to submit request', 'error');
        }

    } catch (error) {
        hideLoading();
        console.error('Schedule override error:', error);
        showAlert('Network error: ' + error.message, 'error');
    }
}

async function checkPendingOverrideRequests(idBadge) {
    try {
        const response = await fetch(`${API_BASE_URL}/schedule-override/my-pending-requests/${idBadge}`);

        if (response.ok) {
            const data = await response.json();

            if (data.success && data.pendingRequests && data.pendingRequests.length > 0) {
                showPendingRequestNotification(data.pendingRequests);
            }
        }
    } catch (error) {
        console.error('Failed to check pending requests:', error);
    }
}

function showPendingRequestNotification(requests) {
    const count = requests.length;

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: `You have ${count} pending request${count !== 1 ? 's' : ''}`,
        text: 'Check your dashboard to view details',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
    });
}

function showPendingRequestsNotification(requests) {
    const count = requests.length;
    const latest = requests[0]; // Most recent request

    Swal.fire({
        icon: 'info',
        title: `You have ${count} pending request${count !== 1 ? 's' : ''}`,
        html: `
            <div style="text-align: left; padding: 1rem;">
                <p style="margin-bottom: 1rem;">Your schedule override request is being reviewed:</p>
                <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                    <p style="margin: 0.5rem 0;"><strong>Request #${latest.id}</strong></p>
                    <p style="margin: 0.5rem 0;"><strong>Early by:</strong> ${latest.earlyMinutes} minutes</p>
                    <p style="margin: 0.5rem 0;"><strong>Status:</strong> <span style="color: #f59e0b; font-weight: 600;">PENDING</span></p>
                    <p style="margin: 0.5rem 0; font-size: 0.85rem; color: var(--text-muted);">Submitted: ${formatDateTime(latest.requestedAt)}</p>
                </div>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);">Admin will review shortly.</p>
            </div>
        `,
        confirmButtonText: 'OK',
        confirmButtonColor: '#3b82f6'
    });
}

async function viewMyOverrideRequests() {
    const idBadge = elements.idBadge().value.trim();

    if (!validateIdBadge(idBadge)) {
        showAlert('Please enter your ID badge first', 'warning');
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/schedule-override/my-requests/${idBadge}`);

        if (!response.ok) {
            throw new Error('Failed to load requests');
        }

        const data = await response.json();

        hideLoading();

        if (data.success && data.requests && data.requests.length > 0) {
            displayMyOverrideRequests(data.requests);
        } else {
            Swal.fire({
                icon: 'info',
                title: 'No Requests Found',
                text: 'You have not submitted any schedule override requests yet.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3b82f6'
            });
        }

    } catch (error) {
        hideLoading();
        showAlert('Failed to load requests: ' + error.message, 'error');
    }
}

function displayMyOverrideRequests(requests) {
    requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    const requestsHtml = requests.map(req => {
        const statusColor = req.status === 'APPROVED' ? '#10b981' :
                          req.status === 'REJECTED' ? '#ef4444' : '#f59e0b';

        const statusIcon = req.status === 'APPROVED' ? '✓' :
                          req.status === 'REJECTED' ? '✗' : '⏳';

        return `
            <div style="background: var(--bg-secondary); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <strong style="font-size: 1.1rem;">Request #${req.id}</strong>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                            Submitted: ${formatDateTime(req.requestedAt)}
                        </p>
                    </div>
                    <span style="background: ${statusColor}; color: white; padding: 0.35rem 0.85rem; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">
                        ${statusIcon} ${req.status}
                    </span>
                </div>

                <div style="background: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Scheduled Time</div>
                            <div style="font-size: 1rem; font-weight: 600;">${formatTimeShort(req.scheduledTime)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">Your Time In</div>
                            <div style="font-size: 1rem; font-weight: 600; color: #dc2626;">${formatTimeShort(req.actualTime)}</div>
                        </div>
                    </div>
                    <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                        <strong>Early by: ${req.earlyMinutes} minutes</strong>
                    </div>
                </div>

                <details style="margin-bottom: 1rem;">
                    <summary style="cursor: pointer; font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); padding: 0.5rem; background: white; border-radius: 6px;">
                        📝 View Your Reason
                    </summary>
                    <div style="padding: 0.75rem; background: white; border-radius: 6px; margin-top: 0.5rem; font-size: 0.85rem; line-height: 1.6;">
                        ${req.reason}
                    </div>
                </details>

                ${req.status === 'PENDING' ? `
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; font-size: 0.85rem; color: #92400e;">
                        ⏳ <strong>Waiting for admin review...</strong>
                    </div>
                ` : ''}

                ${req.status === 'APPROVED' ? `
                    <div style="background: #d1fae5; padding: 1rem; border-radius: 8px;">
                        <div style="font-weight: 700; color: #065f46; margin-bottom: 0.5rem;">
                            ✅ Request Approved!
                        </div>
                        <div style="font-size: 0.85rem; color: #065f46;">
                            Your early hours have been counted for this session.
                        </div>
                        ${req.reviewedBy ? `
                            <div style="font-size: 0.8rem; color: #047857; margin-top: 0.5rem;">
                                Reviewed by ${req.reviewedBy} on ${formatDateTime(req.reviewedAt)}
                            </div>
                        ` : ''}
                        ${req.adminResponse ? `
                            <div style="background: white; padding: 0.75rem; border-radius: 6px; margin-top: 0.75rem; font-size: 0.85rem; color: #065f46;">
                                <strong>Admin said:</strong><br>
                                "${req.adminResponse}"
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                ${req.status === 'REJECTED' ? `
                    <div style="background: #fee2e2; padding: 1rem; border-radius: 8px;">
                        <div style="font-weight: 700; color: #991b1b; margin-bottom: 0.5rem;">
                            ❌ Request Rejected
                        </div>
                        <div style="font-size: 0.85rem; color: #991b1b;">
                            Normal schedule rules apply - early hours were not counted.
                        </div>
                        ${req.reviewedBy ? `
                            <div style="font-size: 0.8rem; color: #7f1d1d; margin-top: 0.5rem;">
                                Reviewed by ${req.reviewedBy} on ${formatDateTime(req.reviewedAt)}
                            </div>
                        ` : ''}
                        ${req.adminResponse ? `
                            <div style="background: white; padding: 0.75rem; border-radius: 6px; margin-top: 0.75rem; font-size: 0.85rem; color: #991b1b;">
                                <strong>Admin's reason:</strong><br>
                                "${req.adminResponse}"
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    Swal.fire({
        title: '📋 My Override Requests',
        html: `
            <div style="text-align: left; max-height: 500px; overflow-y: auto; padding: 0.5rem;">
                ${requestsHtml}
            </div>
        `,
        width: '650px',
        confirmButtonText: 'Close',
        confirmButtonColor: '#3b82f6'
    });
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return 'N/A';
    try {
        const date = new Date(dateTimeStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch {
        return dateTimeStr;
    }
}

function formatTimeShort(timeStr) {
    if (!timeStr) return 'N/A';
    try {
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    } catch {
        return timeStr;
    }
}

/**
 * Helper function to parse time string
 */
function parseTimeString(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
}

/**
 * Helper function to format time
 */
function formatTimeOnly(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

console.log('OJT Attendance System with TOTP Loaded');