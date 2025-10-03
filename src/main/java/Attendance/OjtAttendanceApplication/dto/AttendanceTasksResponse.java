package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDate;
import java.util.List;

public class AttendanceTasksResponse {
    private Long attendanceRecordId;
    private String studentName;
    private String idBadge;
    private LocalDate attendanceDate;
    private List<TaskEntryDto> tasks;
    private Integer taskCount;
    private Boolean hasRealTimeTasks;
    private Boolean hasTimeoutTasks;

    public AttendanceTasksResponse() {}

    // Getters and Setters
    public Long getAttendanceRecordId() { return attendanceRecordId; }
    public void setAttendanceRecordId(Long attendanceRecordId) { this.attendanceRecordId = attendanceRecordId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public LocalDate getAttendanceDate() { return attendanceDate; }
    public void setAttendanceDate(LocalDate attendanceDate) { this.attendanceDate = attendanceDate; }

    public List<TaskEntryDto> getTasks() { return tasks; }
    public void setTasks(List<TaskEntryDto> tasks) { this.tasks = tasks; }

    public Integer getTaskCount() { return taskCount; }
    public void setTaskCount(Integer taskCount) { this.taskCount = taskCount; }

    public Boolean getHasRealTimeTasks() { return hasRealTimeTasks; }
    public void setHasRealTimeTasks(Boolean hasRealTimeTasks) { this.hasRealTimeTasks = hasRealTimeTasks; }

    public Boolean getHasTimeoutTasks() { return hasTimeoutTasks; }
    public void setHasTimeoutTasks(Boolean hasTimeoutTasks) { this.hasTimeoutTasks = hasTimeoutTasks; }
}