package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDate;

/**
 * DTO for task logging statistics and analytics
 * Used by admin to monitor task logging adoption and patterns
 */
public class TaskLoggingStats {
    private LocalDate date;
    private Integer totalAttendanceRecords;
    private Integer recordsWithTasks;
    private Integer totalTasksLogged;
    private Integer realTimeTaskEntries;
    private Integer timeOutTaskEntries;
    private Double taskAdoptionRate; // Percentage of records with tasks
    private Double averageTasksPerRecord;

    // Constructors
    public TaskLoggingStats() {}

    public TaskLoggingStats(LocalDate date, Integer totalAttendanceRecords, Integer recordsWithTasks,
                            Integer totalTasksLogged, Integer realTimeTaskEntries, Integer timeOutTaskEntries) {
        this.date = date;
        this.totalAttendanceRecords = totalAttendanceRecords;
        this.recordsWithTasks = recordsWithTasks;
        this.totalTasksLogged = totalTasksLogged;
        this.realTimeTaskEntries = realTimeTaskEntries;
        this.timeOutTaskEntries = timeOutTaskEntries;

        // Calculate derived statistics
        if (totalAttendanceRecords > 0) {
            this.taskAdoptionRate = (recordsWithTasks.doubleValue() / totalAttendanceRecords.doubleValue()) * 100;
            this.averageTasksPerRecord = totalTasksLogged.doubleValue() / totalAttendanceRecords.doubleValue();
        } else {
            this.taskAdoptionRate = 0.0;
            this.averageTasksPerRecord = 0.0;
        }
    }

    // Getters and Setters
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Integer getTotalAttendanceRecords() { return totalAttendanceRecords; }
    public void setTotalAttendanceRecords(Integer totalAttendanceRecords) {
        this.totalAttendanceRecords = totalAttendanceRecords;
        recalculateStats();
    }

    public Integer getRecordsWithTasks() { return recordsWithTasks; }
    public void setRecordsWithTasks(Integer recordsWithTasks) {
        this.recordsWithTasks = recordsWithTasks;
        recalculateStats();
    }

    public Integer getTotalTasksLogged() { return totalTasksLogged; }
    public void setTotalTasksLogged(Integer totalTasksLogged) {
        this.totalTasksLogged = totalTasksLogged;
        recalculateStats();
    }

    public Integer getRealTimeTaskEntries() { return realTimeTaskEntries; }
    public void setRealTimeTaskEntries(Integer realTimeTaskEntries) { this.realTimeTaskEntries = realTimeTaskEntries; }

    public Integer getTimeOutTaskEntries() { return timeOutTaskEntries; }
    public void setTimeOutTaskEntries(Integer timeOutTaskEntries) { this.timeOutTaskEntries = timeOutTaskEntries; }

    public Double getTaskAdoptionRate() { return taskAdoptionRate; }
    public void setTaskAdoptionRate(Double taskAdoptionRate) { this.taskAdoptionRate = taskAdoptionRate; }

    public Double getAverageTasksPerRecord() { return averageTasksPerRecord; }
    public void setAverageTasksPerRecord(Double averageTasksPerRecord) { this.averageTasksPerRecord = averageTasksPerRecord; }

    // Helper method to recalculate derived statistics
    private void recalculateStats() {
        if (totalAttendanceRecords != null && totalAttendanceRecords > 0) {
            if (recordsWithTasks != null) {
                this.taskAdoptionRate = (recordsWithTasks.doubleValue() / totalAttendanceRecords.doubleValue()) * 100;
            }
            if (totalTasksLogged != null) {
                this.averageTasksPerRecord = totalTasksLogged.doubleValue() / totalAttendanceRecords.doubleValue();
            }
        } else {
            this.taskAdoptionRate = 0.0;
            this.averageTasksPerRecord = 0.0;
        }
    }

    // Utility methods for analysis
    public boolean hasGoodTaskAdoption() {
        return taskAdoptionRate != null && taskAdoptionRate >= 70.0; // 70% or more students logging tasks
    }

    public String getAdoptionLevel() {
        if (taskAdoptionRate == null || taskAdoptionRate == 0.0) return "No Adoption";
        if (taskAdoptionRate < 30.0) return "Low Adoption";
        if (taskAdoptionRate < 60.0) return "Moderate Adoption";
        if (taskAdoptionRate < 80.0) return "Good Adoption";
        return "Excellent Adoption";
    }
}