package Attendance.OjtAttendanceApplication.dto;

import java.util.List;

public class StudentDashboardResponse {
    private String idBadge;
    private String fullName;
    private String currentStatus;
    private Double todayHours;
    private Double totalAccumulatedHours;
    private List<AttendanceRecordDto> attendanceHistory;

    // NEW: Task-related fields
    private Integer todayTasksCount;
    private Boolean canLogTasks;
    private Long activeSessionId;
    private List<TaskEntryDto> todayTasks;

    public StudentDashboardResponse() {}

    public StudentDashboardResponse(String idBadge, String fullName, String currentStatus,
                                    Double todayHours, Double totalAccumulatedHours,
                                    List<AttendanceRecordDto> attendanceHistory) {
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.currentStatus = currentStatus;
        this.todayHours = todayHours;
        this.totalAccumulatedHours = totalAccumulatedHours;
        this.attendanceHistory = attendanceHistory;
        this.todayTasksCount = 0;
        this.canLogTasks = false;
    }

    // Enhanced constructor with task information
    public StudentDashboardResponse(String idBadge, String fullName, String currentStatus,
                                    Double todayHours, Double totalAccumulatedHours,
                                    List<AttendanceRecordDto> attendanceHistory,
                                    Integer todayTasksCount, Boolean canLogTasks,
                                    Long activeSessionId, List<TaskEntryDto> todayTasks) {
        this(idBadge, fullName, currentStatus, todayHours, totalAccumulatedHours, attendanceHistory);
        this.todayTasksCount = todayTasksCount;
        this.canLogTasks = canLogTasks;
        this.activeSessionId = activeSessionId;
        this.todayTasks = todayTasks;
    }

    // Existing Getters and Setters
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getCurrentStatus() { return currentStatus; }
    public void setCurrentStatus(String currentStatus) { this.currentStatus = currentStatus; }

    public Double getTodayHours() { return todayHours; }
    public void setTodayHours(Double todayHours) { this.todayHours = todayHours; }

    public Double getTotalAccumulatedHours() { return totalAccumulatedHours; }
    public void setTotalAccumulatedHours(Double totalAccumulatedHours) {
        this.totalAccumulatedHours = totalAccumulatedHours;
    }

    public List<AttendanceRecordDto> getAttendanceHistory() { return attendanceHistory; }
    public void setAttendanceHistory(List<AttendanceRecordDto> attendanceHistory) {
        this.attendanceHistory = attendanceHistory;
    }

    // NEW: Task-related Getters and Setters
    public Integer getTodayTasksCount() { return todayTasksCount; }
    public void setTodayTasksCount(Integer todayTasksCount) { this.todayTasksCount = todayTasksCount; }

    public Boolean getCanLogTasks() { return canLogTasks; }
    public void setCanLogTasks(Boolean canLogTasks) { this.canLogTasks = canLogTasks; }

    public Long getActiveSessionId() { return activeSessionId; }
    public void setActiveSessionId(Long activeSessionId) { this.activeSessionId = activeSessionId; }

    public List<TaskEntryDto> getTodayTasks() { return todayTasks; }
    public void setTodayTasks(List<TaskEntryDto> todayTasks) { this.todayTasks = todayTasks; }
}