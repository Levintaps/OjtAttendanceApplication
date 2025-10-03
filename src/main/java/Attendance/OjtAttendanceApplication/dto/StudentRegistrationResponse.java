package Attendance.OjtAttendanceApplication.dto;

public class StudentRegistrationResponse {
    private Long id;
    private String idBadge;
    private String fullName;
    private String school;
    private String message;
    private boolean success;

    public StudentRegistrationResponse() {}

    public StudentRegistrationResponse(Long id, String idBadge, String fullName, String message, boolean success) {
        this.id = id;
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.message = message;
        this.success = success;
    }

    public StudentRegistrationResponse(Long id, String idBadge, String fullName, String school, String message, boolean success) {
        this.id = id;
        this.idBadge = idBadge;
        this.fullName = fullName;
        this.school = school;
        this.message = message;
        this.success = success;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
}