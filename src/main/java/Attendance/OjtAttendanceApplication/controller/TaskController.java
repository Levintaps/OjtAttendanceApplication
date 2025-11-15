package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    @Autowired
    private TaskService taskService;

    @PostMapping("/add")
    public ResponseEntity<?> addTask(@Valid @RequestBody AddTaskRequest request) {
        try {
            TaskEntryDto task = taskService.addTask(request);
            return ResponseEntity.ok(task);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/record/{recordId}")
    public ResponseEntity<?> getTasksForRecord(@PathVariable Long recordId) {
        try {
            AttendanceTasksResponse tasks = taskService.getTasksForAttendanceRecord(recordId);
            return ResponseEntity.ok(tasks);
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

    @PostMapping("/report/multiple-badges")
    public ResponseEntity<?> getTasksForMultipleBadges(
            @RequestBody List<String> idBadges,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            if (idBadges == null || idBadges.isEmpty()) {
                throw new RuntimeException("ID badges list cannot be empty");
            }

            if (date == null) {
                date = LocalDate.now();
            }

            List<TaskReportResponse> reports = taskService.getTasksForMultipleBadges(idBadges, date);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "date", date.toString(),
                    "totalStudents", reports.size(),
                    "reports", reports
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }


    @GetMapping("/report/by-schedule")
    public ResponseEntity<?> getTasksBySchedule(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.TIME) LocalTime endTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            if (startTime == null || endTime == null) {
                throw new RuntimeException("Start time and end time are required");
            }

            if (date == null) {
                date = LocalDate.now();
            }

            List<TaskReportResponse> reports = taskService.getTasksBySchedule(startTime, endTime, date);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "date", date.toString(),
                    "schedule", String.format("%s - %s", startTime, endTime),
                    "totalStudents", reports.size(),
                    "reports", reports
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/report/date")
    public ResponseEntity<?> getAllTasksForDate(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            if (date == null) {
                date = LocalDate.now();
            }

            List<TaskReportResponse> reports = taskService.getAllTasksForDate(date);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "date", date.toString(),
                    "totalStudents", reports.size(),
                    "reports", reports
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    @GetMapping("/report/student/{idBadge}")
    public ResponseEntity<?> getStudentTasksForDate(
            @PathVariable String idBadge,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        try {
            if (date == null) {
                date = LocalDate.now();
            }

            List<TaskReportResponse> reports = taskService.getTasksForMultipleBadges(
                    Collections.singletonList(idBadge),
                    date
            );

            if (reports.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "No tasks found for this date",
                        "date", date.toString(),
                        "idBadge", idBadge
                ));
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "date", date.toString(),
                    "report", reports.get(0)
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }
}
