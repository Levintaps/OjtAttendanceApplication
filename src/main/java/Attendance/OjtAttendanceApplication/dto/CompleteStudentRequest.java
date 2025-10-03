package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotNull;

// DTO for completing a student
public class CompleteStudentRequest {

    @NotNull(message = "Confirmation is required")
    private Boolean confirmed;

    private String reason; // Optional completion reason/notes

    public CompleteStudentRequest() {}

    public CompleteStudentRequest(Boolean confirmed, String reason) {
        this.confirmed = confirmed;
        this.reason = reason;
    }

    public Boolean getConfirmed() { return confirmed; }
    public void setConfirmed(Boolean confirmed) { this.confirmed = confirmed; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
