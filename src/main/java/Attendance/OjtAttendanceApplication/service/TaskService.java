package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class TaskService {

    @Autowired
    private TaskEntryRepository taskEntryRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private StudentRepository studentRepository;

    /**
     * Add a task entry for a student's current session
     */
    public TaskEntryDto addTask(AddTaskRequest request) {
        // Find active attendance record
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

        LocalDate today = LocalDate.now();
        AttendanceRecord activeRecord = attendanceRecordRepository
                .findByStudentAndAttendanceDateAndStatus(student, today, AttendanceStatus.TIMED_IN)
                .orElseThrow(() -> new RuntimeException("No active attendance session found for today"));

        // Validate task timing
        validateTaskTiming(request.getCompletedAt(), activeRecord.getTimeIn());

        // Create and save task entry
        TaskEntry taskEntry = new TaskEntry(
                activeRecord,
                request.getTaskDescription().trim(),
                request.getCompletedAt(),
                request.getAddedDuringTimeout() != null ? request.getAddedDuringTimeout() : false
        );

        TaskEntry savedTask = taskEntryRepository.save(taskEntry);
        return convertToDto(savedTask);
    }

    /**
     * Get all tasks for a student's attendance record
     */
    public List<TaskEntryDto> getTasksForRecord(Long recordId) {
        AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        List<TaskEntry> tasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(record);
        return tasks.stream().map(this::convertToDto).collect(Collectors.toList());
    }

    /**
     * Check if student has tasks for today
     */
    public boolean hasTasksForToday(String idBadge) {
        return taskEntryRepository.existsTasksForStudentToday(idBadge);
    }

    /**
     * Get consolidated tasks for time-out process
     */
    public String getConsolidatedTasksForTimeOut(AttendanceRecord record) {
        List<TaskEntry> tasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(record);

        if (tasks.isEmpty()) {
            return null;
        }

        StringBuilder consolidated = new StringBuilder();
        consolidated.append("=== Tasks Completed Today ===\n");

        for (int i = 0; i < tasks.size(); i++) {
            TaskEntry task = tasks.get(i);
            consolidated.append(String.format("%d. [%s] %s",
                    i + 1,
                    task.getCompletedAt().toLocalTime(),
                    task.getTaskDescription()));

            if (Boolean.TRUE.equals(task.getAddedDuringTimeout())) {
                consolidated.append(" [Added during time-out]");
            }

            if (i < tasks.size() - 1) {
                consolidated.append("\n");
            }
        }

        return consolidated.toString();
    }

    /**
     * Get tasks for attendance record with detailed response
     */
    public AttendanceTasksResponse getTasksForAttendanceRecord(Long recordId) {
        AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        List<TaskEntry> tasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(record);
        List<TaskEntryDto> taskDtos = tasks.stream().map(this::convertToDto).collect(Collectors.toList());

        AttendanceTasksResponse response = new AttendanceTasksResponse();
        response.setAttendanceRecordId(recordId);
        response.setStudentName(record.getStudent().getFullName());
        response.setIdBadge(record.getStudent().getIdBadge());
        response.setAttendanceDate(record.getAttendanceDate());
        response.setTasks(taskDtos);
        response.setTaskCount(tasks.size());
        response.setHasRealTimeTasks(tasks.stream().anyMatch(t -> !Boolean.TRUE.equals(t.getAddedDuringTimeout())));
        response.setHasTimeoutTasks(tasks.stream().anyMatch(t -> Boolean.TRUE.equals(t.getAddedDuringTimeout())));

        return response;
    }

    private void validateTaskTiming(LocalDateTime completedAt, LocalDateTime sessionStart) {
        LocalDateTime now = LocalDateTime.now();

        if (completedAt.isBefore(sessionStart)) {
            throw new RuntimeException("Task completion time cannot be before your time-in today");
        }

        if (completedAt.isAfter(now.plusMinutes(5))) {
            throw new RuntimeException("Task completion time cannot be in the future");
        }
    }

    private TaskEntryDto convertToDto(TaskEntry task) {
        return new TaskEntryDto(
                task.getId(),
                task.getTaskDescription(),
                task.getCompletedAt(),
                task.getAddedAt(),
                task.getAddedDuringTimeout()
        );
    }

    public boolean hasTasksForRecord(Long recordId) {
        try {
            AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                    .orElse(null);
            if (record == null) return false;

            List<TaskEntry> tasks = taskEntryRepository
                    .findByAttendanceRecordOrderByCompletedAtAsc(record);
            return !tasks.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    @Transactional
    public void deleteTasksForRecord(Long recordId) {
        AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        List<TaskEntry> tasks = taskEntryRepository
                .findByAttendanceRecordOrderByCompletedAtAsc(record);

        taskEntryRepository.deleteAll(tasks);
    }
}