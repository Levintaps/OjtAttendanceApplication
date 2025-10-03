package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDateTime;

public class TaskEntryDto {
    private Long id;
    private String taskDescription;
    private LocalDateTime completedAt;
    private LocalDateTime addedAt;
    private Boolean addedDuringTimeout;

    public TaskEntryDto() {}

    public TaskEntryDto(Long id, String taskDescription, LocalDateTime completedAt,
                        LocalDateTime addedAt, Boolean addedDuringTimeout) {
        this.id = id;
        this.taskDescription = taskDescription;
        this.completedAt = completedAt;
        this.addedAt = addedAt;
        this.addedDuringTimeout = addedDuringTimeout;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTaskDescription() { return taskDescription; }
    public void setTaskDescription(String taskDescription) { this.taskDescription = taskDescription; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public LocalDateTime getAddedAt() { return addedAt; }
    public void setAddedAt(LocalDateTime addedAt) { this.addedAt = addedAt; }

    public Boolean getAddedDuringTimeout() { return addedDuringTimeout; }
    public void setAddedDuringTimeout(Boolean addedDuringTimeout) { this.addedDuringTimeout = addedDuringTimeout; }
}
