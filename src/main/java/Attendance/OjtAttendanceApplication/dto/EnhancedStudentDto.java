package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDateTime;
import java.time.LocalTime;

public class EnhancedStudentDto extends StudentDto {
    private LocalTime scheduledStartTime;
    private LocalTime scheduledEndTime;
    private Integer gracePeriodMinutes;
    private Boolean scheduleActive;
    private String scheduleDisplayText;
    private Double scheduledHoursPerDay;

    public EnhancedStudentDto() {
        super();
    }

    // Schedule-related getters and setters
    public LocalTime getScheduledStartTime() { return scheduledStartTime; }
    public void setScheduledStartTime(LocalTime scheduledStartTime) {
        this.scheduledStartTime = scheduledStartTime;
        updateScheduleDisplayText();
    }

    public LocalTime getScheduledEndTime() { return scheduledEndTime; }
    public void setScheduledEndTime(LocalTime scheduledEndTime) {
        this.scheduledEndTime = scheduledEndTime;
        updateScheduleDisplayText();
    }

    public Integer getGracePeriodMinutes() { return gracePeriodMinutes; }
    public void setGracePeriodMinutes(Integer gracePeriodMinutes) {
        this.gracePeriodMinutes = gracePeriodMinutes;
        updateScheduleDisplayText();
    }

    public Boolean getScheduleActive() { return scheduleActive; }
    public void setScheduleActive(Boolean scheduleActive) {
        this.scheduleActive = scheduleActive;
        updateScheduleDisplayText();
    }

    public String getScheduleDisplayText() { return scheduleDisplayText; }
    public void setScheduleDisplayText(String scheduleDisplayText) { this.scheduleDisplayText = scheduleDisplayText; }

    public Double getScheduledHoursPerDay() { return scheduledHoursPerDay; }
    public void setScheduledHoursPerDay(Double scheduledHoursPerDay) { this.scheduledHoursPerDay = scheduledHoursPerDay; }

    private void updateScheduleDisplayText() {
        if (scheduledStartTime == null || scheduledEndTime == null || !Boolean.TRUE.equals(scheduleActive)) {
            this.scheduleDisplayText = "No Active Schedule";
        } else {
            this.scheduleDisplayText = String.format("%s - %s (%d min grace)",
                    scheduledStartTime.toString(), scheduledEndTime.toString(),
                    gracePeriodMinutes != null ? gracePeriodMinutes : 5);
        }
    }
}