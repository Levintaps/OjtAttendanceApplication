package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.AdminNotificationRepository;
import Attendance.OjtAttendanceApplication.repository.AttendanceRecordRepository;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import Attendance.OjtAttendanceApplication.service.AttendanceService;
import Attendance.OjtAttendanceApplication.service.NotificationService;
import Attendance.OjtAttendanceApplication.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private TaskService taskService;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AdminNotificationRepository adminNotificationRepository;



    @GetMapping("/notifications")
    public ResponseEntity<?> getAllNotifications() {
        try {
            List<AdminNotificationDto> notifications = notificationService.getAllNotifications();
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/notifications/unread")
    public ResponseEntity<?> getUnreadNotifications() {
        try {
            List<AdminNotificationDto> notifications = notificationService.getUnreadNotifications();
            return ResponseEntity.ok(notifications);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/notifications/count")
    public ResponseEntity<?> getUnreadNotificationCount() {
        try {
            Long count = notificationService.getUnreadNotificationCount();
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/notifications/{id}/read")
    public ResponseEntity<?> markNotificationAsRead(@PathVariable Long id) {
        try {
            notificationService.markNotificationAsRead(id);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/notifications/read-all")
    public ResponseEntity<?> markAllNotificationsAsRead() {
        try {
            notificationService.markAllNotificationsAsRead();
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/notifications/{id}")
    public ResponseEntity<?> deleteNotification(@PathVariable Long id) {
        try {
            notificationService.deleteNotification(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Notification deleted successfully"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/notifications/bulk")
    public ResponseEntity<?> deleteNotifications(@RequestBody List<Long> notificationIds) {
        try {
            int deletedCount = notificationService.deleteNotifications(notificationIds);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Notifications deleted successfully",
                    "deletedCount", deletedCount
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/notifications/clear-read")
    public ResponseEntity<?> clearReadNotifications() {
        try {
            int deletedCount = notificationService.clearReadNotifications();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Read notifications cleared",
                    "deletedCount", deletedCount
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/notifications/clear-all")
    public ResponseEntity<?> clearAllNotifications(@RequestParam(required = false) Boolean confirm) {
        try {
            if (!Boolean.TRUE.equals(confirm)) {
                throw new RuntimeException("Confirmation required to clear all notifications");
            }

            int deletedCount = notificationService.clearAllNotifications();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "All notifications cleared",
                    "deletedCount", deletedCount
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @DeleteMapping("/notifications/cleanup")
    public ResponseEntity<?> cleanupOldNotifications(@RequestParam(defaultValue = "30") Integer daysOld) {
        try {
            int deletedCount = notificationService.cleanupOldNotifications(daysOld);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", String.format("Cleaned up notifications older than %d days", daysOld),
                    "deletedCount", deletedCount
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/attendance/correct")
    public ResponseEntity<?> correctAttendance(@Valid @RequestBody AdminCorrectionRequest request) {
        try {
            AttendanceResponse response = attendanceService.processAdminCorrection(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/attendance/incomplete")
    public ResponseEntity<?> getIncompleteRecords() {
        try {
            List<AttendanceRecordDto> incompleteRecords = attendanceService.getIncompleteRecords();
            return ResponseEntity.ok(incompleteRecords);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // NEW STUDENT MANAGEMENT ENDPOINTS

    @PutMapping("/students/{id}/badge")
    public ResponseEntity<?> updateStudentBadge(@PathVariable Long id,
                                                @Valid @RequestBody UpdateBadgeRequest request) {
        try {
            StudentDto updatedStudent = attendanceService.updateStudentBadge(id, request);
            return ResponseEntity.ok(updatedStudent);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/students/{id}/status")
    public ResponseEntity<?> updateStudentStatus(@PathVariable Long id,
                                                 @Valid @RequestBody UpdateStatusRequest request) {
        try {
            StudentDto updatedStudent = attendanceService.updateStudentStatus(id, request);
            return ResponseEntity.ok(updatedStudent);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/students/{id}/complete")
    public ResponseEntity<?> completeStudent(@PathVariable Long id,
                                             @Valid @RequestBody CompleteStudentRequest request) {
        try {
            StudentDto completedStudent = attendanceService.completeStudent(id, request);
            return ResponseEntity.ok(completedStudent);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/students/{id}/required-hours")
    public ResponseEntity<?> updateRequiredHours(@PathVariable Long id,
                                                 @Valid @RequestBody UpdateRequiredHoursRequest request) {
        try {
            StudentDto updatedStudent = attendanceService.updateRequiredHours(id, request);
            return ResponseEntity.ok(updatedStudent);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // STUDENT LISTING ENDPOINTS

    @GetMapping("/students/active")
    public ResponseEntity<?> getActiveStudents() {
        try {
            List<StudentDto> students = attendanceService.getActiveStudents();
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/completed")
    public ResponseEntity<?> getCompletedStudents() {
        try {
            List<StudentDto> students = attendanceService.getCompletedStudents();
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/inactive")
    public ResponseEntity<?> getInactiveStudents() {
        try {
            List<StudentDto> students = attendanceService.getInactiveStudents();
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/all")
    public ResponseEntity<?> getAllStudents() {
        try {
            List<StudentDto> students = attendanceService.getAllStudents();
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // PROGRESS TRACKING ENDPOINTS

    @GetMapping("/students/near-completion")
    public ResponseEntity<?> getStudentsNearCompletion() {
        try {
            List<StudentDto> students = attendanceService.getStudentsNearCompletion();
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/ready-for-completion")
    public ResponseEntity<?> getStudentsReadyForCompletion() {
        try {
            List<StudentDto> students = attendanceService.getStudentsReadyForCompletion();
            return ResponseEntity.ok(students);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/{id}/progress")
    public ResponseEntity<?> getStudentProgress(@PathVariable Long id) {
        try {
            // This could be expanded to return detailed progress information
            StudentDto student = attendanceService.getAllStudents().stream()
                    .filter(s -> s.getId().equals(id))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Student not found"));
            return ResponseEntity.ok(student);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // UTILITY METHODS

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

    // NEW SCHEDULE MANAGEMENT ENDPOINTS
    @PutMapping("/students/{id}/schedule")
    public ResponseEntity<?> updateStudentSchedule(@PathVariable Long id,
                                                   @Valid @RequestBody UpdateScheduleRequest request) {
        try {
            ScheduleResponse response = attendanceService.updateStudentSchedule(id, request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/{id}/schedule")
    public ResponseEntity<?> getStudentSchedule(@PathVariable Long id) {
        try {
            ScheduleResponse response = attendanceService.getStudentSchedule(id);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PostMapping("/students/bulk-schedule")
    public ResponseEntity<?> setBulkStudentSchedules(@Valid @RequestBody BulkScheduleRequest request) {
        try {
            List<ScheduleResponse> responses = new ArrayList<>();

            for (Long studentId : request.getStudentIds()) {
                UpdateScheduleRequest scheduleRequest = new UpdateScheduleRequest(
                        request.getStartTime(),
                        request.getEndTime(),
                        request.getGracePeriodMinutes(),
                        request.getActive()
                );

                try {
                    ScheduleResponse response = attendanceService.updateStudentSchedule(studentId, scheduleRequest);
                    responses.add(response);
                } catch (Exception e) {
                    // Log error but continue with other students
                    System.err.println("Failed to update schedule for student ID " + studentId + ": " + e.getMessage());
                }
            }

            return ResponseEntity.ok(Map.of(
                    "message", "Bulk schedule update completed",
                    "updatedCount", responses.size(),
                    "totalRequested", request.getStudentIds().size(),
                    "schedules", responses
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/schedules/summary")
    public ResponseEntity<?> getSchedulesSummary() {
        try {
            List<Student> allStudents = studentRepository.findAll(); // Get Student entities, not DTOs

            Map<String, Object> summary = new HashMap<>();

            long studentsWithSchedule = allStudents.stream()
                    .filter(student -> student.hasActiveSchedule()) // Now this method exists
                    .count();

            long studentsWithoutSchedule = allStudents.size() - studentsWithSchedule;

            // Get most common schedule times
            Map<String, Long> scheduleFrequency = allStudents.stream()
                    .filter(student -> student.hasActiveSchedule())
                    .collect(Collectors.groupingBy(
                            student -> student.getScheduledStartTime() + " - " + student.getScheduledEndTime(),
                            Collectors.counting()
                    ));

            summary.put("totalStudents", allStudents.size());
            summary.put("studentsWithSchedule", studentsWithSchedule);
            summary.put("studentsWithoutSchedule", studentsWithoutSchedule);
            summary.put("scheduleFrequency", scheduleFrequency);

            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/late-arrivals")
    public ResponseEntity<?> getTodaysLateArrivals() {
        try {
            LocalDate today = LocalDate.now();
            List<AttendanceRecordDto> todayRecords = attendanceService.getAttendanceRecordsByDate(today);

            List<LateArrivalDto> lateArrivals = new ArrayList<>();

            for (AttendanceRecordDto record : todayRecords) {
                Optional<Student> studentOpt = studentRepository.findByIdBadge(record.getIdBadge());
                if (studentOpt.isPresent()) {
                    Student student = studentOpt.get();
                    if (student.hasActiveSchedule() && record.getTimeIn() != null) {
                        LocalTime arrivalTime = record.getTimeIn().toLocalTime();
                        if (student.isLateArrival(arrivalTime)) {
                            long lateMinutes = Duration.between(
                                    student.getScheduledStartTime().plusMinutes(student.getGracePeriodMinutes()),
                                    arrivalTime
                            ).toMinutes();

                            LocalTime expectedEndTime = student.calculateExpectedEndTime(arrivalTime);

                            LateArrivalDto lateArrival = new LateArrivalDto();
                            lateArrival.setStudentName(student.getFullName());
                            lateArrival.setIdBadge(student.getIdBadge());
                            lateArrival.setScheduledStartTime(student.getScheduledStartTime());
                            lateArrival.setActualArrivalTime(arrivalTime);
                            lateArrival.setLateMinutes((int) lateMinutes);
                            lateArrival.setExpectedEndTime(expectedEndTime);
                            lateArrival.setStatus(record.getStatus());

                            lateArrivals.add(lateArrival);
                        }
                    }
                }
            }

            return ResponseEntity.ok(lateArrivals);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/students/schedule-violations")
    public ResponseEntity<?> getScheduleViolations(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            if (date == null) {
                date = LocalDate.now();
            }

            List<AttendanceRecordDto> records = attendanceService.getAttendanceRecordsByDate(date);
            List<ScheduleViolationDto> violations = new ArrayList<>();

            for (AttendanceRecordDto record : records) {
                Optional<Student> studentOpt = studentRepository.findByIdBadge(record.getIdBadge());
                if (studentOpt.isPresent()) {
                    Student student = studentOpt.get();
                    if (student.hasActiveSchedule()) {
                        ScheduleViolationDto violation = analyzeScheduleViolation(student, record);
                        if (violation != null) {
                            violations.add(violation);
                        }
                    }
                }
            }

            return ResponseEntity.ok(violations);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // HELPER METHODS
    private ScheduleViolationDto analyzeScheduleViolation(Student student, AttendanceRecordDto record) {
        if (record.getTimeIn() == null) return null;

        LocalTime arrivalTime = record.getTimeIn().toLocalTime();
        ScheduleViolationDto violation = null;

        // Check for late arrival
        if (student.isLateArrival(arrivalTime)) {
            violation = new ScheduleViolationDto();
            violation.setStudentName(student.getFullName());
            violation.setIdBadge(student.getIdBadge());
            violation.setViolationType("LATE_ARRIVAL");
            violation.setScheduledTime(student.getScheduledStartTime());
            violation.setActualTime(arrivalTime);

            long lateMinutes = Duration.between(
                    student.getScheduledStartTime().plusMinutes(student.getGracePeriodMinutes()),
                    arrivalTime
            ).toMinutes();
            violation.setMinutesDeviation((int) lateMinutes);
            violation.setDescription("Arrived " + lateMinutes + " minutes late");
        }

        // Check for early departure (if timed out)
        if (record.getTimeOut() != null && student.hasActiveSchedule()) {
            LocalTime departureTime = record.getTimeOut().toLocalTime();
            LocalTime expectedEndTime = student.calculateExpectedEndTime(arrivalTime);

            if (expectedEndTime != null && departureTime.isBefore(expectedEndTime)) {
                if (violation == null) {
                    violation = new ScheduleViolationDto();
                    violation.setStudentName(student.getFullName());
                    violation.setIdBadge(student.getIdBadge());
                    violation.setViolationType("EARLY_DEPARTURE");
                } else {
                    violation.setViolationType("LATE_ARRIVAL_AND_EARLY_DEPARTURE");
                }

                long earlyMinutes = Duration.between(departureTime, expectedEndTime).toMinutes();
                violation.setDescription(violation.getDescription() +
                        (violation.getDescription().isEmpty() ? "" : " and ") +
                        "left " + earlyMinutes + " minutes early");
            }
        }

        return violation;
    }


    /**
     * Get task logging statistics for a specific date
     */
    @GetMapping("/task-analytics")
    public ResponseEntity<?> getTaskAnalytics(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            if (date == null) {
                date = LocalDate.now();
            }

            TaskLoggingStats stats = attendanceService.getTaskLoggingStats(date);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Get detailed task information for a specific attendance record
     */
    @GetMapping("/attendance/{recordId}/tasks")
    public ResponseEntity<?> getRecordTasks(@PathVariable Long recordId) {
        try {
            // Use taskService if available, otherwise implement in attendanceService
            AttendanceTasksResponse taskDetails = taskService.getTasksForAttendanceRecord(recordId);
            return ResponseEntity.ok(taskDetails);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Get task logging trends over a date range
     */
    @GetMapping("/task-trends")
    public ResponseEntity<?> getTaskTrends(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            List<TaskLoggingStats> trends = new ArrayList<>();
            LocalDate current = startDate;

            while (!current.isAfter(endDate)) {
                TaskLoggingStats dayStats = attendanceService.getTaskLoggingStats(current);
                trends.add(dayStats);
                current = current.plusDays(1);
            }

            return ResponseEntity.ok(Map.of(
                    "trends", trends,
                    "summary", calculateTrendSummary(trends)
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    // Helper method for trend summary
    private Map<String, Object> calculateTrendSummary(List<TaskLoggingStats> trends) {
        if (trends.isEmpty()) {
            return Map.of("error", "No data available");
        }

        double avgAdoptionRate = trends.stream()
                .mapToDouble(TaskLoggingStats::getTaskAdoptionRate)
                .average()
                .orElse(0.0);

        int totalTasks = trends.stream()
                .mapToInt(TaskLoggingStats::getTotalTasksLogged)
                .sum();

        int totalRecords = trends.stream()
                .mapToInt(TaskLoggingStats::getTotalAttendanceRecords)
                .sum();

        return Map.of(
                "averageAdoptionRate", Math.round(avgAdoptionRate * 100.0) / 100.0,
                "totalTasksLogged", totalTasks,
                "totalAttendanceRecords", totalRecords,
                "periodDays", trends.size()
        );
    }

    @DeleteMapping("/students/{id}")
    public ResponseEntity<?> deleteStudent(@PathVariable Long id) {
        try {
            StudentDto deletedStudent = attendanceService.deleteStudent(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Student " + deletedStudent.getFullName() + " has been permanently deleted",
                    "deletedStudent", deletedStudent
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/students/{id}/deactivate")
    public ResponseEntity<?> deactivateStudent(@PathVariable Long id,
                                               @Valid @RequestBody DeactivateStudentRequest request) {
        try {
            StudentDto deactivatedStudent = attendanceService.deactivateStudent(id, request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Student has been deactivated",
                    "student", deactivatedStudent
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @PutMapping("/students/{id}/ojt-start-date")
    public ResponseEntity<?> updateOjtStartDate(@PathVariable Long id,
                                                @Valid @RequestBody UpdateOjtStartDateRequest request) {
        try {
            StudentDto updatedStudent = attendanceService.updateOjtStartDate(id, request);
            return ResponseEntity.ok(updatedStudent);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/attendance/records/calendar")
    public ResponseEntity<?> getAttendanceRecordsByCalendarDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            List<AttendanceRecordDto> records = attendanceService.getAttendanceRecordsByCalendarDate(date);
            return ResponseEntity.ok(records);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/attendance/records")
    public ResponseEntity<?> getAttendanceRecords(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            if (date != null) {
                // This uses workDate for night shift handling
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

    @GetMapping("/attendance/active-sessions")
    public ResponseEntity<?> getActiveSessions() {
        try {
            List<AttendanceRecord> activeRecords = attendanceRecordRepository.findAllTimedInRecords();

            List<AttendanceRecordDto> recordDtos = activeRecords.stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(recordDtos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    private AttendanceRecordDto convertToDto(AttendanceRecord record) {
        AttendanceRecordDto dto = new AttendanceRecordDto();
        dto.setId(record.getId());
        dto.setStudentName(record.getStudent().getFullName());
        dto.setIdBadge(record.getStudent().getIdBadge());
        dto.setAttendanceDate(record.getAttendanceDate());
        dto.setTimeIn(record.getTimeIn());
        dto.setTimeOut(record.getTimeOut());
        dto.setTotalHours(record.getTotalHours());
        dto.setRegularHours(record.getRegularHours());
        dto.setOvertimeHours(record.getOvertimeHours());
        dto.setUndertimeHours(record.getUndertimeHours());
        dto.setTasksCompleted(record.getTasksCompleted());
        dto.setStatus(record.getStatus().name());
        dto.setBreakDeducted(record.getBreakDeducted());
        return dto;
    }

    /**
     * Admin manual attendance entry
     * Allows admins to manually create attendance records for students
     */
    @PostMapping("/attendance/manual-entry")
    public ResponseEntity<?> manualAttendanceEntry(@Valid @RequestBody ManualAttendanceRequest request) {
        try {
            AttendanceResponse response = attendanceService.processManualAttendance(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Handle schedule override request from student
     */
    @PostMapping("/schedule-override/request")
    public ResponseEntity<?> submitScheduleOverrideRequest(@Valid @RequestBody ScheduleOverrideRequest request) {
        try {
            // Find student
            Student student = studentRepository.findByIdBadge(request.getIdBadge())
                    .orElseThrow(() -> new RuntimeException("Student not found"));

            // Find attendance record
            AttendanceRecord record = attendanceRecordRepository.findById(request.getRecordId())
                    .orElseThrow(() -> new RuntimeException("Attendance record not found"));

            // Create notification for admin
            String message = String.format(
                    "SCHEDULE OVERRIDE REQUEST - %s (%s) arrived %d minutes early. " +
                            "Scheduled: %s, Actual: %s. Reason: %s",
                    student.getFullName(),
                    student.getIdBadge(),
                    request.getEarlyMinutes(),
                    request.getScheduledTime(),
                    request.getActualTime(),
                    request.getReason()
            );

            AdminNotification notification = new AdminNotification(
                    student,
                    record,
                    NotificationType.LONG_WORK_SESSION, // Reuse existing type or create new one
                    message
            );

            adminNotificationRepository.save(notification);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Schedule override request submitted successfully"
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Admin approves schedule override
     */
    @PostMapping("/schedule-override/approve/{recordId}")
    public ResponseEntity<?> approveScheduleOverride(@PathVariable Long recordId) {
        try {
            AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                    .orElseThrow(() -> new RuntimeException("Attendance record not found"));

            // Add flag to indicate schedule was overridden for this day
            String currentTasks = record.getTasksCompleted() != null ? record.getTasksCompleted() : "";
            record.setTasksCompleted(currentTasks + "\n[ADMIN APPROVED: Early work hours counted - Schedule override granted]");

            attendanceRecordRepository.save(record);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Schedule override approved. Early hours will be counted for this session."
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Admin rejects schedule override
     */
    @PostMapping("/schedule-override/reject/{recordId}")
    public ResponseEntity<?> rejectScheduleOverride(@PathVariable Long recordId,
                                                    @RequestBody Map<String, String> request) {
        try {
            String rejectReason = request.get("reason");

            AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                    .orElseThrow(() -> new RuntimeException("Attendance record not found"));

            // Add flag to indicate schedule was rejected
            String currentTasks = record.getTasksCompleted() != null ? record.getTasksCompleted() : "";
            record.setTasksCompleted(currentTasks +
                    "\n[ADMIN REJECTED: Early work hours NOT counted - Reason: " + rejectReason + "]");

            attendanceRecordRepository.save(record);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Schedule override rejected"
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }
}

