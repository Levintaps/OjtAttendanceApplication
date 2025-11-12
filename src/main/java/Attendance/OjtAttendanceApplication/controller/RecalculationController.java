package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.service.RecalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/recalculation")
@CrossOrigin(origins = "*")
public class RecalculationController {

    @Autowired
    private RecalculationService recalculationService;

    /**
     * Recalculate ALL attendance records and student totals
     * WARNING: This is a heavy operation - use with caution
     */
    @PostMapping("/recalculate-all")
    public ResponseEntity<?> recalculateAll(@RequestParam(required = false) Boolean confirm) {
        try {
            if (!Boolean.TRUE.equals(confirm)) {
                return ResponseEntity.ok(Map.of(
                        "success", false,
                        "message", "Please confirm recalculation by adding ?confirm=true parameter",
                        "warning", "This will recalculate ALL attendance records and student totals"
                ));
            }

            Map<String, Object> result = recalculationService.recalculateAllRecords();
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Recalculate specific student's records and total
     */
    @PostMapping("/recalculate-student/{studentId}")
    public ResponseEntity<?> recalculateStudent(@PathVariable Long studentId) {
        try {
            Map<String, Object> result = recalculationService.recalculateStudentRecords(studentId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Recalculate specific attendance record
     */
    @PostMapping("/recalculate-record/{recordId}")
    public ResponseEntity<?> recalculateRecord(@PathVariable Long recordId) {
        try {
            Map<String, Object> result = recalculationService.recalculateAttendanceRecord(recordId);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Preview recalculation (dry run - doesn't save changes)
     */
    @GetMapping("/preview-recalculation")
    public ResponseEntity<?> previewRecalculation() {
        try {
            Map<String, Object> preview = recalculationService.previewRecalculation();
            return ResponseEntity.ok(preview);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Get recalculation statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<?> getRecalculationStats() {
        try {
            Map<String, Object> stats = recalculationService.getRecalculationStats();
            return ResponseEntity.ok(stats);

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
                return ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(400), message);
            }
        };
    }

    /* This is for update task with request approved

    // check if the record has a task with approved text
    SELECT id, time_in, time_out, total_hours, status, tasks_completed
    FROM attendance_records
    WHERE id = 94;

    // Update the task to ensure for the correct recalculation
    UPDATE attendance_records
    SET tasks_completed = CONCAT(
        tasks_completed,
        '\n\n[ADMIN APPROVED SCHEDULE OVERRIDE: Early work hours will be counted for this session]'
    )
    WHERE id = 94;
     */
}