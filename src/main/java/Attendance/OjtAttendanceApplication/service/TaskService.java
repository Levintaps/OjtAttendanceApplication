package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Comparator;

// Add this field to the TaskService class

@Service
@Transactional
public class TaskService {

    @Autowired
    private TaskEntryRepository taskEntryRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private StudentRepository studentRepository;

    private static final Logger logger = LoggerFactory.getLogger(TaskService.class);

    /**
     * Add a task entry for a student's current session
     */
    public TaskEntryDto addTask(AddTaskRequest request) {
        // Find active attendance record (regardless of date)
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

        // Find ANY active session for this student (not just today's date)
        AttendanceRecord activeRecord = attendanceRecordRepository
                .findActiveSessionByStudent(student)
                .orElseThrow(() -> new RuntimeException("No active attendance session found. Please time in first."));

        // Validate task timing - use active record's time in, not current date
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
            throw new RuntimeException("Task completion time cannot be before your time-in for this session");
        }

        // Allow tasks up to 5 minutes in the future (for clock sync issues)
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

    public List<TaskReportResponse> getTasksForMultipleBadges(List<String> idBadges, LocalDate date) {
        List<TaskReportResponse> reports = new ArrayList<>();

        for (String idBadge : idBadges) {
            try {
                Student student = studentRepository.findByIdBadge(idBadge)
                        .orElse(null);

                if (student == null) {
                    logger.warn("Student not found with ID badge: {}", idBadge);
                    continue;
                }

                TaskReportResponse report = buildTaskReport(student, date);
                if (report != null) {
                    reports.add(report);
                }
            } catch (Exception e) {
                logger.error("Error retrieving tasks for badge {}: {}", idBadge, e.getMessage());
            }
        }

        // Sort by student name
        reports.sort(Comparator.comparing(TaskReportResponse::getStudentName));

        return reports;
    }

    public List<TaskReportResponse> getTasksBySchedule(LocalTime startTime, LocalTime endTime, LocalDate date) {
        List<Student> students = studentRepository.findAll();
        List<TaskReportResponse> reports = new ArrayList<>();

        for (Student student : students) {
            // Check if student has matching schedule
            if (student.hasActiveSchedule() &&
                    student.getScheduledStartTime().equals(startTime) &&
                    student.getScheduledEndTime().equals(endTime)) {

                try {
                    TaskReportResponse report = buildTaskReport(student, date);
                    if (report != null) {
                        reports.add(report);
                    }
                } catch (Exception e) {
                    logger.error("Error building report for student {}: {}", student.getFullName(), e.getMessage());
                }
            }
        }

        // Sort by student name
        reports.sort(Comparator.comparing(TaskReportResponse::getStudentName));

        return reports;
    }

    public List<TaskReportResponse> getAllTasksForDate(LocalDate date) {
        List<AttendanceRecord> records = attendanceRecordRepository
                .findByWorkDateOrderByTimeInAsc(date);

        List<TaskReportResponse> reports = new ArrayList<>();

        for (AttendanceRecord record : records) {
            try {
                TaskReportResponse report = buildTaskReportFromRecord(record);
                if (report != null) {
                    reports.add(report);
                }
            } catch (Exception e) {
                logger.error("Error building report from record {}: {}", record.getId(), e.getMessage());
            }
        }

        return reports;
    }

    private TaskReportResponse buildTaskReport(Student student, LocalDate date) {
        // Find attendance records for this date
        List<AttendanceRecord> dayRecords = attendanceRecordRepository
                .findByStudentAndWorkDate(student, date);

        if (dayRecords.isEmpty()) {
            // Student didn't work this day - return null or empty report
            return null;
        }

        // Get the main record (first time-in of the day)
        AttendanceRecord mainRecord = dayRecords.stream()
                .min(Comparator.comparing(AttendanceRecord::getTimeIn))
                .orElse(null);

        if (mainRecord == null) {
            return null;
        }

        return buildTaskReportFromRecord(mainRecord);
    }

    private TaskReportResponse buildTaskReportFromRecord(AttendanceRecord record) {
        Student student = record.getStudent();

        TaskReportResponse report = new TaskReportResponse();
        report.setIdBadge(student.getIdBadge());
        report.setStudentName(student.getFullName());
        report.setSchool(student.getSchool());
        report.setDate(record.getWorkDate());

        // Schedule information
        if (student.hasActiveSchedule()) {
            report.setScheduledStartTime(student.getScheduledStartTime());
            report.setScheduledEndTime(student.getScheduledEndTime());
            report.setScheduleDisplayText(
                    String.format("%s - %s",
                            student.getScheduledStartTime().toString(),
                            student.getScheduledEndTime().toString())
            );
        } else {
            report.setScheduleDisplayText("No Schedule");
        }

        // Actual times
        if (record.getTimeIn() != null) {
            report.setActualTimeIn(record.getTimeIn().toLocalTime());
        }
        if (record.getTimeOut() != null) {
            report.setActualTimeOut(record.getTimeOut().toLocalTime());
        }

        report.setTotalHours(record.getTotalHours());

        // Get tasks for this record
        List<TaskEntry> tasks = taskEntryRepository
                .findByAttendanceRecordOrderByCompletedAtAsc(record);

        List<TaskEntryDto> taskDtos = tasks.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());

        report.setTasks(taskDtos);
        report.setTaskCount(tasks.size());

        return report;
    }
}