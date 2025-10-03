package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDateTime;
import java.time.LocalTime;

public class StudentDto {
    private Long id;
    private String idBadge;
    private String fullName;
    private String school;
    private LocalDateTime registrationDate;
    private Double totalAccumulatedHours;
    private String status;
    private LocalDateTime completionDate;
    private Double requiredHours;
    private Double hoursRemaining;
    private Double completionPercentage;

    // NEW SCHEDULE FIELDS
    private LocalTime scheduledStartTime;
    private LocalTime scheduledEndTime;
    private Integer gracePeriodMinutes;
    private Boolean scheduleActive;
    private String scheduleDisplayText;
    private Double scheduledHoursPerDay;

    public StudentDto() {}

    // EXISTING GETTERS AND SETTERS
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }

    public LocalDateTime getRegistrationDate() { return registrationDate; }
    public void setRegistrationDate(LocalDateTime registrationDate) { this.registrationDate = registrationDate; }

    public Double getTotalAccumulatedHours() { return totalAccumulatedHours; }
    public void setTotalAccumulatedHours(Double totalAccumulatedHours) { this.totalAccumulatedHours = totalAccumulatedHours; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCompletionDate() { return completionDate; }
    public void setCompletionDate(LocalDateTime completionDate) { this.completionDate = completionDate; }

    public Double getRequiredHours() { return requiredHours; }
    public void setRequiredHours(Double requiredHours) { this.requiredHours = requiredHours; }

    public Double getHoursRemaining() { return hoursRemaining; }
    public void setHoursRemaining(Double hoursRemaining) { this.hoursRemaining = hoursRemaining; }

    public Double getCompletionPercentage() { return completionPercentage; }
    public void setCompletionPercentage(Double completionPercentage) { this.completionPercentage = completionPercentage; }

    // NEW SCHEDULE GETTERS AND SETTERS
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
