package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class AttendanceRequest {

    @NotBlank(message = "ID badge is required")
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String idBadge;

    private String tasksCompleted;

    public AttendanceRequest() {}

    public AttendanceRequest(String idBadge, String tasksCompleted) {
        this.idBadge = idBadge;
        this.tasksCompleted = tasksCompleted;
    }

    public String getIdBadge() {
        return idBadge;
    }

    public void setIdBadge(String idBadge) {
        this.idBadge = idBadge;
    }

    public String getTasksCompleted() {
        return tasksCompleted;
    }

    public void setTasksCompleted(String tasksCompleted) {
        this.tasksCompleted = tasksCompleted;
    }
}

