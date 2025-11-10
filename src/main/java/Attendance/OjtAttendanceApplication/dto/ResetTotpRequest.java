package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ResetTotpRequest {

    @NotNull(message = "Confirmation is required")
    private Boolean confirmed;

    @NotBlank(message = "Reason is required")
    private String reason;

    public ResetTotpRequest() {}

    public ResetTotpRequest(Boolean confirmed, String reason) {
        this.confirmed = confirmed;
        this.reason = reason;
    }

    public Boolean getConfirmed() {
        return confirmed;
    }

    public void setConfirmed(Boolean confirmed) {
        this.confirmed = confirmed;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
