package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDateTime;

public class AttendanceSessionInfo {
    private Long recordId;
    private String studentName;
    private String idBadge;
    private LocalDateTime timeIn;
    private Integer tasksLoggedCount;
    private Double currentSessionHours;
    private String sessionStatus;

    // Constructors
    public AttendanceSessionInfo() {}

    public AttendanceSessionInfo(Long recordId, String studentName, String idBadge,
                                 LocalDateTime timeIn, Integer tasksLoggedCount, Double currentSessionHours) {
        this.recordId = recordId;
        this.studentName = studentName;
        this.idBadge = idBadge;
        this.timeIn = timeIn;
        this.tasksLoggedCount = tasksLoggedCount;
        this.currentSessionHours = currentSessionHours;
        this.sessionStatus = "ACTIVE";
    }

    // Getters and Setters
    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public LocalDateTime getTimeIn() { return timeIn; }
    public void setTimeIn(LocalDateTime timeIn) { this.timeIn = timeIn; }

    public Integer getTasksLoggedCount() { return tasksLoggedCount; }
    public void setTasksLoggedCount(Integer tasksLoggedCount) { this.tasksLoggedCount = tasksLoggedCount; }

    public Double getCurrentSessionHours() { return currentSessionHours; }
    public void setCurrentSessionHours(Double currentSessionHours) { this.currentSessionHours = currentSessionHours; }

    public String getSessionStatus() { return sessionStatus; }
    public void setSessionStatus(String sessionStatus) { this.sessionStatus = sessionStatus; }
}
