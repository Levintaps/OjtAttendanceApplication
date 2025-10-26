package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDateTime;

public class ManualAttendanceRequest {

    @NotBlank(message = "ID badge is required")
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String idBadge;

    @NotNull(message = "Time-in date and time is required")
    private LocalDateTime timeIn;

    private LocalDateTime timeOut; // Optional - can be set for complete records

    private String tasksCompleted; // Optional

    @NotBlank(message = "Admin reason is required")
    private String adminReason; // Required explanation for manual entry

    private Boolean breakDeducted = false;

    public ManualAttendanceRequest() {}

    // Getters and Setters
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public LocalDateTime getTimeIn() { return timeIn; }
    public void setTimeIn(LocalDateTime timeIn) { this.timeIn = timeIn; }

    public LocalDateTime getTimeOut() { return timeOut; }
    public void setTimeOut(LocalDateTime timeOut) { this.timeOut = timeOut; }

    public String getTasksCompleted() { return tasksCompleted; }
    public void setTasksCompleted(String tasksCompleted) { this.tasksCompleted = tasksCompleted; }

    public String getAdminReason() { return adminReason; }
    public void setAdminReason(String adminReason) { this.adminReason = adminReason; }

    public Boolean getBreakDeducted() { return breakDeducted; }
    public void setBreakDeducted(Boolean breakDeducted) { this.breakDeducted = breakDeducted; }
}