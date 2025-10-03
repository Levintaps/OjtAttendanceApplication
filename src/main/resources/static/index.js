// Configuration
const API_BASE_URL = 'https://ojtattendanceapplication-production.up.railway.app/api';
const ADMIN_PASSWORD = 'Happy@Concentrix@2025!';
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
    dashboardCard: () => document.getElementById('dashboardCard'),
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

function setupIdInputListeners() {
    const idInput = elements.idBadge();

    idInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '');
        if (this.value.length > 4) {
            this.value = this.value.slice(0, 4);
        }
        hideValidationWarning();

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

        // TOTP is enabled, proceed with normal flow
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
    const verifyButton = modal.querySelector('#verifyTotpBtn');

    qrImage.src = setupData.qrCodeDataUrl;
    secretText.textContent = setupData.secret;

    currentTotpStudent = setupData;
    totpSetupInProgress = true;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Focus on TOTP code input
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
                <h3>🔐 Security Setup Required</h3>
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

    // Format input to numbers only
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

            // Refresh student status
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

        // Clear ID input
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
        return;
    }

    statusDisplay.classList.remove('d-none');
    statusDisplay.style.background = '';
    statusDisplay.style.border = '';

    if (studentData.currentStatus === 'TIMED_IN') {
        statusText.textContent = 'Currently Timed In';
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
    } else {
        stopTodayHoursTimer();
        statusText.textContent = 'Ready to Time In';
        statusText.style.color = 'var(--text-primary)';

        const totalHours = parseFloat(studentData.totalAccumulatedHours || 0);
        const requiredHours = studentData.requiredHours || 0;

        if (requiredHours > 0 && totalHours < requiredHours) {
            const remainingHours = requiredHours - totalHours;
            const estimatedDays = calculateEstimatedDays(remainingHours, studentData);
            statusTime.textContent = `Estimated ${estimatedDays} days to complete`;
        } else {
            statusTime.textContent = 'Ready for today\'s session';
        }

        timeInBtn.style.display = 'flex';
        timeOutBtn.style.display = 'none';
        isTaskLoggingEnabled = false;
    }
}

