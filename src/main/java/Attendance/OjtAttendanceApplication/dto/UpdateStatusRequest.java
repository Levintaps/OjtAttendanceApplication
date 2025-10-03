package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

// DTO for updating student status
public class UpdateStatusRequest {

    @NotBlank(message = "Status is required")
    private String status; // ACTIVE, COMPLETED, INACTIVE

    private String reason; // Optional reason for status change

    public UpdateStatusRequest() {}

    public UpdateStatusRequest(String status, String reason) {
        this.status = status;
        this.reason = reason;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}

