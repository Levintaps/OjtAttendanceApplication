package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.AttendanceRecordRepository;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import Attendance.OjtAttendanceApplication.repository.TaskEntryRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class AttendanceService {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private TaskEntryRepository taskEntryRepository;

    @Autowired
    private TaskService taskService;

    public StudentRegistrationResponse registerStudent(StudentRegistrationRequest request) {
        if (studentRepository.countActiveStudentsByIdBadge(request.getIdBadge()) > 0) {
            throw new RuntimeException("Student with ID badge " + request.getIdBadge() + " already exists as active");
        }

        if (!request.getIdBadge().matches("\\d{4}")) {
            throw new RuntimeException("ID badge must be exactly 4 digits");
        }

        Student student = new Student(request.getIdBadge(), request.getFullName(), request.getSchool());
        Student savedStudent = studentRepository.save(student);

        return new StudentRegistrationResponse(
                savedStudent.getId(),
                savedStudent.getIdBadge(),
                savedStudent.getFullName(),
                savedStudent.getSchool(),
                "Student registered successfully",
                true
        );
    }

    public StudentRegistrationResponse registerStudentWithHours(StudentRegistrationRequestWithHours request) {
        if (studentRepository.countActiveStudentsByIdBadge(request.getIdBadge()) > 0) {
            throw new RuntimeException("Student with ID badge " + request.getIdBadge() + " already exists as active");
        }

        if (!request.getIdBadge().matches("\\d{4}")) {
            throw new RuntimeException("ID badge must be exactly 4 digits");
        }

        Student student = new Student(request.getIdBadge(), request.getFullName(),
                request.getSchool(), request.getRequiredHours());
        Student savedStudent = studentRepository.save(student);

        return new StudentRegistrationResponse(
                savedStudent.getId(),
                savedStudent.getIdBadge(),
                savedStudent.getFullName(),
                savedStudent.getSchool(),
                "Student registered successfully with required hours: " + request.getRequiredHours(),
                true
        );
    }

    public AttendanceResponse processAttendance(AttendanceRequest request) {
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

        if (student.getStatus() != StudentStatus.ACTIVE) {
            throw new RuntimeException("Only active students can log attendance. Current status: " + student.getStatus());
        }

        // CRITICAL: First check if there's ANY active session (regardless of date)
        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            // Student has an active session - process time-out
            AttendanceRecord record = activeSession.get();

            // Check if any tasks have been logged for this session
            boolean hasLoggedTasks = taskService.hasTasksForRecord(record.getId());

            if (hasLoggedTasks) {
                return processTimeOutWithExistingTasks(record, request.getTasksCompleted());
            } else {
                return processTraditionalTimeOut(record, request.getTasksCompleted());
            }
        }

        // No active session - check if already completed today
        LocalDate currentWorkDate = getCurrentWorkDate();
        List<AttendanceRecord> todayRecords = attendanceRecordRepository
                .findByStudentAndWorkDate(student, currentWorkDate);

        // Check if there's a completed record for this work day
        boolean hasCompletedToday = todayRecords.stream()
                .anyMatch(record -> record.getStatus() != AttendanceStatus.TIMED_IN);

        if (hasCompletedToday) {
            throw new RuntimeException("Attendance already completed for this work day. You cannot time in again.");
        }

        // All checks passed - allow time-in
        return processScheduleAwareTimeIn(student);
    }

    private LocalDate calculateWorkDate(LocalDateTime dateTime) {
        // Night shift handling: 12:00 AM - 5:59 AM belongs to previous day
        if (dateTime.getHour() < 6) {
            return dateTime.toLocalDate().minusDays(1);
        }
        return dateTime.toLocalDate();
    }

    private LocalDate getCurrentWorkDate() {
        return calculateWorkDate(LocalDateTime.now());
    }

    private AttendanceResponse processTraditionalTimeOut(AttendanceRecord record, String tasksCompleted) {
        if (tasksCompleted == null || tasksCompleted.trim().isEmpty()) {
            throw new RuntimeException("Tasks completed is required for time out");
        }

        LocalDateTime now = LocalDateTime.now();

        record.setTimeOut(now);
        record.setTasksCompleted(tasksCompleted);
        record.setStatus(AttendanceStatus.TIMED_OUT);

        // Calculate hours and update student
        HoursCalculation calculation = calculateScheduleAwareHours(record);
        updateRecordHours(record, calculation);

        Student student = record.getStudent();
        // Fix: Update student's total accumulated hours
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

        // Save the updated record and student
        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        // Return proper AttendanceResponse
        return new AttendanceResponse(
                "TIME_OUT",
                buildTimeOutMessage(student, record),
                true,
                student.getFullName(),
                student.getIdBadge(),
                record.getTimeIn(),
                now,
                roundToNearestHour(record.getTimeIn()),
                roundToNearestHour(now),
                calculation.getTotalHours(),
                calculation.getRegularHours(),
                calculation.getOvertimeHours(),
                calculation.getUndertimeHours(),
                student.getTotalAccumulatedHours(),
                tasksCompleted,
                calculation.isBreakDeducted()
        );
    }


    private AttendanceResponse processScheduleAwareTimeIn(Student student) {
        LocalDateTime now = LocalDateTime.now();
        LocalTime arrivalTime = now.toLocalTime();

        AttendanceRecord record = new AttendanceRecord(student, now);
        record.setStatus(AttendanceStatus.TIMED_IN);
        record.setWorkDate(calculateWorkDate(now)); // Set work date

        attendanceRecordRepository.save(record);

        // Build response with schedule information
        AttendanceResponse response = new AttendanceResponse(
                "TIME_IN",
                buildTimeInMessage(student, arrivalTime),
                true,
                student.getFullName(),
                student.getIdBadge(),
                now,
                null,
                roundToNearestHour(now),
                null,
                0.0,
                0.0,
                0.0,
                0.0,
                student.getTotalAccumulatedHours(),
                null,
                false
        );

        return response;
    }

    // SCHEDULE-AWARE TIME OUT PROCESSING
    private AttendanceResponse processScheduleAwareTimeOut(AttendanceRecord record, String tasksCompleted) {
        LocalDateTime now = LocalDateTime.now();

        if (tasksCompleted == null || tasksCompleted.trim().isEmpty()) {
            throw new RuntimeException("Tasks completed is required for time out");
        }

        record.setTimeOut(now);
        record.setTasksCompleted(tasksCompleted);
        record.setStatus(AttendanceStatus.TIMED_OUT);

        // Calculate hours using schedule-aware logic
        HoursCalculation calculation = calculateScheduleAwareHours(record);

        record.setTotalHours(calculation.getTotalHours());
        record.setRegularHours(calculation.getRegularHours());
        record.setOvertimeHours(calculation.getOvertimeHours());
        record.setUndertimeHours(calculation.getUndertimeHours());
        record.setBreakDeducted(calculation.isBreakDeducted());

        // Update student's total accumulated hours
        Student student = record.getStudent();
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        return new AttendanceResponse(
                "TIME_OUT",
                buildTimeOutMessage(student, record),
                true,
                student.getFullName(),
                student.getIdBadge(),
                record.getTimeIn(),
                now,
                roundToNearestHour(record.getTimeIn()),
                roundToNearestHour(now),
                calculation.getTotalHours(),
                calculation.getRegularHours(),
                calculation.getOvertimeHours(),
                calculation.getUndertimeHours(),
                student.getTotalAccumulatedHours(),
                tasksCompleted,
                calculation.isBreakDeducted()
        );
    }

    // SCHEDULE-AWARE HOURS CALCULATION
    private HoursCalculation calculateScheduleAwareHours(AttendanceRecord record) {
        Student student = record.getStudent();
        LocalTime timeIn = record.getTimeIn().toLocalTime();
        LocalTime timeOut = record.getTimeOut().toLocalTime();

        // If no active schedule, use original calculation
        if (!student.hasActiveSchedule()) {
            return calculateOriginalHours(record.getTimeIn(), record.getTimeOut());
        }

        // Calculate work duration
        Duration workDuration = Duration.between(record.getTimeIn(), record.getTimeOut());
        double rawHours = workDuration.toMinutes() / 60.0;

        HoursCalculation calculation = new HoursCalculation();
        calculation.setBreakDeducted(false);

        // Apply break deduction if worked 5+ hours
        if (rawHours >= 5.0) {
            rawHours -= 1.0; // Deduct 1 hour for lunch break
            calculation.setBreakDeducted(true);
        }

        // Apply 40-minute rounding rule
        double roundedHours = applyRoundingRule(rawHours);
        calculation.setTotalHours(roundedHours);

        // Determine if there's overtime based on schedule
        LocalTime expectedEndTime = student.calculateExpectedEndTime(timeIn);
        double overtimeHours = 0.0;

        if (expectedEndTime != null && timeOut.isAfter(expectedEndTime)) {
            Duration overtimeDuration = Duration.between(expectedEndTime, timeOut);
            double overtimeMinutes = overtimeDuration.toMinutes();

            // Apply rounding to overtime
            if (overtimeMinutes >= 40) {
                overtimeHours = Math.ceil(overtimeMinutes / 60.0);
            }
        }

        // Calculate regular vs overtime hours
        double regularHours = Math.max(0, roundedHours - overtimeHours);
        calculation.setRegularHours(Math.min(regularHours, 8.0)); // Cap regular at 8 hours
        calculation.setOvertimeHours(overtimeHours);
        calculation.setUndertimeHours(Math.max(0, 8.0 - calculation.getRegularHours()));

        return calculation;
    }

    private HoursCalculation calculateOriginalHours(LocalDateTime timeIn, LocalDateTime timeOut) {
        Duration duration = Duration.between(timeIn, timeOut);
        double totalMinutes = duration.toMinutes();
        double rawHours = totalMinutes / 60.0;

        HoursCalculation calculation = new HoursCalculation();
        calculation.setBreakDeducted(false);

        if (rawHours >= 5.0) {
            rawHours -= 1.0;
            calculation.setBreakDeducted(true);
        }

        double roundedHours = applyRoundingRule(rawHours);
        calculation.setTotalHours(roundedHours);

        if (roundedHours >= 8.0) {
            calculation.setRegularHours(8.0);
            calculation.setOvertimeHours(roundedHours - 8.0);
            calculation.setUndertimeHours(0.0);
        } else {
            calculation.setRegularHours(roundedHours);
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(8.0 - roundedHours);
        }

        return calculation;
    }

    // APPLY 40-MINUTE ROUNDING RULE
    private double applyRoundingRule(double hours) {
        int wholeHours = (int) hours;
        double minutes = (hours - wholeHours) * 60;

        if (minutes >= 50) {
            return wholeHours + 1.0;
        } else {
            return wholeHours;
        }
    }

    private String buildTimeInMessage(Student student, LocalTime arrivalTime) {
        if (!student.hasActiveSchedule()) {
            return "Time in recorded successfully";
        }

        String scheduleStatus = student.getScheduleStatusText(arrivalTime);
        LocalTime expectedEnd = student.calculateExpectedEndTime(arrivalTime);

        StringBuilder message = new StringBuilder("Time in recorded successfully. ");
        message.append("Status: ").append(scheduleStatus);

        if (expectedEnd != null) {
            message.append(". Expected end time: ").append(expectedEnd);
        }

        return message.toString();
    }

    private String buildTimeOutMessage(Student student, AttendanceRecord record) {
        StringBuilder message = new StringBuilder("Time out recorded successfully");

        if (student.hasActiveSchedule()) {
            LocalTime timeOut = record.getTimeOut().toLocalTime();
            LocalTime expectedEnd = student.calculateExpectedEndTime(record.getTimeIn().toLocalTime());

            if (expectedEnd != null && timeOut.isAfter(expectedEnd)) {
                Duration overtime = Duration.between(expectedEnd, timeOut);
                long overtimeMinutes = overtime.toMinutes();
                message.append(". Overtime: ").append(overtimeMinutes).append(" minutes");
            }
        }

        return message.toString();
    }
    // Handle time-out when tasks already exist
    private AttendanceResponse processTimeOutWithExistingTasks(AttendanceRecord record, String additionalTasks) {
        LocalDateTime now = LocalDateTime.now();

        record.setTimeOut(now);
        record.setStatus(AttendanceStatus.TIMED_OUT);

        // Get consolidated tasks from TaskService
        String consolidatedTasks = taskService.getConsolidatedTasksForTimeOut(record);

        // Add any additional tasks provided during time-out
        if (additionalTasks != null && !additionalTasks.trim().isEmpty()) {
            if (consolidatedTasks != null && !consolidatedTasks.isEmpty()) {
                consolidatedTasks += "\n\n=== Additional Tasks (Added during time-out) ===\n" + additionalTasks;
            } else {
                consolidatedTasks = "=== Tasks Added During Time-out ===\n" + additionalTasks;
            }
        }

        record.setTasksCompleted(consolidatedTasks);

        // Calculate hours and update student
        HoursCalculation calculation = calculateScheduleAwareHours(record);
        updateRecordHours(record, calculation);

        Student student = record.getStudent();
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        return buildTimeOutResponse(student, record, calculation, now);
    }

    // Helper method to update record hours
    private void updateRecordHours(AttendanceRecord record, HoursCalculation calculation) {
        record.setTotalHours(calculation.getTotalHours());
        record.setRegularHours(calculation.getRegularHours());
        record.setOvertimeHours(calculation.getOvertimeHours());
        record.setUndertimeHours(calculation.getUndertimeHours());
        record.setBreakDeducted(calculation.isBreakDeducted());
    }

    // Helper method to build time-out response
    private AttendanceResponse buildTimeOutResponse(Student student, AttendanceRecord record,
                                                    HoursCalculation calculation, LocalDateTime timeOut) {
        return new AttendanceResponse(
                "TIME_OUT",
                buildTimeOutMessage(student, record),
                true,
                student.getFullName(),
                student.getIdBadge(),
                record.getTimeIn(),
                timeOut,
                roundToNearestHour(record.getTimeIn()),
                roundToNearestHour(timeOut),
                calculation.getTotalHours(),
                calculation.getRegularHours(),
                calculation.getOvertimeHours(),
                calculation.getUndertimeHours(),
                student.getTotalAccumulatedHours(),
                record.getTasksCompleted(),
                calculation.isBreakDeducted()
        );
    }

    public AttendanceSessionInfo getCurrentSessionInfo(String idBadge) {
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

        LocalDate today = LocalDate.now();
        AttendanceRecord activeRecord = attendanceRecordRepository
                .findByStudentAndAttendanceDateAndStatus(student, today, AttendanceStatus.TIMED_IN)
                .orElseThrow(() -> new RuntimeException("No active attendance session found"));

        List<TaskEntry> todayTasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(activeRecord);

        // Calculate current session hours
        Duration sessionDuration = Duration.between(activeRecord.getTimeIn(), LocalDateTime.now());
        double currentHours = sessionDuration.toMinutes() / 60.0;

        return new AttendanceSessionInfo(
                activeRecord.getId(),
                student.getFullName(),
                student.getIdBadge(),
                activeRecord.getTimeIn(),
                todayTasks.size(),
                Math.round(currentHours * 100.0) / 100.0
        );
    }

    public boolean canLogTasks(String idBadge) {
        try {
            getCurrentSessionInfo(idBadge);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }


    // SCHEDULE MANAGEMENT METHODS
    @Transactional
    public ScheduleResponse updateStudentSchedule(Long studentId, UpdateScheduleRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Validate schedule times
        if (request.getStartTime().isAfter(request.getEndTime())) {
            throw new RuntimeException("Start time must be before end time");
        }

        // Check if student is currently timed in
        LocalDate today = LocalDate.now();
        List<AttendanceRecord> todayRecords = attendanceRecordRepository
                .findByStudentAndAttendanceDate(student, today);

        boolean isCurrentlyTimedIn = todayRecords.stream()
                .anyMatch(record -> record.getStatus() == AttendanceStatus.TIMED_IN);

        if (isCurrentlyTimedIn) {
            throw new RuntimeException("Cannot update schedule while student is currently timed in");
        }

        // Update schedule
        student.setScheduledStartTime(request.getStartTime());
        student.setScheduledEndTime(request.getEndTime());
        student.setGracePeriodMinutes(request.getGracePeriodMinutes());
        student.setScheduleActive(request.getActive());

        Student updatedStudent = studentRepository.save(student);

        return new ScheduleResponse(
                updatedStudent.getId(),
                updatedStudent.getFullName(),
                updatedStudent.getIdBadge(),
                updatedStudent.getScheduledStartTime(),
                updatedStudent.getScheduledEndTime(),
                updatedStudent.getGracePeriodMinutes(),
                updatedStudent.getScheduleActive(),
                updatedStudent.getScheduledHoursPerDay()
        );
    }

    public ScheduleResponse getStudentSchedule(Long studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        return new ScheduleResponse(
                student.getId(),
                student.getFullName(),
                student.getIdBadge(),
                student.getScheduledStartTime(),
                student.getScheduledEndTime(),
                student.getGracePeriodMinutes(),
                student.getScheduleActive(),
                student.getScheduledHoursPerDay()
        );
    }

    @Transactional
    public StudentDto updateStudentBadge(Long studentId, UpdateBadgeRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Check if new badge is already used by another ACTIVE student
        if (studentRepository.countActiveStudentsByIdBadge(request.getNewIdBadge()) > 0) {
            throw new RuntimeException("ID badge " + request.getNewIdBadge() + " is already in use by an active student");
        }

        // Validate new badge format
        if (!request.getNewIdBadge().matches("\\d{4}")) {
            throw new RuntimeException("ID badge must be exactly 4 digits");
        }

        // Cannot change badge of completed student
        if (student.getStatus() == StudentStatus.COMPLETED) {
            throw new RuntimeException("Cannot change badge of completed student");
        }

        student.setIdBadge(request.getNewIdBadge());
        Student updatedStudent = studentRepository.save(student);

        return convertToStudentDto(updatedStudent);
    }

    @Transactional
    public StudentDto updateStudentStatus(Long studentId, UpdateStatusRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        StudentStatus newStatus;
        try {
            newStatus = StudentStatus.valueOf(request.getStatus().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid status: " + request.getStatus());
        }

        // Validation: Can't change from COMPLETED back to ACTIVE
        if (student.getStatus() == StudentStatus.COMPLETED && newStatus == StudentStatus.ACTIVE) {
            throw new RuntimeException("Cannot reactivate a completed student");
        }

        // Check if student is currently timed in
        LocalDate today = LocalDate.now();
        List<AttendanceRecord> todayRecords = attendanceRecordRepository
                .findByStudentAndAttendanceDate(student, today);

        boolean isCurrentlyTimedIn = todayRecords.stream()
                .anyMatch(record -> record.getStatus() == AttendanceStatus.TIMED_IN);

        if (isCurrentlyTimedIn && newStatus != StudentStatus.ACTIVE) {
            throw new RuntimeException("Cannot change status while student is currently timed in");
        }

        student.setStatus(newStatus);
        Student updatedStudent = studentRepository.save(student);

        return convertToStudentDto(updatedStudent);
    }

    @Transactional
    public StudentDto completeStudent(Long studentId, CompleteStudentRequest request) {
        if (!request.getConfirmed()) {
            throw new RuntimeException("Completion must be confirmed");
        }

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        if (student.getStatus() != StudentStatus.ACTIVE) {
            throw new RuntimeException("Only active students can be marked as completed");
        }

        // Check if student is currently timed in
        LocalDate today = LocalDate.now();
        List<AttendanceRecord> todayRecords = attendanceRecordRepository
                .findByStudentAndAttendanceDate(student, today);

        boolean isCurrentlyTimedIn = todayRecords.stream()
                .anyMatch(record -> record.getStatus() == AttendanceStatus.TIMED_IN);

        if (isCurrentlyTimedIn) {
            throw new RuntimeException("Cannot complete student while they are currently timed in");
        }

        // Update student status
        student.setStatus(StudentStatus.COMPLETED);
        student.setCompletionDate(LocalDateTime.now());
        student.setIdBadge(null); // Release the badge for reuse

        Student updatedStudent = studentRepository.save(student);

        return convertToStudentDto(updatedStudent);
    }

    @Transactional
    public StudentDto updateRequiredHours(Long studentId, UpdateRequiredHoursRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        student.setRequiredHours(request.getRequiredHours());
        Student updatedStudent = studentRepository.save(student);

        return convertToStudentDto(updatedStudent);
    }

    public List<StudentDto> getStudentsByStatus(StudentStatus status) {
        List<Student> students = studentRepository.findByStatusOrderByFullNameAsc(status);
        return students.stream()
                .map(this::convertToStudentDto)
                .collect(Collectors.toList());
    }

    public List<StudentDto> getActiveStudents() {
        return getStudentsByStatus(StudentStatus.ACTIVE);
    }

    public List<StudentDto> getCompletedStudents() {
        return getStudentsByStatus(StudentStatus.COMPLETED);
    }

    public List<StudentDto> getInactiveStudents() {
        return getStudentsByStatus(StudentStatus.INACTIVE);
    }

    public List<StudentDto> getStudentsNearCompletion() {
        List<Student> students = studentRepository.findActiveStudentsNearCompletion();
        return students.stream()
                .map(this::convertToStudentDto)
                .collect(Collectors.toList());
    }

    public List<StudentDto> getStudentsReadyForCompletion() {
        List<Student> students = studentRepository.findActiveStudentsReadyForCompletion();
        return students.stream()
                .map(this::convertToStudentDto)
                .collect(Collectors.toList());
    }

    private AttendanceResponse processTimeIn(Student student) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime roundedTimeIn = roundToNearestHour(now);

        AttendanceRecord record = new AttendanceRecord(student, now);
        record.setStatus(AttendanceStatus.TIMED_IN);

        attendanceRecordRepository.save(record);

        return new AttendanceResponse(
                "TIME_IN",
                "Time in recorded successfully",
                true,
                student.getFullName(),
                student.getIdBadge(),
                now,
                null,
                roundedTimeIn,
                null,
                0.0,
                0.0,
                0.0,
                0.0,
                student.getTotalAccumulatedHours(),
                null,
                false
        );
    }

    private AttendanceResponse processTimeOut(AttendanceRecord record, String tasksCompleted) {
        LocalDateTime now = LocalDateTime.now();

        if (tasksCompleted == null || tasksCompleted.trim().isEmpty()) {
            throw new RuntimeException("Tasks completed is required for time out");
        }

        record.setTimeOut(now);
        record.setTasksCompleted(tasksCompleted);
        record.setStatus(AttendanceStatus.TIMED_OUT);

        // Calculate hours using rounded versions of actual times
        LocalDateTime roundedTimeIn = roundToNearestHour(record.getTimeIn());
        LocalDateTime roundedTimeOut = roundToNearestHour(now);
        HoursCalculation calculation = calculateHours(roundedTimeIn, roundedTimeOut);

        record.setTotalHours(calculation.getTotalHours());
        record.setRegularHours(calculation.getRegularHours());
        record.setOvertimeHours(calculation.getOvertimeHours());
        record.setUndertimeHours(calculation.getUndertimeHours());
        record.setBreakDeducted(calculation.isBreakDeducted());

        // Update student's total accumulated hours
        Student student = record.getStudent();
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        return new AttendanceResponse(
                "TIME_OUT",
                "Time out recorded successfully",
                true,
                student.getFullName(),
                student.getIdBadge(),
                record.getTimeIn(),
                now,
                roundedTimeIn,
                roundedTimeOut,
                calculation.getTotalHours(),
                calculation.getRegularHours(),
                calculation.getOvertimeHours(),
                calculation.getUndertimeHours(),
                student.getTotalAccumulatedHours(),
                tasksCompleted,
                calculation.isBreakDeducted()
        );
    }

    public AttendanceResponse processAdminCorrection(AdminCorrectionRequest request) {
        AttendanceRecord record = attendanceRecordRepository.findById(request.getAttendanceRecordId())
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        Double originalTotalHours = record.getTotalHours() != null ? record.getTotalHours() : 0.0;

        record.setTotalHours(request.getCorrectedHours());

        if (request.getCorrectedHours() >= 8.0) {
            record.setRegularHours(8.0);
            record.setOvertimeHours(request.getCorrectedHours() - 8.0);
            record.setUndertimeHours(0.0);
        } else {
            record.setRegularHours(request.getCorrectedHours());
            record.setOvertimeHours(0.0);
            record.setUndertimeHours(8.0 - request.getCorrectedHours());
        }

        record.setStatus(AttendanceStatus.ADMIN_CORRECTED);

        if (record.getTimeOut() == null && record.getTimeIn() != null) {
            LocalDateTime calculatedTimeOut = record.getTimeIn().plusHours(request.getCorrectedHours().longValue());
            record.setTimeOut(calculatedTimeOut);
        }

        if (request.getCorrectionReason() != null && !request.getCorrectionReason().trim().isEmpty()) {
            String currentTasks = record.getTasksCompleted() != null ? record.getTasksCompleted() : "";
            record.setTasksCompleted(currentTasks + "\n[ADMIN CORRECTION: " + request.getCorrectionReason() + "]");
        }

        Student student = record.getStudent();
        Double hoursDifference = request.getCorrectedHours() - originalTotalHours;
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + hoursDifference);

        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        return new AttendanceResponse(
                "ADMIN_CORRECTION",
                "Attendance record corrected and completed successfully",
                true,
                student.getFullName(),
                student.getIdBadge(),
                record.getTimeIn(),
                record.getTimeOut(),
                roundToNearestHour(record.getTimeIn()),
                record.getTimeOut() != null ? roundToNearestHour(record.getTimeOut()) : null,
                record.getTotalHours(),
                record.getRegularHours(),
                record.getOvertimeHours(),
                record.getUndertimeHours(),
                student.getTotalAccumulatedHours(),
                record.getTasksCompleted(),
                record.getBreakDeducted()
        );
    }

    private HoursCalculation calculateHours(LocalDateTime timeIn, LocalDateTime timeOut) {
        Duration duration = Duration.between(timeIn, timeOut);
        double totalMinutes = duration.toMinutes();
        double rawHours = totalMinutes / 60.0;

        HoursCalculation calculation = new HoursCalculation();
        calculation.setBreakDeducted(false);

        // Check if break should be deducted
        if (rawHours >= 5.0) {
            rawHours -= 1.0; // Deduct 1 hour for lunch break
            calculation.setBreakDeducted(true);
        }

        calculation.setTotalHours(Math.round(rawHours * 100.0) / 100.0);

        // Calculate regular, overtime, and undertime
        if (calculation.getTotalHours() >= 8.0) {
            calculation.setRegularHours(8.0);
            calculation.setOvertimeHours(calculation.getTotalHours() - 8.0);
            calculation.setUndertimeHours(0.0);
        } else {
            calculation.setRegularHours(calculation.getTotalHours());
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(8.0 - calculation.getTotalHours());
        }

        return calculation;
    }

    private LocalDateTime roundToNearestHour(LocalDateTime dateTime) {
        int minutes = dateTime.getMinute();

        LocalDateTime rounded;
        if (minutes <= 39) {
            rounded = dateTime.withMinute(0).withSecond(0).withNano(0);
        } else {
            rounded = dateTime.withMinute(0).withSecond(0).withNano(0).plusHours(1);
        }

        return rounded;
    }

    public StudentDashboardResponse getStudentDashboard(String idBadge) {
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

        LocalDate today = LocalDate.now();

        // Get today's attendance record
        List<AttendanceRecord> todayRecords = attendanceRecordRepository
                .findByStudentAndAttendanceDate(student, today);

        AttendanceRecord todayRecord = todayRecords.isEmpty() ? null :
                todayRecords.stream().max(Comparator.comparing(AttendanceRecord::getId)).orElse(null);

        // Get all attendance records for the student
        List<AttendanceRecord> allRecords = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        // Convert to DTOs with enhanced task information
        List<AttendanceRecordDto> recordDtos = allRecords.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());

        // Determine current status and today's information
        String currentStatus = "TIMED_OUT";
        Double todayHours = 0.0;
        Integer todayTasksCount = 0;
        Boolean canLogTasks = false;
        Long activeSessionId = null;
        List<TaskEntryDto> todayTasks = new ArrayList<>();

        if (todayRecord != null) {
            currentStatus = todayRecord.getStatus().name();
            todayHours = todayRecord.getTotalHours() != null ? todayRecord.getTotalHours() : 0.0;

            // Get today's tasks
            List<TaskEntry> tasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(todayRecord);
            todayTasksCount = tasks.size();
            todayTasks = tasks.stream()
                    .map(this::convertToTaskDto)
                    .collect(Collectors.toList());

            // Check if student can log more tasks (only if currently timed in)
            if (todayRecord.getStatus() == AttendanceStatus.TIMED_IN) {
                canLogTasks = true;
                activeSessionId = todayRecord.getId();
            }
        }

        return new StudentDashboardResponse(
                student.getIdBadge(),
                student.getFullName(),
                currentStatus,
                todayHours,
                student.getTotalAccumulatedHours(),
                recordDtos,
                todayTasksCount,
                canLogTasks,
                activeSessionId,
                todayTasks
        );
    }

    // Helper method to convert TaskEntry to TaskEntryDto
    private TaskEntryDto convertToTaskDto(TaskEntry task) {
        return new TaskEntryDto(
                task.getId(),
                task.getTaskDescription(),
                task.getCompletedAt(),
                task.getAddedAt(),
                task.getAddedDuringTimeout()
        );
    }

    private AttendanceResponse processIntelligentTimeOut(AttendanceRecord record, String tasksCompleted) {
        // This should be processTimeOutWithExistingTasks
        return processTimeOutWithExistingTasks(record, tasksCompleted);
    }

    // Time-out with forgotten tasks handling
    public AttendanceResponse processTimeOutWithForgottenTasks(AttendanceRequest request, List<AddTaskRequest> forgottenTasks) {
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

        LocalDate today = LocalDate.now();
        AttendanceRecord activeRecord = attendanceRecordRepository
                .findByStudentAndAttendanceDateAndStatus(student, today, AttendanceStatus.TIMED_IN)
                .orElseThrow(() -> new RuntimeException("No active attendance session found"));

        // Add any forgotten tasks first
        if (forgottenTasks != null && !forgottenTasks.isEmpty()) {
            for (AddTaskRequest forgottenTask : forgottenTasks) {
                forgottenTask.setIdBadge(request.getIdBadge());
                forgottenTask.setAddedDuringTimeout(true);

                // Validate and add the forgotten task
                TaskEntry taskEntry = new TaskEntry(
                        activeRecord,
                        forgottenTask.getTaskDescription().trim(),
                        forgottenTask.getCompletedAt(),
                        true // Mark as added during timeout
                );

                taskEntryRepository.save(taskEntry);
            }
        }

        // Now process the normal time-out
        return processIntelligentTimeOut(activeRecord, request.getTasksCompleted());
    }

    // NEW METHOD: Get task logging statistics for admin
    public TaskLoggingStats getTaskLoggingStats(LocalDate date) {
        List<AttendanceRecord> dayRecords = attendanceRecordRepository.findByAttendanceDateOrderByTimeInAsc(date);

        int totalRecords = dayRecords.size();
        int recordsWithTasks = 0;
        int totalTasksLogged = 0;
        int realTimeTaskEntries = 0;
        int timeOutTaskEntries = 0;

        for (AttendanceRecord record : dayRecords) {
            List<TaskEntry> tasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(record);

            if (!tasks.isEmpty()) {
                recordsWithTasks++;
                totalTasksLogged += tasks.size();

                for (TaskEntry task : tasks) {
                    if (Boolean.TRUE.equals(task.getAddedDuringTimeout())) {
                        timeOutTaskEntries++;
                    } else {
                        realTimeTaskEntries++;
                    }
                }
            }
        }

        return new TaskLoggingStats(
                date,
                totalRecords,
                recordsWithTasks,
                totalTasksLogged,
                realTimeTaskEntries,
                timeOutTaskEntries
        );
    }

    // NEW METHOD: Validate task entry timing
    private void validateTaskTiming(LocalDateTime completedAt, LocalDateTime sessionStart) {
        LocalDateTime now = LocalDateTime.now();

        // Task cannot be completed before session start
        if (completedAt.isBefore(sessionStart)) {
            throw new RuntimeException("Task completion time cannot be before your time-in today");
        }

        // Task cannot be completed more than 5 minutes in the future
        if (completedAt.isAfter(now.plusMinutes(5))) {
            throw new RuntimeException("Task completion time cannot be in the future");
        }

        // Warn if task is logged much later than completion
        Duration delay = Duration.between(completedAt, now);
        if (delay.toHours() > 2) {
            // Log warning but don't throw exception
            System.out.println("Warning: Task logged " + delay.toHours() + " hours after completion");
        }
    }

    public List<AttendanceRecordDto> getAttendanceRecordsByDate(LocalDate date) {
        List<AttendanceRecord> records = attendanceRecordRepository
                .findByWorkDateOrderByTimeInAsc(date);
        return records.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<AttendanceRecordDto> getAttendanceRecordsByDateRange(LocalDate startDate, LocalDate endDate) {
        List<AttendanceRecord> records = attendanceRecordRepository
                .findByWorkDateRange(startDate, endDate);
        return records.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<StudentDto> getAllStudents() {
        List<Student> students = studentRepository.findAll();
        return students.stream()
                .map(this::convertToStudentDto)
                .collect(Collectors.toList());
    }

    public List<AttendanceRecordDto> getIncompleteRecords() {
        LocalDateTime twelveHoursAgo = LocalDateTime.now().minusHours(10);
        List<AttendanceRecord> records = attendanceRecordRepository.findRecordsNeedingAdminReview(twelveHoursAgo);

        return records.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
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

    // FIXED: Complete implementation with all calculated fields
    private StudentDto convertToStudentDto(Student student) {
        StudentDto dto = new StudentDto();
        dto.setId(student.getId());
        dto.setIdBadge(student.getIdBadge());
        dto.setFullName(student.getFullName());
        dto.setSchool(student.getSchool());
        dto.setRegistrationDate(student.getRegistrationDate());
        dto.setTotalAccumulatedHours(student.getTotalAccumulatedHours());
        dto.setStatus(student.getStatus().name());
        dto.setCompletionDate(student.getCompletionDate());
        dto.setRequiredHours(student.getRequiredHours());
        dto.setHoursRemaining(student.getHoursRemaining());
        dto.setCompletionPercentage(student.getCompletionPercentage());

        return dto;
    }

    private EnhancedStudentDto convertToEnhancedStudentDto(Student student) {
        EnhancedStudentDto dto = new EnhancedStudentDto();

        // Copy basic fields
        dto.setId(student.getId());
        dto.setIdBadge(student.getIdBadge());
        dto.setFullName(student.getFullName());
        dto.setSchool(student.getSchool());
        dto.setRegistrationDate(student.getRegistrationDate());
        dto.setTotalAccumulatedHours(student.getTotalAccumulatedHours());
        dto.setStatus(student.getStatus().name());
        dto.setCompletionDate(student.getCompletionDate());
        dto.setRequiredHours(student.getRequiredHours());
        dto.setHoursRemaining(student.getHoursRemaining());
        dto.setCompletionPercentage(student.getCompletionPercentage());

        // Add schedule fields
        dto.setScheduledStartTime(student.getScheduledStartTime());
        dto.setScheduledEndTime(student.getScheduledEndTime());
        dto.setGracePeriodMinutes(student.getGracePeriodMinutes());
        dto.setScheduleActive(student.getScheduleActive());
        dto.setScheduledHoursPerDay(student.getScheduledHoursPerDay());

        return dto;
    }

    public boolean hasCompletedAttendanceToday(String idBadge) {
        Student student = studentRepository.findByIdBadge(idBadge).orElse(null);
        if (student == null) return false;

        LocalDate today = LocalDate.now();
        List<AttendanceRecord> todayRecords = attendanceRecordRepository
                .findByStudentAndAttendanceDate(student, today);

        return todayRecords.stream().anyMatch(record ->
                record.getStatus() != AttendanceStatus.TIMED_IN
        );
    }
}