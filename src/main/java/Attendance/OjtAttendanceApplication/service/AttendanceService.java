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

    // Constants for business rules
    private static final int BREAK_DEDUCTION_THRESHOLD_HOURS = 5;
    private static final int BREAK_DEDUCTION_HOURS = 1;
    private static final int ROUNDING_THRESHOLD_MINUTES = 40;
    private static final int REGULAR_HOURS_CAP = 8;
    private static final int MINIMUM_HOURS_BETWEEN_SESSIONS = 4;

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

    // ==================== STUDENT REGISTRATION ====================

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

    // ==================== MAIN ATTENDANCE PROCESSING ====================

    @Transactional
    public AttendanceResponse processAttendance(AttendanceRequest request) {
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

        if (student.getStatus() != StudentStatus.ACTIVE) {
            throw new RuntimeException("Only active students can log attendance. Current status: " + student.getStatus());
        }

        // Check if there's an active session (already timed in)
        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            // Student is timed in - process time-out
            return processTimeOut(activeSession.get(), request.getTasksCompleted());
        }

        // No active session - validate if student can time in
        validateTimeInEligibility(student);

        // All checks passed - allow time-in
        return processTimeIn(student);
    }

    /**
     * HYBRID APPROACH: Schedule-Based with Override Option
     *
     * Rules:
     * 1. If student has active schedule:
     *    - Allow time-in if within schedule window (start - grace to end + grace)
     * 2. If no schedule OR outside schedule window:
     *    - Allow time-in if last time-out was at least 4 hours ago
     * 3. Always reject if currently timed in
     */
    private void validateTimeInEligibility(Student student) {
        LocalDateTime now = LocalDateTime.now();
        LocalTime currentTime = now.toLocalTime();

        // Check if student has active schedule
        if (student.hasActiveSchedule()) {
            // Calculate schedule window with grace period
            LocalTime scheduleStart = student.getScheduledStartTime();
            LocalTime scheduleEnd = student.getScheduledEndTime();
            int gracePeriod = student.getGracePeriodMinutes() != null ? student.getGracePeriodMinutes() : 5;

            LocalTime windowStart = scheduleStart.minusMinutes(gracePeriod);
            LocalTime windowEnd = scheduleEnd.plusMinutes(gracePeriod);

            // Check if current time is within schedule window
            if (isWithinTimeWindow(currentTime, windowStart, windowEnd)) {
                // Within schedule - allow time in
                return;
            }
        }

        // No schedule OR outside schedule window - check minimum hours between sessions
        List<AttendanceRecord> recentRecords = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        if (!recentRecords.isEmpty()) {
            // Find most recent completed session
            Optional<AttendanceRecord> lastCompleted = recentRecords.stream()
                    .filter(record -> record.getTimeOut() != null)
                    .findFirst();

            if (lastCompleted.isPresent()) {
                LocalDateTime lastTimeOut = lastCompleted.get().getTimeOut();
                Duration timeSinceLastTimeOut = Duration.between(lastTimeOut, now);

                if (timeSinceLastTimeOut.toHours() < MINIMUM_HOURS_BETWEEN_SESSIONS) {
                    long hoursRemaining = MINIMUM_HOURS_BETWEEN_SESSIONS - timeSinceLastTimeOut.toHours();
                    throw new RuntimeException(
                            String.format("You must wait at least %d hours between sessions. " +
                                            "Please wait %d more hour(s) before timing in again.",
                                    MINIMUM_HOURS_BETWEEN_SESSIONS, hoursRemaining)
                    );
                }
            }
        }

        // Passed minimum hours check - allow time in
    }

    /**
     * Check if current time is within a time window (handles midnight crossing)
     */
    private boolean isWithinTimeWindow(LocalTime current, LocalTime start, LocalTime end) {
        if (start.isBefore(end)) {
            // Normal case: 08:00 to 17:00
            return !current.isBefore(start) && !current.isAfter(end);
        } else {
            // Crosses midnight: 22:00 to 06:00
            return !current.isBefore(start) || !current.isAfter(end);
        }
    }

    // ==================== TIME IN PROCESSING ====================

    @Transactional
    private AttendanceResponse processTimeIn(Student student) {
        LocalDateTime now = LocalDateTime.now();
        LocalTime arrivalTime = now.toLocalTime();

        AttendanceRecord record = new AttendanceRecord(student, now);
        record.setStatus(AttendanceStatus.TIMED_IN);
        record.setWorkDate(calculateWorkDate(now));

        attendanceRecordRepository.save(record);

        return new AttendanceResponse(
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
    }

    private String buildTimeInMessage(Student student, LocalTime arrivalTime) {
        StringBuilder message = new StringBuilder("Time in recorded successfully");

        if (student.hasActiveSchedule()) {
            String scheduleStatus = student.getScheduleStatusText(arrivalTime);
            LocalTime expectedEnd = student.calculateExpectedEndTime(arrivalTime);

            message.append(". Status: ").append(scheduleStatus);

            if (expectedEnd != null) {
                message.append(". Expected end time: ").append(expectedEnd);
            }
        }

        return message.toString();
    }

    // ==================== TIME OUT PROCESSING ====================

    @Transactional
    private AttendanceResponse processTimeOut(AttendanceRecord record, String tasksCompleted) {
        // Check if tasks were logged during the session
        boolean hasLoggedTasks = taskService.hasTasksForRecord(record.getId());

        if (hasLoggedTasks) {
            return processTimeOutWithExistingTasks(record, tasksCompleted);
        } else {
            return processTraditionalTimeOut(record, tasksCompleted);
        }
    }

    @Transactional
    private AttendanceResponse processTraditionalTimeOut(AttendanceRecord record, String tasksCompleted) {
        if (tasksCompleted == null || tasksCompleted.trim().isEmpty()) {
            throw new RuntimeException("Tasks completed is required for time out");
        }

        LocalDateTime now = LocalDateTime.now();

        record.setTimeOut(now);
        record.setTasksCompleted(tasksCompleted);
        record.setStatus(AttendanceStatus.TIMED_OUT);

        // Calculate hours and update record
        HoursCalculation calculation = calculateScheduleAwareHours(record);
        updateRecordHours(record, calculation);

        // Update student's total accumulated hours
        Student student = record.getStudent();
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        return buildTimeOutResponse(student, record, calculation, now);
    }

    @Transactional
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

        // Calculate hours and update record
        HoursCalculation calculation = calculateScheduleAwareHours(record);
        updateRecordHours(record, calculation);

        // Update student's total accumulated hours
        Student student = record.getStudent();
        student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

        attendanceRecordRepository.save(record);
        studentRepository.save(student);

        return buildTimeOutResponse(student, record, calculation, now);
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

    // ==================== HOURS CALCULATION ====================

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
        if (rawHours >= BREAK_DEDUCTION_THRESHOLD_HOURS) {
            rawHours -= BREAK_DEDUCTION_HOURS;
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
            if (overtimeMinutes >= ROUNDING_THRESHOLD_MINUTES) {
                overtimeHours = Math.ceil(overtimeMinutes / 60.0);
            }
        }

        // Calculate regular vs overtime hours
        double regularHours = Math.max(0, roundedHours - overtimeHours);
        calculation.setRegularHours(Math.min(regularHours, REGULAR_HOURS_CAP));
        calculation.setOvertimeHours(overtimeHours);
        calculation.setUndertimeHours(Math.max(0, REGULAR_HOURS_CAP - calculation.getRegularHours()));

        return calculation;
    }

    private HoursCalculation calculateOriginalHours(LocalDateTime timeIn, LocalDateTime timeOut) {
        Duration duration = Duration.between(timeIn, timeOut);
        double totalMinutes = duration.toMinutes();
        double rawHours = totalMinutes / 60.0;

        HoursCalculation calculation = new HoursCalculation();
        calculation.setBreakDeducted(false);

        if (rawHours >= BREAK_DEDUCTION_THRESHOLD_HOURS) {
            rawHours -= BREAK_DEDUCTION_HOURS;
            calculation.setBreakDeducted(true);
        }

        double roundedHours = applyRoundingRule(rawHours);
        calculation.setTotalHours(roundedHours);

        if (roundedHours >= REGULAR_HOURS_CAP) {
            calculation.setRegularHours((double) REGULAR_HOURS_CAP);
            calculation.setOvertimeHours(roundedHours - REGULAR_HOURS_CAP);
            calculation.setUndertimeHours(0.0);
        } else {
            calculation.setRegularHours(roundedHours);
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(REGULAR_HOURS_CAP - roundedHours);
        }

        return calculation;
    }

    /**
     * Apply 40-minute rounding rule
     * - 40+ minutes rounds up to next hour
     * - Under 40 minutes rounds down
     */
    private double applyRoundingRule(double hours) {
        int wholeHours = (int) hours;
        double minutes = (hours - wholeHours) * 60;

        if (minutes >= ROUNDING_THRESHOLD_MINUTES) {
            return wholeHours + 1.0;
        } else {
            return wholeHours;
        }
    }

    private LocalDateTime roundToNearestHour(LocalDateTime dateTime) {
        int minutes = dateTime.getMinute();

        if (minutes <= 39) {
            return dateTime.withMinute(0).withSecond(0).withNano(0);
        } else {
            return dateTime.withMinute(0).withSecond(0).withNano(0).plusHours(1);
        }
    }

    private LocalDate calculateWorkDate(LocalDateTime dateTime) {
        // Night shift handling: 12:00 AM - 5:59 AM belongs to previous day
        if (dateTime.getHour() < 6) {
            return dateTime.toLocalDate().minusDays(1);
        }
        return dateTime.toLocalDate();
    }

    // ==================== HELPER METHODS ====================

    private void updateRecordHours(AttendanceRecord record, HoursCalculation calculation) {
        record.setTotalHours(calculation.getTotalHours());
        record.setRegularHours(calculation.getRegularHours());
        record.setOvertimeHours(calculation.getOvertimeHours());
        record.setUndertimeHours(calculation.getUndertimeHours());
        record.setBreakDeducted(calculation.isBreakDeducted());
    }

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

    // ==================== ADMIN CORRECTION ====================

    @Transactional
    public AttendanceResponse processAdminCorrection(AdminCorrectionRequest request) {
        AttendanceRecord record = attendanceRecordRepository.findById(request.getAttendanceRecordId())
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        Double originalTotalHours = record.getTotalHours() != null ? record.getTotalHours() : 0.0;

        record.setTotalHours(request.getCorrectedHours());

        if (request.getCorrectedHours() >= REGULAR_HOURS_CAP) {
            record.setRegularHours((double) REGULAR_HOURS_CAP);
            record.setOvertimeHours(request.getCorrectedHours() - REGULAR_HOURS_CAP);
            record.setUndertimeHours(0.0);
        } else {
            record.setRegularHours(request.getCorrectedHours());
            record.setOvertimeHours(0.0);
            record.setUndertimeHours(REGULAR_HOURS_CAP - request.getCorrectedHours());
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

        // AUTO-DELETE related notifications after correction
        notificationService.deleteNotificationsForRecord(record);

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

    // ==================== SESSION INFO ====================

    public AttendanceSessionInfo getCurrentSessionInfo(String idBadge) {
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

        AttendanceRecord activeRecord = attendanceRecordRepository
                .findActiveSessionByStudent(student)
                .orElseThrow(() -> new RuntimeException("No active attendance session found"));

        List<TaskEntry> sessionTasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(activeRecord);

        Duration sessionDuration = Duration.between(activeRecord.getTimeIn(), LocalDateTime.now());
        double currentHours = sessionDuration.toMinutes() / 60.0;

        return new AttendanceSessionInfo(
                activeRecord.getId(),
                student.getFullName(),
                student.getIdBadge(),
                activeRecord.getTimeIn(),
                sessionTasks.size(),
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

    // ==================== SCHEDULE MANAGEMENT ====================

    @Transactional
    public ScheduleResponse updateStudentSchedule(Long studentId, UpdateScheduleRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        if (request.getStartTime().isAfter(request.getEndTime())) {
            throw new RuntimeException("Start time must be before end time");
        }

        // Check if student is currently timed in
        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            throw new RuntimeException("Cannot update schedule while student is currently timed in");
        }

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

    // ==================== STUDENT MANAGEMENT ====================

    @Transactional
    public StudentDto updateStudentBadge(Long studentId, UpdateBadgeRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        if (studentRepository.countActiveStudentsByIdBadge(request.getNewIdBadge()) > 0) {
            throw new RuntimeException("ID badge " + request.getNewIdBadge() + " is already in use by an active student");
        }

        if (!request.getNewIdBadge().matches("\\d{4}")) {
            throw new RuntimeException("ID badge must be exactly 4 digits");
        }

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

        if (student.getStatus() == StudentStatus.COMPLETED && newStatus == StudentStatus.ACTIVE) {
            throw new RuntimeException("Cannot reactivate a completed student");
        }

        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent() && newStatus != StudentStatus.ACTIVE) {
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

        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            throw new RuntimeException("Cannot complete student while they are currently timed in");
        }

        student.setStatus(StudentStatus.COMPLETED);
        student.setCompletionDate(LocalDateTime.now());
        // Keep the badge for historical records instead of nullifying

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

    // ==================== STUDENT LISTING ====================

    public List<StudentDto> getActiveStudents() {
        return getStudentsByStatus(StudentStatus.ACTIVE);
    }

    public List<StudentDto> getCompletedStudents() {
        return getStudentsByStatus(StudentStatus.COMPLETED);
    }

    public List<StudentDto> getInactiveStudents() {
        return getStudentsByStatus(StudentStatus.INACTIVE);
    }

    public List<StudentDto> getAllStudents() {
        List<Student> students = studentRepository.findAll();
        return students.stream()
                .map(this::convertToStudentDto)
                .collect(Collectors.toList());
    }

    private List<StudentDto> getStudentsByStatus(StudentStatus status) {
        List<Student> students = studentRepository.findByStatusOrderByFullNameAsc(status);
        return students.stream()
                .map(this::convertToStudentDto)
                .collect(Collectors.toList());
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

    // ==================== ATTENDANCE RECORDS ====================

    public List<AttendanceRecordDto> getAttendanceRecordsByDate(LocalDate date) {
        List<AttendanceRecord> records = attendanceRecordRepository
                .findByWorkDateOrderByTimeInAsc(date);
        return records.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<AttendanceRecordDto> getAttendanceRecordsByCalendarDate(LocalDate date) {
        List<AttendanceRecord> records = attendanceRecordRepository
                .findByAttendanceDateOrderByTimeInAsc(date);
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

    public List<AttendanceRecordDto> getIncompleteRecords() {
        LocalDateTime twelveHoursAgo = LocalDateTime.now().minusHours(10);
        List<AttendanceRecord> records = attendanceRecordRepository.findRecordsNeedingAdminReview(twelveHoursAgo);

        return records.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    // ==================== STUDENT DASHBOARD ====================

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

        // Convert to DTOs
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

            // Check if student can log more tasks
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

    // ==================== TASK ANALYTICS ====================

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

    @Transactional
    public StudentDto updateOjtStartDate(Long studentId, UpdateOjtStartDateRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Validate that OJT start date is not in the future
        if (request.getOjtStartDate().isAfter(LocalDate.now())) {
            throw new RuntimeException("OJT start date cannot be in the future");
        }

        // Validate that OJT start date is not before registration date
        if (request.getOjtStartDate().isBefore(student.getRegistrationDate().toLocalDate())) {
            throw new RuntimeException("OJT start date cannot be before registration date");
        }

        student.setOjtStartDate(request.getOjtStartDate());
        Student updatedStudent = studentRepository.save(student);

        return convertToStudentDto(updatedStudent);
    }

    // ==================== CONVERSION METHODS ====================

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
        dto.setOjtStartDate(student.getOjtStartDate());

        // Add schedule fields
        dto.setScheduledStartTime(student.getScheduledStartTime());
        dto.setScheduledEndTime(student.getScheduledEndTime());
        dto.setGracePeriodMinutes(student.getGracePeriodMinutes());
        dto.setScheduleActive(student.getScheduleActive());
        dto.setScheduledHoursPerDay(student.getScheduledHoursPerDay());

        return dto;
    }

    private TaskEntryDto convertToTaskDto(TaskEntry task) {
        return new TaskEntryDto(
                task.getId(),
                task.getTaskDescription(),
                task.getCompletedAt(),
                task.getAddedAt(),
                task.getAddedDuringTimeout()
        );
    }

    @Transactional
    public StudentDto deleteStudent(Long studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Check if student is currently timed in
        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            throw new RuntimeException("Cannot delete student while they are currently timed in. " +
                    "Please time them out first.");
        }

        // Store student data before deletion for response
        StudentDto deletedStudentDto = convertToStudentDto(student);

        // Delete in correct order due to foreign key constraints
        // 1. Delete all notifications related to this student
        List<AttendanceRecord> studentRecords = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        for (AttendanceRecord record : studentRecords) {
            // Delete notifications for this record
            notificationService.deleteNotificationsForRecord(record);

            // Delete task entries for this record
            taskService.deleteTasksForRecord(record.getId());
        }

        // 2. Delete all attendance records
        attendanceRecordRepository.deleteAll(studentRecords);

        // 3. Finally delete the student
        studentRepository.delete(student);

        return deletedStudentDto;
    }

    @Transactional
    public StudentDto deactivateStudent(Long studentId, DeactivateStudentRequest request) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Check if student is currently timed in
        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            throw new RuntimeException("Cannot deactivate student while they are currently timed in. " +
                    "Please time them out first.");
        }

        // Set status to INACTIVE
        student.setStatus(StudentStatus.INACTIVE);

        // Optionally release the ID badge
        if (request.getRemoveIdBadge() != null && request.getRemoveIdBadge()) {
            String oldBadge = student.getIdBadge();
            student.setIdBadge(null); // Release badge for reuse
        }

        // Save deactivation reason in a note (you might want to add a notes field to Student entity)
        // For now, we'll just save the student
        Student updatedStudent = studentRepository.save(student);

        return convertToStudentDto(updatedStudent);
    }
}