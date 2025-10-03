package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

// DTO for updating required hours
public class UpdateRequiredHoursRequest {

    @NotNull(message = "Required hours is required")
    @Positive(message = "Required hours must be positive")
    private Double requiredHours;

    public UpdateRequiredHoursRequest() {}

    public UpdateRequiredHoursRequest(Double requiredHours) {
        this.requiredHours = requiredHours;
    }

    public Double getRequiredHours() { return requiredHours; }
    public void setRequiredHours(Double requiredHours) { this.requiredHours = requiredHours; }
}
