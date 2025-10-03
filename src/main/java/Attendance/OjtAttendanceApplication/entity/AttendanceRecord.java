package Attendance.OjtAttendanceApplication.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "attendance_records")
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(name = "attendance_date", nullable = false)
    private LocalDate attendanceDate;

    @Column(name = "time_in")
    private LocalDateTime timeIn;

    @Column(name = "time_out")
    private LocalDateTime timeOut;

    @Column(name = "total_hours")
    private Double totalHours = 0.0;

    @Column(name = "regular_hours")
    private Double regularHours = 0.0;

    @Column(name = "overtime_hours")
    private Double overtimeHours = 0.0;

    @Column(name = "undertime_hours")
    private Double undertimeHours = 0.0;

    @Column(name = "tasks_completed", columnDefinition = "TEXT")
    private String tasksCompleted;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private AttendanceStatus status = AttendanceStatus.TIMED_IN;

    @Column(name = "break_deducted")
    private Boolean breakDeducted = false;

    @OneToMany(mappedBy = "attendanceRecord", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<TaskEntry> taskEntries = new ArrayList<>();

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    // Constructors
    public AttendanceRecord() {
        this.attendanceDate = LocalDate.now();
    }

    public AttendanceRecord(Student student, LocalDateTime timeIn) {
        this();
        this.student = student;
        this.timeIn = timeIn;
        this.attendanceDate = timeIn.toLocalDate(); // Actual calendar date
        this.workDate = calculateWorkDate(timeIn); // Work day assignment
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public LocalDate getAttendanceDate() {
        return attendanceDate;
    }

    public void setAttendanceDate(LocalDate attendanceDate) {
        this.attendanceDate = attendanceDate;
    }

    public LocalDateTime getTimeIn() {
        return timeIn;
    }

    public void setTimeIn(LocalDateTime timeIn) {
        this.timeIn = timeIn;
    }

    public LocalDateTime getTimeOut() {
        return timeOut;
    }

    public void setTimeOut(LocalDateTime timeOut) {
        this.timeOut = timeOut;
    }

    public Double getTotalHours() {
        return totalHours;
    }

    public void setTotalHours(Double totalHours) {
        this.totalHours = totalHours;
    }

    public Double getRegularHours() {
        return regularHours;
    }

    public void setRegularHours(Double regularHours) {
        this.regularHours = regularHours;
    }

    public Double getOvertimeHours() {
        return overtimeHours;
    }

    public void setOvertimeHours(Double overtimeHours) {
        this.overtimeHours = overtimeHours;
    }

    public Double getUndertimeHours() {
        return undertimeHours;
    }

    public void setUndertimeHours(Double undertimeHours) {
        this.undertimeHours = undertimeHours;
    }

    public String getTasksCompleted() {
        return tasksCompleted;
    }

    public void setTasksCompleted(String tasksCompleted) {
        this.tasksCompleted = tasksCompleted;
    }

    public AttendanceStatus getStatus() {
        return status;
    }

    public void setStatus(AttendanceStatus status) {
        this.status = status;
    }

    public Boolean getBreakDeducted() {
        return breakDeducted;
    }

    public void setBreakDeducted(Boolean breakDeducted) {
        this.breakDeducted = breakDeducted;
    }

    // Add getter and setter methods:
    public List<TaskEntry> getTaskEntries() {
        return taskEntries;
    }

    public void setTaskEntries(List<TaskEntry> taskEntries) {
        this.taskEntries = taskEntries;
    }

    // Add helper method to check if tasks exist:
    public boolean hasTasks() {
        return taskEntries != null && !taskEntries.isEmpty();
    }

    // Add method to get task count:
    public int getTaskCount() {
        return taskEntries != null ? taskEntries.size() : 0;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public void setWorkDate(LocalDate workDate) {
        this.workDate = workDate;
    }

    private static LocalDate calculateWorkDate(LocalDateTime dateTime) {
        // If time is between midnight and 6 AM, assign to previous work day
        if (dateTime.getHour() < 6) {
            return dateTime.toLocalDate().minusDays(1);
        }
        return dateTime.toLocalDate();
    }
}
