package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
@CrossOrigin(origins = "*")
public class StudentController {

    @Autowired
    private AttendanceService attendanceService;

    // EXISTING REGISTRATION ENDPOINT (backward compatibility)
    @PostMapping("/register")
    public ResponseEntity<?> registerStudent(@Valid @RequestBody StudentRegistrationRequest request) {
        try {
            StudentRegistrationResponse response = attendanceService.registerStudent(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // NEW REGISTRATION ENDPOINT WITH REQUIRED HOURS
    @PostMapping("/register-with-hours")
    public ResponseEntity<?> registerStudentWithHours(@Valid @RequestBody StudentRegistrationRequestWithHours request) {
        try {
            StudentRegistrationResponse response = attendanceService.registerStudentWithHours(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // EXISTING DASHBOARD ENDPOINT
    @GetMapping("/dashboard/{idBadge}")
    public ResponseEntity<?> getStudentDashboard(@PathVariable String idBadge) {
        try {
            StudentDashboardResponse response = attendanceService.getStudentDashboard(idBadge);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // ENHANCED DASHBOARD WITH PROGRESS INFO
    @GetMapping("/dashboard-with-progress/{idBadge}")
    public ResponseEntity<?> getStudentDashboardWithProgress(@PathVariable String idBadge) {
        try {
            StudentDashboardResponse dashboardResponse = attendanceService.getStudentDashboard(idBadge);

            // We can enhance this to include progress information
            StudentDashboardWithProgressResponse progressResponse = new StudentDashboardWithProgressResponse();
            progressResponse.setIdBadge(dashboardResponse.getIdBadge());
            progressResponse.setFullName(dashboardResponse.getFullName());
            progressResponse.setCurrentStatus(dashboardResponse.getCurrentStatus());
            progressResponse.setTodayHours(dashboardResponse.getTodayHours());
            progressResponse.setTotalAccumulatedHours(dashboardResponse.getTotalAccumulatedHours());
            progressResponse.setAttendanceHistory(dashboardResponse.getAttendanceHistory());

            // Add progress information if available
            List<StudentDto> allStudents = attendanceService.getAllStudents();
            StudentDto currentStudent = allStudents.stream()
                    .filter(s -> s.getIdBadge() != null && s.getIdBadge().equals(idBadge))
                    .findFirst()
                    .orElse(null);

            if (currentStudent != null) {
                progressResponse.setRequiredHours(currentStudent.getRequiredHours());
                progressResponse.setHoursRemaining(currentStudent.getHoursRemaining());
                progressResponse.setCompletionPercentage(currentStudent.getCompletionPercentage());
            }

            return ResponseEntity.ok(progressResponse);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // GET ALL STUDENTS (EXISTING)
    @GetMapping("/all")
    public ResponseEntity<?> getAllStudents() {
        try {
            return ResponseEntity.ok(attendanceService.getAllStudents());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // CHECK BADGE AVAILABILITY
    @GetMapping("/check-badge/{idBadge}")
    public ResponseEntity<?> checkBadgeAvailability(@PathVariable String idBadge) {
        try {
            // This will be implemented to check if a badge is available for use
            boolean isAvailable = attendanceService.getAllStudents().stream()
                    .noneMatch(student -> idBadge.equals(student.getIdBadge()) &&
                            "ACTIVE".equals(student.getStatus()));

            BadgeAvailabilityResponse response = new BadgeAvailabilityResponse();
            response.setIdBadge(idBadge);
            response.setAvailable(isAvailable);
            response.setMessage(isAvailable ?
                    "Badge is available" :
                    "Badge is already in use by an active student");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // UTILITY METHOD
    private ErrorResponse createErrorResponse(String message) {
        return new ErrorResponse() {
            @Override
            public HttpStatusCode getStatusCode() {
                return HttpStatusCode.valueOf(400);
            }

            @Override
            public ProblemDetail getBody() {
                ProblemDetail problemDetail = ProblemDetail.forStatusAndDetail(
                        HttpStatusCode.valueOf(400), message);
                return problemDetail;
            }
        };
    }
}

// Additional DTOs for enhanced functionality
class StudentDashboardWithProgressResponse extends StudentDashboardResponse {
    private Double requiredHours;
    private Double hoursRemaining;
    private Double completionPercentage;

    public StudentDashboardWithProgressResponse() {
        super();
    }

    public Double getRequiredHours() { return requiredHours; }
    public void setRequiredHours(Double requiredHours) { this.requiredHours = requiredHours; }

    public Double getHoursRemaining() { return hoursRemaining; }
    public void setHoursRemaining(Double hoursRemaining) { this.hoursRemaining = hoursRemaining; }

    public Double getCompletionPercentage() { return completionPercentage; }
    public void setCompletionPercentage(Double completionPercentage) { this.completionPercentage = completionPercentage; }
}

class BadgeAvailabilityResponse {
    private String idBadge;
    private Boolean available;
    private String message;

    public BadgeAvailabilityResponse() {}

    public String getIdBadge() { return idBadge; }
    public void setIdBadge(String idBadge) { this.idBadge = idBadge; }

    public Boolean getAvailable() { return available; }
    public void setAvailable(Boolean available) { this.available = available; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}