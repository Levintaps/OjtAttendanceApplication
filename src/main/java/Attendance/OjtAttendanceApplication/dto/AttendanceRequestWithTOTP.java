package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

// DTO for attendance with TOTP
public class AttendanceRequestWithTOTP {

    @NotBlank(message = "ID badge is required")
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String idBadge;

    @NotBlank(message = "TOTP code is required")
    @Pattern(regexp = "\\d{6}", message = "TOTP code must be exactly 6 digits")
    private String totpCode;

    private String tasksCompleted;

    public AttendanceRequestWithTOTP() {}

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getTotpCode() { return totpCode; }
    public void setTotpCode(String totpCode) { this.totpCode = totpCode; }

    public String getTasksCompleted() { return tasksCompleted; }
    public void setTasksCompleted(String tasksCompleted) { this.tasksCompleted = tasksCompleted; }
}

// DTO for TOTP setup response
class TotpSetupResponse {
    private String idBadge;
    private String studentName;
    private String qrCodeDataUrl; // Base64 QR code image
    private String secret; // Show only during setup
    private String message;
    private Boolean totpEnabled;

    public TotpSetupResponse() {}

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getQrCodeDataUrl() { return qrCodeDataUrl; }
    public void setQrCodeDataUrl(String qrCodeDataUrl) { this.qrCodeDataUrl = qrCodeDataUrl; }

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Boolean getTotpEnabled() { return totpEnabled; }
    public void setTotpEnabled(Boolean totpEnabled) { this.totpEnabled = totpEnabled; }
}

// DTO for checking TOTP status
class TotpStatusResponse {
    private String idBadge;
    private String studentName;
    private Boolean totpEnabled;
    private Boolean requiresSetup;
    private String message;

    public TotpStatusResponse() {}

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public Boolean getTotpEnabled() { return totpEnabled; }
    public void setTotpEnabled(Boolean totpEnabled) { this.totpEnabled = totpEnabled; }

    public Boolean getRequiresSetup() { return requiresSetup; }
    public void setRequiresSetup(Boolean requiresSetup) { this.requiresSetup = requiresSetup; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
