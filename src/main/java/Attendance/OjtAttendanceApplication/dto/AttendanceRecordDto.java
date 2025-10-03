package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class AttendanceRecordDto {
    private Long id;
    private String studentName;
    private String idBadge;
    private LocalDate attendanceDate;
    private LocalDateTime timeIn;
    private LocalDateTime timeOut;
    private Double totalHours;
    private Double regularHours;
    private Double overtimeHours;
    private Double undertimeHours;
    private String tasksCompleted;
    private String status;
    private Boolean breakDeducted;

    public AttendanceRecordDto() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }
    public LocalDate getAttendanceDate() { return attendanceDate; }
    public void setAttendanceDate(LocalDate attendanceDate) { this.attendanceDate = attendanceDate; }
    public LocalDateTime getTimeIn() { return timeIn; }
    public void setTimeIn(LocalDateTime timeIn) { this.timeIn = timeIn; }
    public LocalDateTime getTimeOut() { return timeOut; }
    public void setTimeOut(LocalDateTime timeOut) { this.timeOut = timeOut; }
    public Double getTotalHours() { return totalHours; }
    public void setTotalHours(Double totalHours) { this.totalHours = totalHours; }
    public Double getRegularHours() { return regularHours; }
    public void setRegularHours(Double regularHours) { this.regularHours = regularHours; }
    public Double getOvertimeHours() { return overtimeHours; }
    public void setOvertimeHours(Double overtimeHours) { this.overtimeHours = overtimeHours; }
    public Double getUndertimeHours() { return undertimeHours; }
    public void setUndertimeHours(Double undertimeHours) { this.undertimeHours = undertimeHours; }
    public String getTasksCompleted() { return tasksCompleted; }
    public void setTasksCompleted(String tasksCompleted) { this.tasksCompleted = tasksCompleted; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Boolean getBreakDeducted() { return breakDeducted; }
    public void setBreakDeducted(Boolean breakDeducted) { this.breakDeducted = breakDeducted; }
}
