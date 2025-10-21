package Attendance.OjtAttendanceApplication.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * DTO for updating student's OJT start date
 */
public class UpdateOjtStartDateRequest {

    @NotNull(message = "OJT start date is required")
    private LocalDate ojtStartDate;

    public UpdateOjtStartDateRequest() {}

    public UpdateOjtStartDateRequest(LocalDate ojtStartDate) {
        this.ojtStartDate = ojtStartDate;
    }

    public LocalDate getOjtStartDate() {
        return ojtStartDate;
    }

    public void setOjtStartDate(LocalDate ojtStartDate) {
        this.ojtStartDate = ojtStartDate;
    }
}