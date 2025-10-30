package Attendance.OjtAttendanceApplication.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "students")
public class Student {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, length = 4)
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String idBadge; // Made nullable for completed students

    @NotBlank(message = "Full name is required")
    @Column(nullable = false)
    private String fullName;

    @Column(name = "school")
    private String school;

    @Column(name = "registration_date")
    private LocalDateTime registrationDate;

    @Column(name = "ojt_start_date")
    private LocalDate ojtStartDate;

    @Column(name = "total_accumulated_hours")
    private Double totalAccumulatedHours = 0.0;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private StudentStatus status = StudentStatus.ACTIVE;

    @Column(name = "completion_date")
    private LocalDateTime completionDate;

    @Column(name = "required_hours")
    private Double requiredHours; // nullable for existing students

    // NEW SCHEDULE FIELDS
    @Column(name = "scheduled_start_time")
    private LocalTime scheduledStartTime;

    @Column(name = "scheduled_end_time")
    private LocalTime scheduledEndTime;

    @Column(name = "grace_period_minutes")
    private Integer gracePeriodMinutes = 5; // Default 5 minutes grace period

    @Column(name = "schedule_active")
    private Boolean scheduleActive = false; // Default false, admin must activate

    @OneToMany(mappedBy = "student", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<AttendanceRecord> attendanceRecords;

    @Column(name = "totp_secret")
    private String totpSecret; // Stores the secret key for Google Authenticator

    @Column(name = "totp_enabled")
    private Boolean totpEnabled = false; // Tracks if student has set up TOTP

    // Constructors
    public Student() {
        this.registrationDate = LocalDateTime.now();
    }

    public Student(String idBadge, String fullName, String school) {
        this();
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.school = school;
    }

    public Student(String idBadge, String fullName, String school, Double requiredHours) {
        this();
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.school = school;
        this.requiredHours = requiredHours;
    }

    // NEW SCHEDULE-RELATED BUSINESS LOGIC METHODS
    public boolean hasActiveSchedule() {
        return scheduleActive && scheduledStartTime != null && scheduledEndTime != null;
    }

    public boolean isLateArrival(LocalTime arrivalTime) {
        if (!hasActiveSchedule()) return false;

        LocalTime graceTime = scheduledStartTime.plusMinutes(gracePeriodMinutes);
        return arrivalTime.isAfter(graceTime);
    }

    public boolean isEarlyArrival(LocalTime arrivalTime) {
        if (!hasActiveSchedule()) return false;

        return arrivalTime.isBefore(scheduledStartTime);
    }

    public boolean isOnTimeArrival(LocalTime arrivalTime) {
        if (!hasActiveSchedule()) return true; // No schedule = always on time

        LocalTime graceTime = scheduledStartTime.plusMinutes(gracePeriodMinutes);
        return !arrivalTime.isBefore(scheduledStartTime) && !arrivalTime.isAfter(graceTime);
    }

    public LocalTime calculateExpectedEndTime(LocalTime actualStartTime) {
        if (!hasActiveSchedule()) return null;

        if (isLateArrival(actualStartTime)) {
            // Add late minutes to scheduled end time
            long lateMinutes = java.time.Duration.between(scheduledStartTime, actualStartTime).toMinutes();
            return scheduledEndTime.plusMinutes(lateMinutes);
        } else {
            // On time or early = regular scheduled end time
            return scheduledEndTime;
        }
    }

    public String getScheduleStatusText(LocalTime arrivalTime) {
        if (!hasActiveSchedule()) return "No Schedule";

        if (isOnTimeArrival(arrivalTime)) return "On Time";
        if (isEarlyArrival(arrivalTime)) return "Early";
        if (isLateArrival(arrivalTime)) {
            long lateMinutes = java.time.Duration.between(scheduledStartTime, arrivalTime).toMinutes();
            return "Late (" + lateMinutes + " min)";
        }
        return "Unknown";
    }

    public Double getScheduledHoursPerDay() {
        if (!hasActiveSchedule()) return null;

        long minutes = java.time.Duration.between(scheduledStartTime, scheduledEndTime).toMinutes();
        return minutes / 60.0;
    }

    // EXISTING BUSINESS LOGIC METHODS
    public Double getCompletionPercentage() {
        if (requiredHours == null || requiredHours == 0) return null;
        return Math.min((totalAccumulatedHours / requiredHours) * 100, 100.0);
    }

    public Double getHoursRemaining() {
        if (requiredHours == null) return null;
        return Math.max(requiredHours - totalAccumulatedHours, 0.0);
    }

    public boolean isActive() {
        return status == StudentStatus.ACTIVE;
    }

    public boolean isCompleted() {
        return status == StudentStatus.COMPLETED;
    }

    public boolean hasReachedRequiredHours() {
        if (requiredHours == null) return false;
        return totalAccumulatedHours >= requiredHours;
    }

    public LocalDate getEffectiveStartDate() {
        // Use OJT start date if set, otherwise fall back to registration date
        return ojtStartDate;
    }

    // GETTERS AND SETTERS
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getIdBadge() {
        return idBadge;
    }

    public void setIdBadge(String idBadge) {
        this.idBadge = idBadge;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getSchool() {
        return school;
    }

    public void setSchool(String school) {
        this.school = school;
    }

    public LocalDateTime getRegistrationDate() {
        return registrationDate;
    }

    public LocalDate getOjtStartDate() {
        return ojtStartDate;
    }

    public void setOjtStartDate(LocalDate ojtStartDate) {
        this.ojtStartDate = ojtStartDate;
    }

    public void setRegistrationDate(LocalDateTime registrationDate) {
        this.registrationDate = registrationDate;
    }

    public Double getTotalAccumulatedHours() {
        return totalAccumulatedHours;
    }

    public void setTotalAccumulatedHours(Double totalAccumulatedHours) {
        this.totalAccumulatedHours = totalAccumulatedHours;
    }

    public StudentStatus getStatus() {
        return status;
    }

    public void setStatus(StudentStatus status) {
        this.status = status;
    }

    public LocalDateTime getCompletionDate() {
        return completionDate;
    }

    public void setCompletionDate(LocalDateTime completionDate) {
        this.completionDate = completionDate;
    }

    public Double getRequiredHours() {
        return requiredHours;
    }

    public void setRequiredHours(Double requiredHours) {
        this.requiredHours = requiredHours;
    }

    // NEW SCHEDULE GETTERS AND SETTERS
    public LocalTime getScheduledStartTime() {
        return scheduledStartTime;
    }

    public void setScheduledStartTime(LocalTime scheduledStartTime) {
        this.scheduledStartTime = scheduledStartTime;
    }

    public LocalTime getScheduledEndTime() {
        return scheduledEndTime;
    }

    public void setScheduledEndTime(LocalTime scheduledEndTime) {
        this.scheduledEndTime = scheduledEndTime;
    }

    public Integer getGracePeriodMinutes() {
        return gracePeriodMinutes;
    }

    public void setGracePeriodMinutes(Integer gracePeriodMinutes) {
        this.gracePeriodMinutes = gracePeriodMinutes;
    }

    public Boolean getScheduleActive() {
        return scheduleActive;
    }

    public void setScheduleActive(Boolean scheduleActive) {
        this.scheduleActive = scheduleActive;
    }

    public List<AttendanceRecord> getAttendanceRecords() {
        return attendanceRecords;
    }

    public void setAttendanceRecords(List<AttendanceRecord> attendanceRecords) {
        this.attendanceRecords = attendanceRecords;
    }

    public String getTotpSecret() {
        return totpSecret;
    }

    public void setTotpSecret(String totpSecret) {
        this.totpSecret = totpSecret;
    }

    public Boolean getTotpEnabled() {
        return totpEnabled;
    }

    public void setTotpEnabled(Boolean totpEnabled) {
        this.totpEnabled = totpEnabled;
    }
}