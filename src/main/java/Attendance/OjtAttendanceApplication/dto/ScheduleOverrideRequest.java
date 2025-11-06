package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public class ScheduleOverrideRequest {

    @NotBlank(message = "ID badge is required")
    private String idBadge;

    @NotBlank(message = "Reason is required")
    private String reason;

    private String scheduledTime;
    private String actualTime;
    private Integer earlyMinutes;

    @NotNull(message = "Record ID is required")
    private Long recordId;

    private String requestType;
    private LocalDateTime timestamp;

    // Constructors
    public ScheduleOverrideRequest() {}

    // Getters and Setters
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }

    public String getActualTime() { return actualTime; }
    public void setActualTime(String actualTime) { this.actualTime = actualTime; }

    public Integer getEarlyMinutes() { return earlyMinutes; }
    public void setEarlyMinutes(Integer earlyMinutes) { this.earlyMinutes = earlyMinutes; }

    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }

    public String getRequestType() { return requestType; }
    public void setRequestType(String requestType) { this.requestType = requestType; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}