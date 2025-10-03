package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

// Updated Student Registration Request to include required hours
public class StudentRegistrationRequestWithHours {

    @NotBlank(message = "ID badge is required")
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String idBadge;

    @NotBlank(message = "Full name is required")
    private String fullName;

    private String school;

    @Positive(message = "Required hours must be positive if provided")
    private Double requiredHours; // Optional for new students

    public StudentRegistrationRequestWithHours() {}

    public StudentRegistrationRequestWithHours(String idBadge, String fullName, String school, Double requiredHours) {
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.school = school;
        this.requiredHours = requiredHours;
    }

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }

    public Double getRequiredHours() { return requiredHours; }
    public void setRequiredHours(Double requiredHours) { this.requiredHours = requiredHours; }
}
