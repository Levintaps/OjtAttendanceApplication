package Attendance.OjtAttendanceApplication.dto;

/**
 * DTO for NotificationType update
 */
public class ScheduleOverrideRequestData {
    private Long requestId;
    private String studentName;
    private String idBadge;
    private String scheduledTime;
    private String actualTime;
    private Integer earlyMinutes;
    private String reason;

    public ScheduleOverrideRequestData() {}

    // Getters and Setters
    public Long getRequestId() { return requestId; }
    public void setRequestId(Long requestId) { this.requestId = requestId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(String scheduledTime) { this.scheduledTime = scheduledTime; }

    public String getActualTime() { return actualTime; }
    public void setActualTime(String actualTime) { this.actualTime = actualTime; }

    public Integer getEarlyMinutes() { return earlyMinutes; }
    public void setEarlyMinutes(Integer earlyMinutes) { this.earlyMinutes = earlyMinutes; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}