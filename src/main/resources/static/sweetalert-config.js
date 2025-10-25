// SweetAlert2 Configuration for OJT Attendance System

/**
 * Show success alert for Time In
 */
function showTimeInSuccess(studentName, timeIn) {
    Swal.fire({
        icon: 'success',
        title: `Welcome, ${studentName}!`,
        html: `
            <div style="text-align: center; padding: 10px;">
                <p style="font-size: 1.1rem; margin-bottom: 10px;">
                    <strong>Timed in successfully</strong>
                </p>
                <p style="font-size: 0.95rem; color: #666;">
                    Time: <strong>${timeIn}</strong>
                </p>
                <p style="font-size: 0.9rem; color: #10b981; margin-top: 10px;">
                    Have a productive day! 🚀
                </p>
            </div>
        `,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Let\'s Go!',
        timer: 4000,
        timerProgressBar: true,
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
        }
    });
}

/**
 * Show success alert for Time Out
 */
function showTimeOutSuccess(studentName, timeOut, totalHours, breakDeducted = false, overtimeHours = 0) {
    const breakMessage = breakDeducted ? '<br><small style="color: #f59e0b;">⏰ 1 hour lunch break deducted</small>' : '';
    const overtimeMessage = overtimeHours > 0 ? `<br><small style="color: #8b5cf6;">⭐ Including ${overtimeHours}h overtime</small>` : '';

    Swal.fire({
        icon: 'success',
        title: `Great Work, ${studentName}!`,
        html: `
            <div style="text-align: center; padding: 10px;">
                <p style="font-size: 1.1rem; margin-bottom: 10px;">
                    <strong>Timed out successfully</strong>
                </p>
                <p style="font-size: 0.95rem; color: #666;">
                    Time: <strong>${timeOut}</strong>
                </p>
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="font-size: 1.3rem; color: #0ea5e9; margin: 0;">
                        <strong>${totalHours} hours</strong>
                    </p>
                    <p style="font-size: 0.85rem; color: #0284c7; margin-top: 5px;">
                        Total hours today
                    </p>
                </div>
                ${breakMessage}
                ${overtimeMessage}
                <p style="font-size: 0.9rem; color: #10b981; margin-top: 15px;">
                    Have a wonderful day! 👋
                </p>
            </div>
        `,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Awesome!',
        timer: 5000,
        timerProgressBar: true,
        showClass: {
            popup: 'animate__animated animate__bounceIn animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
        }
    });
}

/**
 * Show success alert for CSV Report Download
 */
function showCSVDownloadSuccess() {
    Swal.fire({
        icon: 'success',
        title: 'Report Downloaded!',
        html: `
            <div style="text-align: center; padding: 10px;">
                <p style="font-size: 1rem; color: #666;">
                    Your CSV attendance report has been downloaded successfully.
                </p>
                <p style="font-size: 0.9rem; color: #10b981; margin-top: 10px;">
                    📊 Check your downloads folder
                </p>
            </div>
        `,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'Got it!',
        timer: 3000,
        timerProgressBar: true,
        showClass: {
            popup: 'animate__animated animate__zoomIn animate__faster'
        }
    });
}

/**
 * Show success alert for Weekly PDF Report Download
 */
function showWeeklyReportDownloadSuccess(weekInfo = '') {
    const weekText = weekInfo ? `<br><small style="color: #666;">Week: ${weekInfo}</small>` : '';

    Swal.fire({
        icon: 'success',
        title: 'Weekly Report Downloaded!',
        html: `
            <div style="text-align: center; padding: 10px;">
                <p style="font-size: 1rem; color: #666;">
                    Your weekly PDF report has been generated and downloaded.
                    ${weekText}
                </p>
                <p style="font-size: 0.9rem; color: #10b981; margin-top: 10px;">
                    📄 Check your downloads folder
                </p>
            </div>
        `,
        confirmButtonColor: '#8b5cf6',
        confirmButtonText: 'Perfect!',
        timer: 3500,
        timerProgressBar: true,
        showClass: {
            popup: 'animate__animated animate__zoomIn animate__faster'
        }
    });
}

/**
 * Show error alert
 */
function showErrorAlert(message, title = 'Oops...') {
    Swal.fire({
        icon: 'error',
        title: title,
        text: message,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Okay',
        showClass: {
            popup: 'animate__animated animate__shakeX animate__faster'
        }
    });
}

/**
 * Show loading alert
 */
function showLoadingAlert(message = 'Processing your request...') {
    Swal.fire({
        title: 'Please wait',
        html: message,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

/**
 * Close any open SweetAlert
 */
function closeSweetAlert() {
    Swal.close();
}

/**
 * Show custom success alert (generic)
 */
function showCustomSuccess(title, message, timer = 3000) {
    Swal.fire({
        icon: 'success',
        title: title,
        text: message,
        confirmButtonColor: '#10b981',
        timer: timer,
        timerProgressBar: true,
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        }
    });
}

/**
 * Show warning alert
 */
function showWarningAlert(message, title = 'Warning') {
    Swal.fire({
        icon: 'warning',
        title: title,
        text: message,
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'Understood',
        showClass: {
            popup: 'animate__animated animate__headShake animate__faster'
        }
    });
}

/**
 * Show success alert for Task Addition
 */
function showTaskAddedSuccess(taskCount) {
    Swal.fire({
        icon: 'success',
        title: 'Task Logged!',
        html: `
            <div style="text-align: center; padding: 10px;">
                <p style="font-size: 1rem; color: #666; margin-bottom: 15px;">
                    Your task has been successfully recorded.
                </p>
                <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <p style="font-size: 1.4rem; color: #0ea5e9; margin: 0;">
                        <strong>${taskCount}</strong>
                    </p>
                    <p style="font-size: 0.85rem; color: #0284c7; margin-top: 5px;">
                        ${taskCount === 1 ? 'task' : 'tasks'} logged today
                    </p>
                </div>
                <p style="font-size: 0.9rem; color: #10b981; margin-top: 10px;">
                    Keep up the great work! 📝
                </p>
            </div>
        `,
        confirmButtonColor: '#3b82f6',
        confirmButtonText: 'Awesome!',
        timer: 3500,
        timerProgressBar: true,
        showClass: {
            popup: 'animate__animated animate__bounceIn animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOut animate__faster'
        }
    });
}