package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;

public class ScheduleOverrideRequestDto {

    @NotBlank(message = "ID badge is required")
    private String idBadge;

    @NotNull(message = "Record ID is required")
    private Long recordId;

    @NotBlank(message = "Scheduled time is required")
    private String scheduledTime;

    @NotBlank(message = "Actual time is required")
    private String actualTime;

    @NotNull(message = "Early minutes is required")
    private Integer earlyMinutes;

    @NotBlank(message = "Reason is required")
    private String reason;

    // Constructors
    public ScheduleOverrideRequestDto() {}

    // Getters and Setters
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }

    public String getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }

    public String getActualTime() { return actualTime; }
    public void setActualTime(String actualTime) { this.actualTime = actualTime; }

    public Integer getEarlyMinutes() { return earlyMinutes; }
    public void setEarlyMinutes(Integer earlyMinutes) { this.earlyMinutes = earlyMinutes; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    // helper methods to parse strings
    public LocalTime getScheduledTimeAsLocalTime() {
        return LocalTime.parse(this.scheduledTime);
    }

    public LocalTime getActualTimeAsLocalTime() {
        return LocalTime.parse(this.actualTime);
    }
}