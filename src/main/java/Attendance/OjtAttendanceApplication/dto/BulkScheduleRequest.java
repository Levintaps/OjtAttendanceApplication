package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalTime;
import java.util.List;

// DTO for bulk schedule updates
public class BulkScheduleRequest {

    @NotEmpty(message = "Student IDs list cannot be empty")
    private List<Long> studentIds;

    @NotNull(message = "Start time is required")
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    private LocalTime endTime;

    @Min(value = 0, message = "Grace period must be at least 0 minutes")
    @Max(value = 30, message = "Grace period cannot exceed 30 minutes")
    private Integer gracePeriodMinutes = 5;

    @NotNull(message = "Active status is required")
    private Boolean active;

    public BulkScheduleRequest() {}

    // Getters and Setters
    public List<Long> getStudentIds() { return studentIds; }
    public void setStudentIds(List<Long> studentIds) { this.studentIds = studentIds; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public Integer getGracePeriodMinutes() { return gracePeriodMinutes; }
    public void setGracePeriodMinutes(Integer gracePeriodMinutes) { this.gracePeriodMinutes = gracePeriodMinutes; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}
