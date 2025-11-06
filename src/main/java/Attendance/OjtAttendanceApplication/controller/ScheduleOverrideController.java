package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideRequestDto;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideResponseDto;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideReviewDto;
import Attendance.OjtAttendanceApplication.service.ScheduleOverrideService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule-override")
@CrossOrigin(origins = "*")
public class ScheduleOverrideController {

    @Autowired
    private ScheduleOverrideService scheduleOverrideService;

    /**
     * STUDENT: Submit schedule override request
     */
    @PostMapping("/request")
    public ResponseEntity<?> submitRequest(@Valid @RequestBody ScheduleOverrideRequestDto request) {
        try {
            ScheduleOverrideResponseDto response = scheduleOverrideService.submitRequest(request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Schedule override request submitted successfully. Admin will review your request.",
                    "request", response
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * STUDENT: Get my requests (all statuses)
     */
    @GetMapping("/my-requests/{idBadge}")
    public ResponseEntity<?> getMyRequests(@PathVariable String idBadge) {
        try {
            List<ScheduleOverrideResponseDto> requests = scheduleOverrideService.getStudentRequests(idBadge);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "requests", requests,
                    "total", requests.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * STUDENT: Get my pending requests
     */
    @GetMapping("/my-pending-requests/{idBadge}")
    public ResponseEntity<?> getMyPendingRequests(@PathVariable String idBadge) {
        try {
            List<ScheduleOverrideResponseDto> requests = scheduleOverrideService.getStudentPendingRequests(idBadge);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "pendingRequests", requests,
                    "total", requests.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * STUDENT: Check specific request status
     */
    @GetMapping("/request/{requestId}")
    public ResponseEntity<?> getRequestStatus(@PathVariable Long requestId) {
        try {
            ScheduleOverrideResponseDto request = scheduleOverrideService.getRequestById(requestId);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "request", request
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * ADMIN: Get all pending requests
     */
    @GetMapping("/admin/pending")
    public ResponseEntity<?> getAllPendingRequests() {
        try {
            List<ScheduleOverrideResponseDto> requests = scheduleOverrideService.getAllPendingRequests();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "pendingRequests", requests,
                    "total", requests.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * ADMIN: Get pending requests count
     */
    @GetMapping("/admin/pending-count")
    public ResponseEntity<?> getPendingCount() {
        try {
            Long count = scheduleOverrideService.getPendingRequestsCount();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "count", count
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * ADMIN: Approve or reject request
     */
    @PostMapping("/admin/review/{requestId}")
    public ResponseEntity<?> reviewRequest(@PathVariable Long requestId,
                                           @Valid @RequestBody ScheduleOverrideReviewDto review) {
        try {
            ScheduleOverrideResponseDto response = scheduleOverrideService.reviewRequest(requestId, review);

            String action = response.getStatus().equals("APPROVED") ? "approved" : "rejected";
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Request has been " + action,
                    "request", response
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
                return ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(400), message);
            }
        };
    }
}