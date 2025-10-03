package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class UpdateBadgeRequest {

    @NotBlank(message = "New ID badge is required")
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String newIdBadge;

    private String reason; // Optional reason for the change

    public UpdateBadgeRequest() {}

    public UpdateBadgeRequest(String newIdBadge, String reason) {
        this.newIdBadge = newIdBadge;
        this.reason = reason;
    }

    public String getNewIdBadge() { return newIdBadge; }
    public void setNewIdBadge(String newIdBadge) { this.newIdBadge = newIdBadge; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
