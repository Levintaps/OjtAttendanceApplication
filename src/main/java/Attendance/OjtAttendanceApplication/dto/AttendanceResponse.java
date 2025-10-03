package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDateTime;

public class AttendanceResponse {
    private String action;
    private String message;
    private boolean success;
    private String studentName;
    private String idBadge;
    private LocalDateTime timeIn;
    private LocalDateTime timeOut;
    private LocalDateTime roundedTimeIn;
    private LocalDateTime roundedTimeOut;
    private Double totalHours;
    private Double regularHours;
    private Double overtimeHours;
    private Double undertimeHours;
    private Double totalAccumulatedHours;
    private String tasksCompleted;
    private Boolean breakDeducted;

    public AttendanceResponse() {}

    public AttendanceResponse(String action, String message, boolean success, String studentName, String idBadge,
                              LocalDateTime timeIn, LocalDateTime timeOut, LocalDateTime roundedTimeIn, LocalDateTime roundedTimeOut,
                              Double totalHours, Double regularHours, Double overtimeHours, Double undertimeHours,
                              Double totalAccumulatedHours, String tasksCompleted, Boolean breakDeducted) {
        this.action = action;
        this.message = message;
        this.success = success;
        this.studentName = studentName;
        this.idBadge = idBadge;
        this.timeIn = timeIn;
        this.timeOut = timeOut;
        this.roundedTimeIn = roundedTimeIn;
        this.roundedTimeOut = roundedTimeOut;
        this.totalHours = totalHours;
        this.regularHours = regularHours;
        this.overtimeHours = overtimeHours;
        this.undertimeHours = undertimeHours;
        this.totalAccumulatedHours = totalAccumulatedHours;
        this.tasksCompleted = tasksCompleted;
        this.breakDeducted = breakDeducted;
    }

    // Getters and Setters
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }
    public LocalDateTime getTimeIn() { return timeIn; }
    public void setTimeIn(LocalDateTime timeIn) { this.timeIn = timeIn; }
    public LocalDateTime getTimeOut() { return timeOut; }
    public void setTimeOut(LocalDateTime timeOut) { this.timeOut = timeOut; }
    public LocalDateTime getRoundedTimeIn() { return roundedTimeIn; }
    public void setRoundedTimeIn(LocalDateTime roundedTimeIn) { this.roundedTimeIn = roundedTimeIn; }
    public LocalDateTime getRoundedTimeOut() { return roundedTimeOut; }
    public void setRoundedTimeOut(LocalDateTime roundedTimeOut) { this.roundedTimeOut = roundedTimeOut; }
    public Double getTotalHours() { return totalHours; }
    public void setTotalHours(Double totalHours) { this.totalHours = totalHours; }
    public Double getRegularHours() { return regularHours; }
    public void setRegularHours(Double regularHours) { this.regularHours = regularHours; }
    public Double getOvertimeHours() { return overtimeHours; }
    public void setOvertimeHours(Double overtimeHours) { this.overtimeHours = overtimeHours; }
    public Double getUndertimeHours() { return undertimeHours; }
    public void setUndertimeHours(Double undertimeHours) { this.undertimeHours = undertimeHours; }
    public Double getTotalAccumulatedHours() { return totalAccumulatedHours; }
    public void setTotalAccumulatedHours(Double totalAccumulatedHours) { this.totalAccumulatedHours = totalAccumulatedHours; }
    public String getTasksCompleted() { return tasksCompleted; }
    public void setTasksCompleted(String tasksCompleted) { this.tasksCompleted = tasksCompleted; }
    public Boolean getBreakDeducted() { return breakDeducted; }
    public void setBreakDeducted(Boolean breakDeducted) { this.breakDeducted = breakDeducted; }
}
