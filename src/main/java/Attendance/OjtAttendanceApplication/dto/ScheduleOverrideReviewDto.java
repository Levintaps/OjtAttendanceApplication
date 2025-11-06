package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO for admin approval/rejection
 */
public class ScheduleOverrideReviewDto {

    @NotBlank(message = "Action is required (APPROVE or REJECT)")
    private String action; // APPROVE or REJECT

    @NotBlank(message = "Admin username is required")
    private String adminUsername;

    private String adminResponse; // Optional message to student

    public ScheduleOverrideReviewDto() {}

    // Getters and Setters
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getAdminUsername() { return adminUsername; }
    public void setAdminUsername(String adminUsername) { this.adminUsername = adminUsername; }

    public String getAdminResponse() { return adminResponse; }
    public void setAdminResponse(String adminResponse) { this.adminResponse = adminResponse; }
}