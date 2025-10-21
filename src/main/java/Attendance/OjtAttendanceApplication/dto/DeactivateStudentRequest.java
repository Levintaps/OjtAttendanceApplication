package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;

public class DeactivateStudentRequest {

    @NotBlank(message = "Reason is required")
    private String reason;

    private Boolean removeIdBadge = true; // Release badge for reuse

    public DeactivateStudentRequest() {}

    public DeactivateStudentRequest(String reason, Boolean removeIdBadge) {
        this.reason = reason;
        this.removeIdBadge = removeIdBadge;
    }

    // Getters and Setters
    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Boolean getRemoveIdBadge() {
        return removeIdBadge;
    }

    public void setRemoveIdBadge(Boolean removeIdBadge) {
        this.removeIdBadge = removeIdBadge;
    }
}