function calculateEstimatedDays(remainingHours, studentData) {
    if (remainingHours <= 0) return 0;

    // Calculate average daily hours from recent history
    let averageDailyHours = STANDARD_WORK_HOURS;

    if (studentData.attendanceHistory && studentData.attendanceHistory.length > 0) {
        // Get records from last 10 days
        const recentRecords = studentData.attendanceHistory.slice(0, 10);
        const totalRecentHours = recentRecords.reduce((sum, record) => {
            return sum + (parseFloat(record.totalHours) || 0);
        }, 0);

        if (recentRecords.length > 0) {
            averageDailyHours = totalRecentHours / recentRecords.length;
        }
    }

    // Use whichever is higher: standard hours or average (but minimum 4 hours)
    const hoursPerDay = Math.max(averageDailyHours, STANDARD_WORK_HOURS, 4);

    const estimatedDays = Math.ceil(remainingHours / hoursPerDay);
    return estimatedDays;
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

// Attendance Actions
async function performTimeIn() {
    const idBadge = document.getElementById('idBadge').value.trim();

    if (!validateIdBadge(idBadge)) return;
    if (actionCooldown) {
        showValidationWarning();
        return;
    }

    // Show TOTP input modal
    showTotpVerificationModal('TIME_IN');
}

function updateUIAfterTimeIn(data) {
    const statusText = elements.currentStatusText();
    const statusTime = elements.currentStatusTime();
    const timeInBtn = elements.timeInBtn();
    const timeOutBtn = elements.timeOutBtn();

    statusText.textContent = 'Currently Timed In';
    statusText.style.color = 'var(--success-color)';
    statusTime.textContent = `Since: ${formatTime(data.timeIn)}`;

    timeInBtn.style.display = 'none';
    timeOutBtn.style.display = 'flex';
    currentTimeInTimestamp = new Date(data.timeIn);
    startTodayHoursTimer();
}

async function performTimeOut() {
    const idBadge = document.getElementById('idBadge').value.trim();

    if (!validateIdBadge(idBadge)) return;
    if (actionCooldown) {
        showValidationWarning();
        return;
    }

    // Check for existing tasks first
    const existingTasks = await getCurrentSessionTasks(idBadge);

    if (existingTasks.length > 0) {
        showTaskSummaryModalWithTotp(existingTasks);
    } else {
        showTotpVerificationModal('TIME_OUT');
    }
}

function createTotpVerifyModal() {
    const modal = document.createElement('div');
    modal.id = 'totpVerifyModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="closeTotpVerifyModal()">×</button>
            <div class="modal-header">
                <h3>Time In - Enter Code</h3>
                <p>Enter the 6-digit code from your Google Authenticator app</p>
            </div>
            <form id="totpActionForm" onsubmit="submitWithTotp(event)">
                <div class="form-group">
                    <label for="totpActionCode">Authenticator Code:</label>
                    <input type="text" id="totpActionCode" maxlength="6" placeholder="000000"
                        style="text-align: center; font-size: 2rem; letter-spacing: 0.5em; font-weight: 700;" required>
                </div>
                <div id="totpTasksSection" style="display: none;">
                    <div class="form-group">
                        <label for="totpTasksCompleted">Tasks Completed (for Time Out):</label>
                        <textarea id="totpTasksCompleted" placeholder="Describe your tasks and activities..."></textarea>
                    </div>
                </div>
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

async function submitWithTotp(event) {
    event.preventDefault();

    const idBadge = document.getElementById('idBadge').value.trim();
    const totpCode = document.getElementById('totpActionCode').value.trim();
    const modal = document.getElementById('totpVerifyModal');
    const action = modal.dataset.action;

    if (totpCode.length !== 6) {
        showAlert('Please enter a valid 6-digit code', 'error');
        return;
    }

    let tasksCompleted = '';
    if (action === 'TIME_OUT') {
        tasksCompleted = document.getElementById('totpTasksCompleted').value.trim();
        if (!tasksCompleted || tasksCompleted.length < 10) {
            showAlert('Please provide detailed task description (minimum 10 characters)', 'error');
            return;
        }
    }

    showLoading();
    closeTotpVerifyModal();
    setActionCooldown();

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/log-with-totp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idBadge: idBadge,
                totpCode: totpCode,
                tasksCompleted: tasksCompleted
            })
        });

        const data = await response.json();

        if (response.ok) {
            if (action === 'TIME_IN') {
                showAlert(`Welcome ${data.studentName}! Timed in successfully at ${formatTime(data.timeIn)}. Have a productive day!`, 'success');
                updateUIAfterTimeIn(data);
            } else {
                handleSuccessfulTimeOut(data);
            }
        } else {
            showAlert(data.message || 'Authentication failed', 'error');
            // Re-show modal if TOTP was wrong
            if (data.message && data.message.includes('Invalid TOTP')) {
                setTimeout(() => showTotpVerificationModal(action), 1000);
            }
        }

    } catch (error) {
        showAlert('Network error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showTotpVerificationModal(action) {
    const modal = document.getElementById('totpVerifyModal') || createTotpVerifyModal();
    const actionText = action === 'TIME_IN' ? 'Time In' : 'Time Out';

    modal.querySelector('.modal-header h3').textContent = `${actionText} - Enter Code`;
    modal.querySelector('.modal-header p').textContent = 'Enter the 6-digit code from your Google Authenticator app';

    modal.dataset.action = action;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    modal.querySelector('#totpActionCode').focus();
}

async function submitTimeOut() {
    const idBadge = elements.idBadge().value.trim();
    const tasksCompleted = document.getElementById('tasksCompleted').value.trim();

    if (!validateTimeOutForm(tasksCompleted)) return;

    showLoading();
    closeTaskModal();
    setActionCooldown();

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idBadge: idBadge, tasksCompleted: tasksCompleted })
        });

        const data = await response.json();

        if (response.ok) {
            handleSuccessfulTimeOut(data);
        } else {
            handleTimeOutError(data);
        }

    } catch (error) {
        handleTimeOutError({ message: 'Network error. Please try again.' });
    } finally {
        hideLoading();
        pendingTimeOut = false;
    }
}

