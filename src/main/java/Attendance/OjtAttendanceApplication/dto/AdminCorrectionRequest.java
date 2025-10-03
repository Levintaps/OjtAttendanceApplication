package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public class AdminCorrectionRequest {

    @NotNull(message = "Attendance record ID is required")
    private Long attendanceRecordId;

    @NotNull(message = "Corrected hours is required")
    @Positive(message = "Corrected hours must be positive")
    private Double correctedHours;

    private String correctionReason;

    public AdminCorrectionRequest() {}

    public AdminCorrectionRequest(Long attendanceRecordId, Double correctedHours, String correctionReason) {
        this.attendanceRecordId = attendanceRecordId;
        this.correctedHours = correctedHours;
        this.correctionReason = correctionReason;
    }

    // Getters and Setters
    public Long getAttendanceRecordId() { return attendanceRecordId; }
    public void setAttendanceRecordId(Long attendanceRecordId) { this.attendanceRecordId = attendanceRecordId; }
    public Double getCorrectedHours() { return correctedHours; }
    public void setCorrectedHours(Double correctedHours) { this.correctedHours = correctedHours; }
    public String getCorrectionReason() { return correctionReason; }
    public void setCorrectionReason(String correctionReason) { this.correctionReason = correctionReason; }
}
