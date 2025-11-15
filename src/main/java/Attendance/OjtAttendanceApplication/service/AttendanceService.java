package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.*;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.AttendanceRecordRepository;
import Attendance.OjtAttendanceApplication.service.ScheduleOverrideService;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import Attendance.OjtAttendanceApplication.repository.TaskEntryRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class AttendanceService {

    // Constants for business rules
    private static final int BREAK_DEDUCTION_THRESHOLD_HOURS = 5;
    private static final int BREAK_DEDUCTION_HOURS = 1;
    private static final int ROUNDING_THRESHOLD_MINUTES = 55;
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

    @Autowired
    private ScheduleOverrideService scheduleOverrideService;

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
            LocalTime scheduleStart = student.getScheduledStartTime();
            LocalTime scheduleEnd = student.getScheduledEndTime();
            int gracePeriod = student.getGracePeriodMinutes() != null ? student.getGracePeriodMinutes() : 5;

            // Allow time-in from (start - grace) to (start + grace)
            // Example: Schedule 10:00, Grace 5 min → Allow 9:55 to 10:05
            LocalTime earliestAllowed = scheduleStart.minusMinutes(gracePeriod);
            LocalTime latestAllowed = scheduleStart.plusMinutes(gracePeriod);

            // Check if within allowed time-in window
            if (isWithinTimeWindow(currentTime, earliestAllowed, latestAllowed)) {
                // Within schedule - allow time in
                return;
            }

            // If outside schedule window, check if far enough after schedule end
            // to allow a second session (e.g., came back for overtime)
            if (currentTime.isAfter(scheduleEnd.plusHours(MINIMUM_HOURS_BETWEEN_SESSIONS))) {
                return; // Allow second session
            }
        }

        // No schedule OR outside schedule window - check minimum hours between sessions
        List<AttendanceRecord> recentRecords = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        if (!recentRecords.isEmpty()) {
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
            LocalTime scheduleStart = student.getScheduledStartTime();
            LocalTime scheduleEnd = student.getScheduledEndTime();
            int gracePeriod = student.getGracePeriodMinutes();

            // Determine arrival status
            boolean isEarly = arrivalTime.isBefore(scheduleStart);
            boolean isLate = arrivalTime.isAfter(scheduleStart.plusMinutes(gracePeriod));

            LocalTime expectedEnd;

            if (isEarly) {
                expectedEnd = scheduleEnd;
                message.append("\nStatus: Early arrival");
                message.append("\nYou must still work until your scheduled end time");
                message.append("\nExpected time-out: ").append(formatTimeOnly(scheduleEnd));
            } else if (isLate) {
                long lateMinutes = Duration.between(
                        scheduleStart.plusMinutes(gracePeriod),
                        arrivalTime
                ).toMinutes();
                expectedEnd = scheduleEnd.plusMinutes(lateMinutes);
                message.append("\nStatus: Late (").append(lateMinutes).append(" minutes)");
                message.append("\nYour end time has been extended");
                message.append("\nExpected time-out: ").append(formatTimeOnly(expectedEnd));
            } else {
                expectedEnd = scheduleEnd;
                message.append("\nStatus: On time");
                message.append("\nExpected time-out: ").append(formatTimeOnly(scheduleEnd));
            }
        }

        return message.toString();
    }

    private String formatTimeOnly(LocalTime time) {
        return time.format(DateTimeFormatter.ofPattern("h:mm a"));
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

        // ✅ PRESERVE APPROVAL MESSAGE
        String existingTasks = record.getTasksCompleted();
        String approvalMessage = null;

        if (existingTasks != null && existingTasks.contains("[ADMIN APPROVED SCHEDULE OVERRIDE")) {
            int approvalIndex = existingTasks.indexOf("[ADMIN APPROVED SCHEDULE OVERRIDE");
            approvalMessage = existingTasks.substring(approvalIndex);
            System.out.println("✅ Found approval message in traditional timeout, will preserve it");
        }

        // Set new tasks
        String finalTasks = tasksCompleted;

        // ✅ APPEND APPROVAL MESSAGE BACK
        if (approvalMessage != null) {
            finalTasks = tasksCompleted + "\n\n" + approvalMessage;
            System.out.println("✅ Approval message preserved during traditional time-out");
        }

        record.setTasksCompleted(finalTasks);
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

        // ✅ PRESERVE APPROVAL MESSAGE - Check if it exists BEFORE overwriting
        String existingTasks = record.getTasksCompleted();
        String approvalMessage = null;

        if (existingTasks != null) {
            // Extract approval message if it exists
            if (existingTasks.contains("[ADMIN APPROVED SCHEDULE OVERRIDE")) {
                int approvalIndex = existingTasks.indexOf("[ADMIN APPROVED SCHEDULE OVERRIDE");
                approvalMessage = existingTasks.substring(approvalIndex);
                System.out.println("✅ Found approval message, will preserve it: " + approvalMessage);
            }
        }

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

        // ✅ APPEND APPROVAL MESSAGE BACK if it existed
        if (approvalMessage != null) {
            consolidatedTasks = (consolidatedTasks != null ? consolidatedTasks : "") + "\n\n" + approvalMessage;
            System.out.println("✅ Approval message preserved during time-out");
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
            LocalTime timeIn = record.getTimeIn().toLocalTime();
            LocalTime timeOut = record.getTimeOut().toLocalTime();
            LocalTime scheduledStart = student.getScheduledStartTime();
            LocalTime scheduledEnd = student.getScheduledEndTime();
            int gracePeriod = student.getGracePeriodMinutes();

            boolean wasLate = timeIn.isAfter(scheduledStart.plusMinutes(gracePeriod));

            // Calculate required end time
            LocalTime requiredEndTime;
            if (wasLate) {
                long lateMinutes = Duration.between(
                        scheduledStart.plusMinutes(gracePeriod),
                        timeIn
                ).toMinutes();
                requiredEndTime = scheduledEnd.plusMinutes(lateMinutes);
            } else {
                requiredEndTime = scheduledEnd;
            }

            // Check if left early, on time, or overtime
            if (timeOut.isBefore(requiredEndTime)) {
                // LEFT EARLY
                Duration shortfall = Duration.between(timeOut, requiredEndTime);
                long shortfallMinutes = shortfall.toMinutes();
                message.append("\nUNDERTIME: You left ").append(shortfallMinutes).append(" minutes early");
                message.append("\nShould have stayed until: ").append(formatTimeOnly(requiredEndTime));
            } else if (timeOut.isAfter(requiredEndTime)) {
                // OVERTIME
                Duration overtime = Duration.between(requiredEndTime, timeOut);
                long overtimeMinutes = overtime.toMinutes();
                message.append("\nOVERTIME: Worked ").append(overtimeMinutes).append(" minutes extra");
                message.append("\nGood job staying late!");
            } else {
                // EXACTLY ON TIME
                message.append("\nPerfect! You completed your scheduled hours");
            }
        }

        return message.toString();
    }

    // ==================== HOURS CALCULATION ====================

    private HoursCalculation calculateScheduleAwareHours(AttendanceRecord record) {
        Student student = record.getStudent();
        LocalDateTime timeIn = record.getTimeIn();
        LocalDateTime timeOut = record.getTimeOut();

        // Check if schedule override was APPROVED (not just requested)
        boolean scheduleOverrideApproved = isScheduleOverrideApproved(record);

        // If schedule override approved, count ALL actual hours worked
        if (scheduleOverrideApproved) {
            return calculateOriginalHours(timeIn, timeOut);
        }

        // If no active schedule, use original calculation
        if (!student.hasActiveSchedule()) {
            return calculateOriginalHours(timeIn, timeOut);
        }

        // === STRICT SCHEDULE ENFORCEMENT ===
        // Early arrivals are NOT counted unless approved
        return calculateStrictScheduleHours(student, timeIn, timeOut);
    }

    private boolean isScheduleOverrideApproved(AttendanceRecord record) {
        if (record.getTasksCompleted() == null) {
            return false;
        }

        String tasks = record.getTasksCompleted();

        // Check for explicit approval markers (exact phrases admin adds)
        return tasks.contains("[ADMIN APPROVED SCHEDULE OVERRIDE]") ||
                tasks.contains("[ADMIN APPROVED: Early work hours counted") ||
                tasks.contains("Early work hours will be counted for this session");
    }

    private HoursCalculation calculateStrictScheduleHours(Student student, LocalDateTime timeIn, LocalDateTime timeOut) {
        LocalTime actualTimeIn = timeIn.toLocalTime();
        LocalTime actualTimeOut = timeOut.toLocalTime();
        LocalTime scheduledStart = student.getScheduledStartTime();
        LocalTime scheduledEnd = student.getScheduledEndTime();
        int gracePeriod = student.getGracePeriodMinutes() != null ? student.getGracePeriodMinutes() : 5;

        // === STEP 1: Determine EFFECTIVE start time ===
        LocalTime effectiveStartTime;
        boolean wasEarly = false;
        boolean wasLate = false;

        if (actualTimeIn.isBefore(scheduledStart)) {
            // EARLY ARRIVAL: Use scheduled start, NOT actual arrival
            effectiveStartTime = scheduledStart;
            wasEarly = true;
            System.out.println("🔵 Early arrival: Actual=" + actualTimeIn + ", Using scheduled=" + scheduledStart);
        } else if (actualTimeIn.isAfter(scheduledStart.plusMinutes(gracePeriod))) {
            // LATE ARRIVAL: Use actual arrival
            effectiveStartTime = actualTimeIn;
            wasLate = true;
            System.out.println("🔴 Late arrival: Using actual=" + actualTimeIn);
        } else {
            // ON TIME: Use scheduled start
            effectiveStartTime = scheduledStart;
            System.out.println("🟢 On-time arrival: Using scheduled=" + scheduledStart);
        }

        // === STEP 2: Calculate required end time ===
        LocalTime requiredEndTime;
        if (wasLate) {
            // If late, must work extra to make up scheduled hours
            long lateMinutes = Duration.between(
                    scheduledStart.plusMinutes(gracePeriod),
                    actualTimeIn
            ).toMinutes();
            requiredEndTime = scheduledEnd.plusMinutes(lateMinutes);
            System.out.println("⏰ Late by " + lateMinutes + " min, required end: " + requiredEndTime);
        } else {
            // On-time or early: required end is scheduled end
            requiredEndTime = scheduledEnd;
            System.out.println("⏰ Required end: " + requiredEndTime);
        }

        // === STEP 3: Build effective start DateTime ===
        LocalDateTime effectiveStartDateTime = LocalDateTime.of(timeIn.toLocalDate(), effectiveStartTime);

        // FIX: Check if this is truly a night shift by comparing actual DateTimes, not just times
        // A night shift means time-out is on a DIFFERENT date than time-in
        boolean isNightShift = !timeIn.toLocalDate().equals(timeOut.toLocalDate());

        if (isNightShift) {
            // True night shift: time-out is on next day
            System.out.println("🌙 Night shift detected (time-out on next day)");

            // If effective start time is "after" time-out time (e.g., 22:00 start, 06:00 end next day)
            // the effective start is on the SAME day as time-in, not previous
            if (effectiveStartTime.isAfter(actualTimeOut)) {
                // This is expected for night shifts - no adjustment needed
                System.out.println("✓ Night shift: Start=" + effectiveStartTime + " on " + timeIn.toLocalDate() +
                        ", End=" + actualTimeOut + " on " + timeOut.toLocalDate());
            }
        } else {
            // Same-day session: Both time-in and time-out are on the same date
            System.out.println("☀️ Same-day session detected");
        }

        // === STEP 4: Calculate actual work duration from EFFECTIVE start ===
        Duration workDuration = Duration.between(effectiveStartDateTime, timeOut);
        long workMinutes = Math.max(0, workDuration.toMinutes());

        System.out.println("📊 Work duration: " + workMinutes + " minutes (" + (workMinutes / 60.0) + " hours)");

        // === STEP 5: Determine scenario and calculate ===
        HoursCalculation calculation = new HoursCalculation();

        // Build required end DateTime for comparison
        LocalDateTime requiredEndDateTime;
        if (isNightShift && requiredEndTime.isBefore(effectiveStartTime)) {
            // Night shift: required end is next day
            requiredEndDateTime = LocalDateTime.of(timeOut.toLocalDate(), requiredEndTime);
        } else if (!isNightShift && requiredEndTime.isBefore(effectiveStartTime)) {
            // Same day but schedule crosses midnight (e.g., 22:00-02:00 but they worked same day)
            requiredEndDateTime = LocalDateTime.of(timeIn.toLocalDate().plusDays(1), requiredEndTime);
        } else {
            // Normal case: required end is on the date where we're measuring
            requiredEndDateTime = LocalDateTime.of(
                    isNightShift ? timeOut.toLocalDate() : timeIn.toLocalDate(),
                    requiredEndTime
            );
        }

        if (timeOut.isBefore(requiredEndDateTime)) {
            // ========================================
            // SCENARIO A: UNDERTIME (Left early)
            // ========================================
            System.out.println("⚠️ UNDERTIME: Left at " + timeOut + " (required: " + requiredEndDateTime + ")");

            Duration undertimeDuration = Duration.between(timeOut, requiredEndDateTime);
            long undertimeMinutes = undertimeDuration.toMinutes();

            // Deduct break if worked >= 5 hours
            if (workMinutes >= 300) {
                workMinutes -= 60;
                calculation.setBreakDeducted(true);
            } else {
                calculation.setBreakDeducted(false);
            }

            workMinutes = Math.max(0, workMinutes);

            double totalHours = convertMinutesToHoursWithRounding(workMinutes);
            double undertimeHours = convertMinutesToHoursWithRounding(undertimeMinutes);

            calculation.setTotalHours(totalHours);
            calculation.setRegularHours(totalHours);
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(undertimeHours);

        } else if (timeOut.isAfter(requiredEndDateTime)) {
            // ========================================
            // SCENARIO B: OVERTIME (Stayed late)
            // ========================================
            System.out.println("✅ OVERTIME: Left at " + timeOut + " (required: " + requiredEndDateTime + ")");

            // Calculate scheduled hours (from effective start to required end)
            Duration scheduledDuration = Duration.between(effectiveStartDateTime, requiredEndDateTime);
            long scheduledMinutes = scheduledDuration.toMinutes();

            // Deduct break from scheduled hours if >= 5 hours
            if (scheduledMinutes >= 300) {
                scheduledMinutes -= 60;
                calculation.setBreakDeducted(true);
            } else {
                calculation.setBreakDeducted(false);
            }

            scheduledMinutes = Math.max(0, scheduledMinutes);
            double regularHours = Math.min(Math.floor(scheduledMinutes / 60.0), REGULAR_HOURS_CAP);

            // Calculate overtime (from required end to actual end)
            Duration overtimeDuration = Duration.between(requiredEndDateTime, timeOut);
            long overtimeMinutes = Math.max(0, overtimeDuration.toMinutes());
            double overtimeHours = convertMinutesToHoursWithRounding(overtimeMinutes);

            calculation.setTotalHours(regularHours + overtimeHours);
            calculation.setRegularHours(regularHours);
            calculation.setOvertimeHours(overtimeHours);
            calculation.setUndertimeHours(0.0);

        } else {
            // ========================================
            // SCENARIO C: EXACTLY ON TIME
            // ========================================
            System.out.println("✅ EXACTLY ON TIME");

            // Deduct break if worked >= 5 hours
            if (workMinutes >= 300) {
                workMinutes -= 60;
                calculation.setBreakDeducted(true);
            } else {
                calculation.setBreakDeducted(false);
            }

            workMinutes = Math.max(0, workMinutes);
            double regularHours = Math.min(Math.floor(workMinutes / 60.0), REGULAR_HOURS_CAP);

            calculation.setTotalHours(regularHours);
            calculation.setRegularHours(regularHours);
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(0.0);
        }

        System.out.println("📈 Final: Total=" + calculation.getTotalHours() +
                ", Regular=" + calculation.getRegularHours() +
                ", OT=" + calculation.getOvertimeHours() +
                ", UT=" + calculation.getUndertimeHours());

        return calculation;
    }

    private HoursCalculation calculateOriginalHours(LocalDateTime timeIn, LocalDateTime timeOut) {
        Duration duration = Duration.between(timeIn, timeOut);
        long totalMinutes = duration.toMinutes();

        HoursCalculation calculation = new HoursCalculation();
        calculation.setBreakDeducted(false);

        if (totalMinutes >= 300) {
            totalMinutes -= 60;
            calculation.setBreakDeducted(true);
        }

        double totalHours = convertMinutesToHoursWithRounding(totalMinutes);
        calculation.setTotalHours(totalHours);

        if (totalHours >= REGULAR_HOURS_CAP) {
            calculation.setRegularHours((double) REGULAR_HOURS_CAP);
            calculation.setOvertimeHours(totalHours - REGULAR_HOURS_CAP);
            calculation.setUndertimeHours(0.0);
        } else {
            calculation.setRegularHours(totalHours);
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(REGULAR_HOURS_CAP - totalHours);
        }

        return calculation;
    }

    private double convertMinutesToHoursWithRounding(long totalMinutes) {
        long wholeHours = totalMinutes / 60;
        long remainingMinutes = totalMinutes % 60;

        if (remainingMinutes >= ROUNDING_THRESHOLD_MINUTES) {
            wholeHours += 1;
        }

        return (double) wholeHours;
    }

    /**
     * Apply 55-minute rounding rule
     * - 55+ minutes rounds up to next hour
     * - Under 55 minutes rounds down

    private double applyRoundingRule(double hours) {
        int wholeHours = (int) hours;
        double minutes = (hours - wholeHours) * 60;

        if (minutes >= 55) {
            return wholeHours + 1.0;
        } else {
            return wholeHours;
        }
    }*/

    private LocalDateTime roundToNearestHour(LocalDateTime dateTime) {
        int minutes = dateTime.getMinute();

        if (minutes <= 54) {
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

    /**
     * Admin manual attendance entry
     * Allows admins to manually create attendance records with custom date/time
     */
    @Transactional
    public AttendanceResponse processManualAttendance(ManualAttendanceRequest request) {
        // Find student
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + request.getIdBadge()));

        if (student.getStatus() != StudentStatus.ACTIVE) {
            throw new RuntimeException("Only active students can have manual attendance entries. Current status: " + student.getStatus());
        }

        // Validate date is not in the future
        if (request.getTimeIn().isAfter(LocalDateTime.now())) {
            throw new RuntimeException("Time-in cannot be in the future");
        }

        // Check if student already has a record for this date (work date)
        LocalDate workDate = calculateWorkDate(request.getTimeIn());
        List<AttendanceRecord> existingRecords = attendanceRecordRepository
                .findByStudentAndWorkDate(student, workDate);

        if (!existingRecords.isEmpty()) {
            throw new RuntimeException("Student already has an attendance record for this date (work date: " + workDate + ")");
        }

        // Create attendance record
        AttendanceRecord record = new AttendanceRecord(student, request.getTimeIn());
        record.setWorkDate(workDate);

        // If time-out is provided, process as complete record
        if (request.getTimeOut() != null) {
            if (request.getTimeOut().isBefore(request.getTimeIn())) {
                throw new RuntimeException("Time-out must be after time-in");
            }

            if (request.getTimeOut().isAfter(LocalDateTime.now())) {
                throw new RuntimeException("Time-out cannot be in the future");
            }

            record.setTimeOut(request.getTimeOut());
            record.setStatus(AttendanceStatus.ADMIN_CORRECTED);

            // Calculate hours
            HoursCalculation calculation = calculateScheduleAwareHours(record);
            updateRecordHours(record, calculation);

            // Set tasks with admin note
            String tasksWithNote = (request.getTasksCompleted() != null ? request.getTasksCompleted() : "No tasks recorded") +
                    "\n\n[ADMIN MANUAL ENTRY: " + request.getAdminReason() + "]";
            record.setTasksCompleted(tasksWithNote);

            // Update student's total hours
            student.setTotalAccumulatedHours(student.getTotalAccumulatedHours() + calculation.getTotalHours());

            attendanceRecordRepository.save(record);
            studentRepository.save(student);

            return new AttendanceResponse(
                    "MANUAL_ENTRY_COMPLETE",
                    "Manual attendance record created successfully (Time-In and Time-Out)",
                    true,
                    student.getFullName(),
                    student.getIdBadge(),
                    request.getTimeIn(),
                    request.getTimeOut(),
                    roundToNearestHour(request.getTimeIn()),
                    roundToNearestHour(request.getTimeOut()),
                    calculation.getTotalHours(),
                    calculation.getRegularHours(),
                    calculation.getOvertimeHours(),
                    calculation.getUndertimeHours(),
                    student.getTotalAccumulatedHours(),
                    record.getTasksCompleted(),
                    calculation.isBreakDeducted()
            );
        } else {
            // Time-in only
            record.setStatus(AttendanceStatus.TIMED_IN);
            record.setTasksCompleted("[ADMIN MANUAL ENTRY: " + request.getAdminReason() + "]");

            attendanceRecordRepository.save(record);

            return new AttendanceResponse(
                    "MANUAL_ENTRY_TIME_IN",
                    "Manual time-in created successfully. Student is now marked as timed-in.",
                    true,
                    student.getFullName(),
                    student.getIdBadge(),
                    request.getTimeIn(),
                    null,
                    roundToNearestHour(request.getTimeIn()),
                    null,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    student.getTotalAccumulatedHours(),
                    record.getTasksCompleted(),
                    false
            );
        }
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

        // Allow completion from ACTIVE or if already at 100% progress
        if (student.getStatus() == StudentStatus.COMPLETED) {
            throw new RuntimeException("Student is already marked as completed");
        }

        if (student.getStatus() == StudentStatus.INACTIVE) {
            throw new RuntimeException("Cannot complete an inactive student. Please reactivate them first.");
        }

        // Check if student is currently timed in
        Optional<AttendanceRecord> activeSession = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        if (activeSession.isPresent()) {
            throw new RuntimeException("Cannot complete student while they are currently timed in. Please time them out first.");
        }

        // Optional: Verify they've reached required hours (if you want to enforce this)
        if (student.getRequiredHours() != null &&
             student.getTotalAccumulatedHours() < student.getRequiredHours()) {
             throw new RuntimeException("Student has not yet reached required hours. " +
                 "Current: " + student.getTotalAccumulatedHours() + " / Required: " + student.getRequiredHours());
        }

        student.setStatus(StudentStatus.COMPLETED);
        student.setCompletionDate(LocalDateTime.now());
        // Keep the badge for historical records

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

        // Get active session first (if any)
        Optional<AttendanceRecord> activeSessionOpt = attendanceRecordRepository
                .findActiveSessionByStudent(student);

        AttendanceRecord todayRecord = null;
        List<TaskEntry> todayTasks = new ArrayList<>();

        if (activeSessionOpt.isPresent()) {
            // Use the active session as "today's" record
            todayRecord = activeSessionOpt.get();

            // Get tasks for this active session
            todayTasks = taskEntryRepository
                    .findByAttendanceRecordOrderByCompletedAtAsc(todayRecord);
        } else {
            // No active session, get today's completed records
            LocalDate today = LocalDate.now();
            List<AttendanceRecord> todayRecords = attendanceRecordRepository
                    .findByStudentAndAttendanceDate(student, today);

            todayRecord = todayRecords.isEmpty() ? null :
                    todayRecords.stream().max(Comparator.comparing(AttendanceRecord::getId)).orElse(null);

            if (todayRecord != null) {
                todayTasks = taskEntryRepository
                        .findByAttendanceRecordOrderByCompletedAtAsc(todayRecord);
            }
        }

        // Get all attendance records for the student
        List<AttendanceRecord> allRecords = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        // Convert to DTOs
        List<AttendanceRecordDto> recordDtos = allRecords.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());

        // Convert tasks to DTOs
        List<TaskEntryDto> taskDtos = todayTasks.stream()
                .map(this::convertToTaskDto)
                .collect(Collectors.toList());

        // Determine current status
        String currentStatus = activeSessionOpt.isPresent() ? "TIMED_IN" : "TIMED_OUT";
        Double todayHours = todayRecord != null ? (todayRecord.getTotalHours() != null ? todayRecord.getTotalHours() : 0.0) : 0.0;
        Integer todayTasksCount = todayTasks.size();
        Boolean canLogTasks = activeSessionOpt.isPresent();
        Long activeSessionId = activeSessionOpt.map(AttendanceRecord::getId).orElse(null);

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
                taskDtos
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

        // Get all attendance records for this student
        List<AttendanceRecord> studentRecords = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        // Delete in correct order to respect foreign key constraints
        for (AttendanceRecord record : studentRecords) {
            try {
                // 1. Delete schedule override requests for this record (NEW!)
                scheduleOverrideService.deleteOverrideRequestsByRecord(record.getId());

                // 2. Delete notifications for this record
                notificationService.deleteNotificationsForRecord(record);

                // 3. Delete task entries for this record
                taskService.deleteTasksForRecord(record.getId());

            } catch (Exception e) {
                System.err.println("Error deleting related data for record " + record.getId() + ": " + e.getMessage());
                // Continue with other records
            }
        }

        // 4. Delete all attendance records
        attendanceRecordRepository.deleteAll(studentRecords);

        // 5. Finally delete the student
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