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
}
