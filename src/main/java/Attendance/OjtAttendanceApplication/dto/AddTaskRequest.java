package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public class AddTaskRequest {

    @NotBlank(message = "Student ID badge is required")
    private String idBadge;

    @NotBlank(message = "Task description is required")
    private String taskDescription;

    @NotNull(message = "Task completion time is required")
    private LocalDateTime completedAt;

    private Boolean addedDuringTimeout = false;

    public AddTaskRequest() {}

    public AddTaskRequest(String idBadge, String taskDescription, LocalDateTime completedAt) {
        this.idBadge = idBadge;
        this.taskDescription = taskDescription;
        this.completedAt = completedAt;
    }

    // Getters and Setters
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getTaskDescription() { return taskDescription; }
    public void setTaskDescription(String taskDescription) { this.taskDescription = taskDescription; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public Boolean getAddedDuringTimeout() { return addedDuringTimeout; }
    public void setAddedDuringTimeout(Boolean addedDuringTimeout) { this.addedDuringTimeout = addedDuringTimeout; }
}