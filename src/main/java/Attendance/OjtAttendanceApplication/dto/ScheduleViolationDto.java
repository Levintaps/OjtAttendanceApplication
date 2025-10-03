package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalTime;

public class ScheduleViolationDto {
    private String studentName;
    private String idBadge;
    private String violationType; // LATE_ARRIVAL, EARLY_DEPARTURE, LATE_ARRIVAL_AND_EARLY_DEPARTURE
    private LocalTime scheduledTime;
    private LocalTime actualTime;
    private Integer minutesDeviation;
    private String description;

    public ScheduleViolationDto() {}

    // Getters and Setters
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getViolationType() { return violationType; }
    public void setViolationType(String violationType) { this.violationType = violationType; }

    public LocalTime getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(LocalTime scheduledTime) { this.scheduledTime = scheduledTime; }

    public LocalTime getActualTime() { return actualTime; }
    public void setActualTime(LocalTime actualTime) { this.actualTime = actualTime; }

    public Integer getMinutesDeviation() { return minutesDeviation; }
    public void setMinutesDeviation(Integer minutesDeviation) { this.minutesDeviation = minutesDeviation; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