function closeTotpVerifyModal() {
    const modal = document.getElementById('totpVerifyModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        document.getElementById('totpActionForm').reset();
        document.getElementById('totpTasksSection').style.display = 'none';
    }
}

function showTaskSummaryModalWithTotp(tasks) {
    showTotpVerificationModal('TIME_OUT');

    // Show tasks section
    const tasksSection = document.getElementById('totpTasksSection');
    tasksSection.style.display = 'block';

    const modal = document.getElementById('totpVerifyModal');
    const header = modal.querySelector('.modal-header p');
    header.innerHTML = `You've logged ${tasks.length} task(s) today. Add any missing tasks before timing out.`;
}

function handleSuccessfulTimeOut(data) {
    lastAttendanceAction = {
        idBadge: elements.idBadge().value.trim(),
        status: 'TIMED_OUT',
        timestamp: Date.now()
    };

    const breakMessage = data.breakDeducted ? ' (1hr lunch break deducted)' : '';
    const overtimeMessage = data.overtimeHours > 0 ? ` including ${data.overtimeHours}h overtime` : '';

    showAlert(`Great work, ${data.studentName}! Timed out at ${formatTime(data.timeOut)}. Total: ${data.totalHours}h${breakMessage}${overtimeMessage}`, 'success');

    const studentData = { currentStatus: 'TIMED_OUT', attendanceHistory: [{ timeOut: data.timeOut }] };
    updateButtonStates(studentData);

    clearIdInput();
    clearTaskInput();
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
        document.getElementById('taskDescription').value = '';
        document.getElementById('taskDescription').focus();
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
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

        const requestBody = {
            idBadge: idBadge,
            taskDescription: taskDescription,
            completedAt: completedAt,
            addedDuringTimeout: false
        };

        const response = await fetch(`${API_BASE_URL}/tasks/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            try {
                const updatedDashboard = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
                if (updatedDashboard.ok) {
                    const dashboardData = await updatedDashboard.json();
                    const taskCount = dashboardData.todayTasksCount || 'N/A';
                    showAlert(`Task logged successfully! Total tasks today: ${taskCount}`, 'success');

                    // Update dashboard if it's open
                    if (elements.dashboardCard().classList.contains('show')) {
                        await viewDashboard();
                    }
                } else {
                    showAlert('Task logged successfully!', 'success');
                }
            } catch (dashboardError) {
                showAlert('Task logged successfully!', 'success');
            }
        } else {
            const errorText = await response.text();

            let errorMessage = 'Failed to log task';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            showAlert(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showAlert('Network error: Unable to connect to server', 'error');
    } finally {
        hideLoading();
    }
}

async function getCurrentSessionTasks(idBadge) {
    try {
        const response = await fetch(`${API_BASE_URL}/attendance/session/${idBadge}`);
        if (response.ok) {
            const dashboardResponse = await fetch(`${API_BASE_URL}/students/dashboard/${idBadge}`);
            if (dashboardResponse.ok) {
                const dashboardData = await dashboardResponse.json();
                return dashboardData.todayTasks || [];
            }
        }
        return [];
    } catch (error) {
        console.error('Failed to get current session tasks:', error);
        return [];
    }
}

// Registration and Authentication
async function submitRegistration() {
    const idBadge = document.getElementById('regIdBadge').value.trim();
    const fullName = document.getElementById('regFullName').value.trim();
    const school = document.getElementById('regSchool').value.trim();

    if (!validateRegistrationForm(idBadge, fullName, school)) return;

    showLoading();

    try {
        const response = await fetch(`${API_BASE_URL}/students/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idBadge, fullName, school })
        });

        const data = await response.json();

        if (response.ok) {
            handleSuccessfulRegistration(data, idBadge);
        } else {
            showAlert(data.message || 'Registration failed', 'error');
        }

    } catch (error) {
        showAlert('Registration failed. Please check connection and try again.', 'error');
    } finally {
        hideLoading();
    }
}

