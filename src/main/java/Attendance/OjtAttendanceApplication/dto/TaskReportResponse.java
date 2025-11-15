package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * DTO for task report responses
 * Used for daily reports and group task retrieval
 */
public class TaskReportResponse {
    private String idBadge;
    private String studentName;
    private String school;
    private LocalDate date;
    private LocalTime scheduledStartTime;
    private LocalTime scheduledEndTime;
    private LocalTime actualTimeIn;
    private LocalTime actualTimeOut;
    private Double totalHours;
    private List<TaskEntryDto> tasks;
    private Integer taskCount;
    private String scheduleDisplayText;

    public TaskReportResponse() {}

    // Getters and Setters
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getScheduledStartTime() { return scheduledStartTime; }
    public void setScheduledStartTime(LocalTime scheduledStartTime) { this.scheduledStartTime = scheduledStartTime; }

    public LocalTime getScheduledEndTime() { return scheduledEndTime; }
    public void setScheduledEndTime(LocalTime scheduledEndTime) { this.scheduledEndTime = scheduledEndTime; }

    public LocalTime getActualTimeIn() { return actualTimeIn; }
    public void setActualTimeIn(LocalTime actualTimeIn) { this.actualTimeIn = actualTimeIn; }

    public LocalTime getActualTimeOut() { return actualTimeOut; }
    public void setActualTimeOut(LocalTime actualTimeOut) { this.actualTimeOut = actualTimeOut; }

    public Double getTotalHours() { return totalHours; }
    public void setTotalHours(Double totalHours) { this.totalHours = totalHours; }

    public List<TaskEntryDto> getTasks() { return tasks; }
    public void setTasks(List<TaskEntryDto> tasks) { this.tasks = tasks; }

    public Integer getTaskCount() { return taskCount; }
    public void setTaskCount(Integer taskCount) { this.taskCount = taskCount; }

    public String getScheduleDisplayText() { return scheduleDisplayText; }
    public void setScheduleDisplayText(String scheduleDisplayText) { this.scheduleDisplayText = scheduleDisplayText; }
}