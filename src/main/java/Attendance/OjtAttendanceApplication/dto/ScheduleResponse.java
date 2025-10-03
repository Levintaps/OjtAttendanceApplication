package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalTime;

public class ScheduleResponse {

    private Long studentId;
    private String studentName;
    private String idBadge;
    private LocalTime startTime;
    private LocalTime endTime;
    private Integer gracePeriodMinutes;
    private Boolean active;
    private Double scheduledHoursPerDay;
    private String scheduleDisplayText;

    public ScheduleResponse() {}

    public ScheduleResponse(Long studentId, String studentName, String idBadge,
                            LocalTime startTime, LocalTime endTime, Integer gracePeriodMinutes,
                            Boolean active, Double scheduledHoursPerDay) {
        this.studentId = studentId;
        this.studentName = studentName;
        this.idBadge = idBadge;
        this.startTime = startTime;
        this.endTime = endTime;
        this.gracePeriodMinutes = gracePeriodMinutes;
        this.active = active;
        this.scheduledHoursPerDay = scheduledHoursPerDay;
        this.scheduleDisplayText = formatScheduleDisplay();
    }

    private String formatScheduleDisplay() {
        if (startTime == null || endTime == null || !active) {
            return "No Active Schedule";
        }
        return String.format("%s - %s (%d min grace)",
                formatTime(startTime), formatTime(endTime), gracePeriodMinutes);
    }

    private String formatTime(LocalTime time) {
        return time.toString();
    }

    // Getters and Setters
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) {
        this.startTime = startTime;
        this.scheduleDisplayText = formatScheduleDisplay();
    }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) {
        this.endTime = endTime;
        this.scheduleDisplayText = formatScheduleDisplay();
    }

    public Integer getGracePeriodMinutes() { return gracePeriodMinutes; }
    public void setGracePeriodMinutes(Integer gracePeriodMinutes) {
        this.gracePeriodMinutes = gracePeriodMinutes;
        this.scheduleDisplayText = formatScheduleDisplay();
    }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) {
        this.active = active;
        this.scheduleDisplayText = formatScheduleDisplay();
    }

    public Double getScheduledHoursPerDay() { return scheduledHoursPerDay; }
    public void setScheduledHoursPerDay(Double scheduledHoursPerDay) { this.scheduledHoursPerDay = scheduledHoursPerDay; }

    public String getScheduleDisplayText() { return scheduleDisplayText; }
    public void setScheduleDisplayText(String scheduleDisplayText) { this.scheduleDisplayText = scheduleDisplayText; }
}