function handleSuccessfulRegistration(data, idBadge) {
    showAlert(`Welcome ${data.fullName}! Registration successful. You can now log attendance.`, 'success');
    closeRegisterModal();
    elements.idBadge().value = idBadge;
    elements.idBadge().focus();
    setTimeout(() => checkStudentStatus(idBadge), 500);
}

function checkAdminAccess() {
    showAdminModal();
}

function submitAdminAccess() {
    const adminPassword = document.getElementById('adminPassword').value.trim();

    if (!adminPassword) {
        showAlert('Please enter the administrator password', 'error');
        return;
    }

    if (adminPassword === ADMIN_PASSWORD) {
        closeAdminModal();
        showAlert('Welcome, Administrator! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'admin.html?authenticated=true&admin=System Administrator';
        }, 1500);
    } else {
        showAlert('Invalid admin password. Access denied.', 'error');
        document.getElementById('adminPassword').focus();
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

    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function displayDashboard(data) {
    const dashboardCard = elements.dashboardCard();
    const dashboardTitle = document.getElementById('dashboardTitle');
    const studentInfo = document.getElementById('studentInfo');
    const currentStatus = document.getElementById('currentStatus');
    const dynamicLabel = document.getElementById('dynamicLabel');
    const dynamicValue = document.getElementById('dynamicValue');
    const totalHours = document.getElementById('totalHours');
    const requiredHours = document.getElementById('requiredHours');
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');

    dashboardTitle.textContent = `Welcome, ${data.fullName}`;

    let schoolName = data.school || 'N/A';
    if (!data.school && data.idBadge) {
        schoolName = await fetchSchoolName(data.idBadge) || schoolName;
    }

    studentInfo.textContent = `ID: ${data.idBadge} | School: ${schoolName}`;

    const activeRecord = data.attendanceHistory?.find(record => record.timeIn && !record.timeOut);
    const actualStatus = activeRecord ? 'TIMED_IN' : (data.currentStatus || 'TIMED_OUT');

    currentStatus.textContent = actualStatus;

    // Fetch fresh student data to get required hours
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

    // Get hours values - ensure they're properly parsed
    const totalHoursValue = parseFloat(studentFullData.totalAccumulatedHours || 0);
    const requiredHoursValue = studentFullData.requiredHours ? parseFloat(studentFullData.requiredHours) : 0;
    const hasRequiredHours = requiredHoursValue > 0;

    // Update dynamic metric based on status
    if (actualStatus === 'TIMED_IN') {
        dynamicLabel.textContent = 'Total Tasks Today';
        const taskCount = studentFullData.todayTasksCount || 0;
        dynamicValue.textContent = taskCount;
        dynamicValue.style.color = 'var(--text-primary)';

        startTaskCountUpdate(studentFullData.idBadge);

        if (activeRecord) {
            currentTimeInTimestamp = new Date(activeRecord.timeIn);
            startTodayHoursTimer();
        }
    } else {
        stopTaskCountUpdate();

        // When timed out, show days to complete
        if (hasRequiredHours && totalHoursValue < requiredHoursValue) {
            dynamicLabel.textContent = 'Days to Complete';
            const remainingHours = requiredHoursValue - totalHoursValue;
            const estimatedDays = calculateEstimatedDays(remainingHours, studentFullData);
            dynamicValue.textContent = `${estimatedDays} day(s)`;
            dynamicValue.style.color = 'var(--info-color)';
        } else if (hasRequiredHours && totalHoursValue >= requiredHoursValue) {
            dynamicLabel.textContent = 'Status';
            dynamicValue.textContent = 'Complete!';
            dynamicValue.style.color = 'var(--success-color)';
        } else {
            // No required hours set
            dynamicLabel.textContent = 'Required Hours';
            dynamicValue.textContent = 'Not Set';
            dynamicValue.style.color = 'var(--text-muted)';
        }
    }

    // Update total hours display
    totalHours.textContent = formatHoursMinutes(totalHoursValue);

    // Update required hours display
    if (hasRequiredHours) {
        requiredHours.textContent = formatHoursMinutes(requiredHoursValue);
    } else {
        requiredHours.textContent = 'N/A';
    }

    // Update progress bar
    if (hasRequiredHours) {
        const progressPercent = Math.min((totalHoursValue / requiredHoursValue) * 100, 100);
        progressFill.style.width = progressPercent.toFixed(1) + '%';
        progressPercentage.textContent = progressPercent.toFixed(1) + '%';

        // Apply color class based on progress - matching admin panel
        const progressClass = getProgressClass(progressPercent);
        progressFill.className = `progress-fill-dashboard ${progressClass}`;
    } else {
        // No required hours - show empty bar
        progressFill.style.width = '0%';
        progressPercentage.textContent = 'N/A';
        progressFill.className = 'progress-fill-dashboard';
    }

    dashboardCard.classList.add('show');
    displayAttendanceHistory(studentFullData.attendanceHistory);
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
                const dynamicValue = document.getElementById('dynamicValue');
                if (dynamicValue) {
                    dynamicValue.textContent = data.todayTasksCount || 0;
                }
            }
        } catch (error) {
            console.error('Failed to update task count:', error);
        }
    }, 30000); // Update every 30 seconds
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
                const now = new Date();
                const diffMs = now - currentTimeInTimestamp;
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
                hoursDisplay = `<strong>${hours}h ${minutes}m ${seconds}s</strong>`;
            } else {
                hoursDisplay = `<strong>${record.totalHours || '0.0'}h</strong>${record.breakDeducted ? ' (-1h)' : ''}`;
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
        showAlert('Please enter your ID badge first', 'error');
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

            showAlert('Report downloaded successfully!', 'success');
        } else {
            showAlert('Failed to download report', 'error');
        }

    } catch (error) {
        showAlert('Failed to download report. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

function hideDashboard() {
    elements.dashboardCard().classList.remove('show');
    const historySection = document.getElementById('historySection');
    if (historySection) {
        historySection.classList.remove('show');
    }
    stopTaskCountUpdate();
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
            <button type="button" class="btn btn-primary" onclick="submitEnhancedTimeOut()">Time Out</button>
        </div>
    `;

    pendingTimeOut = true;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

async function submitEnhancedTimeOut() {
    const idBadge = elements.idBadge().value.trim();
    const additionalTasks = document.getElementById('additionalTasks')?.value.trim() || '';

    showLoading();
    closeTaskModal();
    setActionCooldown();

    try {
        const response = await fetch(`${API_BASE_URL}/attendance/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idBadge: idBadge,
                tasksCompleted: additionalTasks
            })
        });

        const data = await response.json();

        if (response.ok) {
            handleSuccessfulTimeOut(data);
        } else {
            handleTimeOutError(data);
        }

    } catch (error) {
        handleTimeOutError({ message: 'Network error. Please try again.' });
    } finally {
        hideLoading();
        pendingTimeOut = false;
    }
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

function updateTodayHours() {
    if (!currentTimeInTimestamp) return;

    const now = new Date();
    const diffMs = now - currentTimeInTimestamp;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const timeString = `${hours}h ${minutes}m ${seconds}s`;

    const historyBody = document.getElementById('historyBody');
    if (historyBody) {
        const activeRow = historyBody.querySelector('tr:first-child td:nth-child(3)');
        if (activeRow && activeRow.innerHTML.includes('0.0h')) {
            activeRow.innerHTML = `<strong>${timeString}</strong>`;
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

console.log('Enhanced OJT Attendance System Loaded');