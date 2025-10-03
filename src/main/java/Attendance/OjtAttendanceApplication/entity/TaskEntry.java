package Attendance.OjtAttendanceApplication.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

@Entity
@Table(name = "task_entries")
public class TaskEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attendance_record_id", nullable = false)
    private AttendanceRecord attendanceRecord;

    @NotBlank(message = "Task description is required")
    @Column(name = "task_description", columnDefinition = "TEXT", nullable = false)
    private String taskDescription;

    @NotNull(message = "Completed at time is required")
    @Column(name = "completed_at", nullable = false)
    private LocalDateTime completedAt; // When the task was actually completed

    @Column(name = "added_at", nullable = false)
    private LocalDateTime addedAt; // When the task was logged into system

    @Column(name = "added_during_timeout")
    private Boolean addedDuringTimeout = false; // Flag to track if added during time-out process

    // Constructors
    public TaskEntry() {
        this.addedAt = LocalDateTime.now();
    }

    public TaskEntry(AttendanceRecord attendanceRecord, String taskDescription, LocalDateTime completedAt) {
        this();
        this.attendanceRecord = attendanceRecord;
        this.taskDescription = taskDescription;
        this.completedAt = completedAt;
    }

    public TaskEntry(AttendanceRecord attendanceRecord, String taskDescription, LocalDateTime completedAt, Boolean addedDuringTimeout) {
        this(attendanceRecord, taskDescription, completedAt);
        this.addedDuringTimeout = addedDuringTimeout;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AttendanceRecord getAttendanceRecord() {
        return attendanceRecord;
    }

    public void setAttendanceRecord(AttendanceRecord attendanceRecord) {
        this.attendanceRecord = attendanceRecord;
    }

    public String getTaskDescription() {
        return taskDescription;
    }

    public void setTaskDescription(String taskDescription) {
        this.taskDescription = taskDescription;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public LocalDateTime getAddedAt() {
        return addedAt;
    }

    public void setAddedAt(LocalDateTime addedAt) {
        this.addedAt = addedAt;
    }

    public Boolean getAddedDuringTimeout() {
        return addedDuringTimeout;
    }

    public void setAddedDuringTimeout(Boolean addedDuringTimeout) {
        this.addedDuringTimeout = addedDuringTimeout;
    }
}
