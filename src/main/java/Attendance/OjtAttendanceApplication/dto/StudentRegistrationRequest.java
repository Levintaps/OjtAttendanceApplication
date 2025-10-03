package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class StudentRegistrationRequest {

    @NotBlank(message = "ID badge is required")
    @Pattern(regexp = "\\d{4}", message = "ID badge must be exactly 4 digits")
    private String idBadge;

    @NotBlank(message = "Full name is required")
    private String fullName;

    private String school;

    public StudentRegistrationRequest() {}

    public StudentRegistrationRequest(String idBadge, String fullName, String school) {
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.school = school;
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
}
