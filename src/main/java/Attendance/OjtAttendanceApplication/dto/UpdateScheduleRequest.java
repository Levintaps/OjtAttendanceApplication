package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

// DTO for updating student schedule
public class UpdateScheduleRequest {

    @NotNull(message = "Start time is required")
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    private LocalTime endTime;

    @Min(value = 0, message = "Grace period must be at least 0 minutes")
    @Max(value = 30, message = "Grace period cannot exceed 30 minutes")
    private Integer gracePeriodMinutes = 5;

    @NotNull(message = "Schedule active status is required")
    private Boolean active;

    public UpdateScheduleRequest() {}

    public UpdateScheduleRequest(LocalTime startTime, LocalTime endTime, Integer gracePeriodMinutes, Boolean active) {
        this.startTime = startTime;
        this.endTime = endTime;
        this.gracePeriodMinutes = gracePeriodMinutes;
        this.active = active;
    }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public Integer getGracePeriodMinutes() { return gracePeriodMinutes; }
    public void setGracePeriodMinutes(Integer gracePeriodMinutes) { this.gracePeriodMinutes = gracePeriodMinutes; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}