package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.dto.AttendanceRequest;
import Attendance.OjtAttendanceApplication.dto.AttendanceRequestWithTOTP;
import Attendance.OjtAttendanceApplication.dto.AttendanceResponse;
import Attendance.OjtAttendanceApplication.dto.AttendanceSessionInfo;
import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import Attendance.OjtAttendanceApplication.service.AttendanceService;
import Attendance.OjtAttendanceApplication.service.TotpService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@CrossOrigin(origins = "*")
public class AttendanceController {

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private TotpService totpService;

    @Autowired
    private StudentRepository studentRepository;

    /**
     * NEW: Log attendance with TOTP authentication (SECURE)
     */
    @PostMapping("/log-with-totp")
    public ResponseEntity<?> logAttendanceWithTotp(@Valid @RequestBody AttendanceRequestWithTOTP request) {
        try {
            // Find student
            Student student = studentRepository.findByIdBadge(request.getIdBadge())
                    .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

            // Check if TOTP is set up
            if (student.getTotpSecret() == null || student.getTotpSecret().isEmpty()) {
                throw new RuntimeException("TOTP not set up. Please complete TOTP setup first.");
            }

            // Verify TOTP code
            boolean isValidCode = totpService.verifyCode(student.getTotpSecret(), request.getTotpCode());

            if (!isValidCode) {
                throw new RuntimeException("Invalid TOTP code. Please check your Google Authenticator app and try again.");
            }

            // If TOTP is valid but not yet enabled, enable it now
            if (student.getTotpEnabled() == null || !student.getTotpEnabled()) {
                student.setTotpEnabled(true);
                studentRepository.save(student);
            }

            // Process attendance using existing service
            AttendanceRequest attendanceRequest = new AttendanceRequest();
            attendanceRequest.setIdBadge(request.getIdBadge());
            attendanceRequest.setTasksCompleted(request.getTasksCompleted());

            AttendanceResponse response = attendanceService.processAttendance(attendanceRequest);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * LEGACY: Log attendance without TOTP (for backward compatibility during migration)
     * TODO: Remove this endpoint after all students have TOTP enabled
     */
    @PostMapping("/log")
    public ResponseEntity<?> logAttendance(@Valid @RequestBody AttendanceRequest request) {
        try {
            // Check if student has TOTP enabled
            Student student = studentRepository.findByIdBadge(request.getIdBadge())
                    .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

            if (student.getTotpEnabled() != null && student.getTotpEnabled()) {
                throw new RuntimeException("TOTP is enabled for this student. Please use /log-with-totp endpoint and provide TOTP code.");
            }

            AttendanceResponse response = attendanceService.processAttendance(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/records")
    public ResponseEntity<?> getAttendanceRecords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            if (date != null) {
                return ResponseEntity.ok(attendanceService.getAttendanceRecordsByDate(date));
            } else if (startDate != null && endDate != null) {
                return ResponseEntity.ok(attendanceService.getAttendanceRecordsByDateRange(startDate, endDate));
            } else {
                return ResponseEntity.badRequest().body(createErrorResponse("Either 'date' or both 'startDate' and 'endDate' parameters are required"));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/session/{idBadge}")
    public ResponseEntity<?> getCurrentSession(@PathVariable String idBadge) {
        try {
            AttendanceSessionInfo sessionInfo = attendanceService.getCurrentSessionInfo(idBadge);
            return ResponseEntity.ok(sessionInfo);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/can-log-tasks/{idBadge}")
    public ResponseEntity<?> canLogTasks(@PathVariable String idBadge) {
        try {
            boolean canLog = attendanceService.canLogTasks(idBadge);
            return ResponseEntity.ok(Map.of(
                    "canLogTasks", canLog,
                    "message", canLog ? "Student can log tasks" : "No active session found"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

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