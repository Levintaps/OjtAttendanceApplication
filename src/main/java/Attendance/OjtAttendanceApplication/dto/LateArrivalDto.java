package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalTime;

public class LateArrivalDto {
    private String studentName;
    private String idBadge;
    private LocalTime scheduledStartTime;
    private LocalTime actualArrivalTime;
    private Integer lateMinutes;
    private LocalTime expectedEndTime;
    private String status;

    public LateArrivalDto() {}

    // Getters and Setters
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public LocalTime getScheduledStartTime() { return scheduledStartTime; }
    public void setScheduledStartTime(LocalTime scheduledStartTime) { this.scheduledStartTime = scheduledStartTime; }

    public LocalTime getActualArrivalTime() { return actualArrivalTime; }
    public void setActualArrivalTime(LocalTime actualArrivalTime) { this.actualArrivalTime = actualArrivalTime; }

    public Integer getLateMinutes() { return lateMinutes; }
    public void setLateMinutes(Integer lateMinutes) { this.lateMinutes = lateMinutes; }

    public LocalTime getExpectedEndTime() { return expectedEndTime; }
    public void setExpectedEndTime(LocalTime expectedEndTime) { this.expectedEndTime = expectedEndTime; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}

