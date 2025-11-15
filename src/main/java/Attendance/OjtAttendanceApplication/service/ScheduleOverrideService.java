package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.HoursCalculation;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideRequestDto;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideResponseDto;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideReviewDto;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class ScheduleOverrideService {

    private static final int REGULAR_HOURS_CAP = 8;

    @Autowired
    private ScheduleOverrideRepository scheduleOverrideRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AdminNotificationRepository adminNotificationRepository;

    @Autowired
    private RecalculationService recalculationService;

    /**
     * Student submits schedule override request
     */
    public ScheduleOverrideResponseDto submitRequest(ScheduleOverrideRequestDto request) {
        // Find student
        Student student = studentRepository.findByIdBadge(request.getIdBadge())
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Find attendance record
        AttendanceRecord record = attendanceRecordRepository.findById(request.getRecordId())
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        // Check if request already exists for this record
        if (scheduleOverrideRepository.findByAttendanceRecordId(request.getRecordId()).isPresent()) {
            throw new RuntimeException("A schedule override request already exists for this attendance record");
        }

        // helper methods to parse strings to LocalTime
        ScheduleOverrideEntity overrideRequest = new ScheduleOverrideEntity(
                student,
                record,
                request.getScheduledTimeAsLocalTime(),
                request.getActualTimeAsLocalTime(),
                request.getEarlyMinutes(),
                request.getReason()
        );

        ScheduleOverrideEntity savedRequest = scheduleOverrideRepository.save(overrideRequest);

        // Create admin notification
        String notificationMessage = String.format(
                "SCHEDULE OVERRIDE REQUEST #%d - %s (%s) arrived %d minutes early.\n" +
                        "Scheduled: %s, Actual: %s\n" +
                        "Reason: %s",
                savedRequest.getId(),
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
                NotificationType.SCHEDULE_OVERRIDE_REQUEST,
                notificationMessage
        );

        adminNotificationRepository.save(notification);

        return convertToDto(savedRequest);
    }

    /**
     * Admin reviews (approves or rejects) the request
     */
    @Transactional
    public ScheduleOverrideResponseDto reviewRequest(Long requestId, ScheduleOverrideReviewDto review) {
        ScheduleOverrideEntity request = scheduleOverrideRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Schedule override request not found"));

        if (!request.getStatus().equals(OverrideRequestStatus.PENDING)) {
            throw new RuntimeException("This request has already been reviewed");
        }

        // Update request status
        if ("APPROVE".equalsIgnoreCase(review.getAction())) {
            request.setStatus(OverrideRequestStatus.APPROVED);

            // Get the attendance record and student
            AttendanceRecord record = request.getAttendanceRecord();
            Student student = record.getStudent();

            // Get current tasks (might be null or empty)
            String currentTasks = record.getTasksCompleted();
            if (currentTasks == null) {
                currentTasks = "";
            }

            // ✅ EXACT MESSAGE that isScheduleOverrideApproved() looks for
            String approvalMessage = "\n\n[ADMIN APPROVED SCHEDULE OVERRIDE: Early work hours will be counted for this session]";

            // Only add if not already present (prevent duplicates)
            if (!currentTasks.contains("[ADMIN APPROVED SCHEDULE OVERRIDE")) {

                // Add the approval message
                String updatedTasks = currentTasks + approvalMessage;

                // Add admin's custom response if provided
                if (review.getAdminResponse() != null && !review.getAdminResponse().trim().isEmpty()) {
                    updatedTasks += "\nAdmin's note: " + review.getAdminResponse();
                }

                record.setTasksCompleted(updatedTasks);
                attendanceRecordRepository.save(record);

                System.out.println("✅ Approval marker added to record " + record.getId());
                System.out.println("📝 Tasks now contain: " + updatedTasks);

                // ✨ RECALCULATE HOURS AUTOMATICALLY
                if (record.getTimeOut() != null) {
                    try {
                        System.out.println("🔄 Triggering recalculation for record " + record.getId());

                        // Store old values for logging
                        Double oldTotalHours = record.getTotalHours();
                        Double oldStudentTotal = student.getTotalAccumulatedHours();

                        // Use your existing RecalculationService
                        Map<String, Object> recalcResult = recalculationService.recalculateAttendanceRecord(record.getId());

                        // Refresh student data to get updated totals
                        student = studentRepository.findById(student.getId())
                                .orElseThrow(() -> new RuntimeException("Student not found"));

                        System.out.println("✅ Recalculation completed:");
                        System.out.println("   Record hours: " + oldTotalHours + " → " + record.getTotalHours());
                        System.out.println("   Student total: " + oldStudentTotal + " → " + student.getTotalAccumulatedHours());
                        System.out.println("   Hours difference: " + (record.getTotalHours() - oldTotalHours));

                    } catch (Exception e) {
                        System.err.println("❌ Error recalculating hours: " + e.getMessage());
                        // Don't throw - approval was successful, just log the error
                        e.printStackTrace();
                    }
                } else {
                    System.out.println("⚠️ Record has no time-out yet, skipping recalculation");
                }
            } else {
                System.out.println("ℹ️ Approval marker already exists in record " + record.getId());
            }

        } else if ("REJECT".equalsIgnoreCase(review.getAction())) {
            request.setStatus(OverrideRequestStatus.REJECTED);

            // Optional: Add rejection note to attendance record
            AttendanceRecord record = request.getAttendanceRecord();
            String currentTasks = record.getTasksCompleted();
            if (currentTasks == null) {
                currentTasks = "";
            }

            String rejectionNote = "\n\n[ADMIN REJECTED SCHEDULE OVERRIDE REQUEST]";
            if (review.getAdminResponse() != null && !review.getAdminResponse().trim().isEmpty()) {
                rejectionNote += "\nReason: " + review.getAdminResponse();
            }

            record.setTasksCompleted(currentTasks + rejectionNote);
            attendanceRecordRepository.save(record);

            System.out.println("❌ Schedule override rejected for record " + record.getId());

        } else {
            throw new RuntimeException("Invalid action. Must be APPROVE or REJECT");
        }

        // Update request metadata
        request.setReviewedAt(LocalDateTime.now());
        request.setReviewedBy(review.getAdminUsername());
        request.setAdminResponse(review.getAdminResponse());

        ScheduleOverrideEntity updatedRequest = scheduleOverrideRepository.save(request);

        // Mark related admin notification as read
        adminNotificationRepository.findByAttendanceRecord(request.getAttendanceRecord())
                .stream()
                .filter(n -> n.getNotificationType() == NotificationType.SCHEDULE_OVERRIDE_REQUEST)
                .forEach(n -> {
                    n.setIsRead(true);
                    adminNotificationRepository.save(n);
                });

        return convertToDto(updatedRequest);
    }

    private HoursCalculation calculateScheduleAwareHoursWithOverride(AttendanceRecord record, Student student) {
        LocalDateTime timeIn = record.getTimeIn();
        LocalDateTime timeOut = record.getTimeOut();

        // Now that approval marker is added, this will return true
        boolean scheduleOverrideApproved = isScheduleOverrideApproved(record);

        if (scheduleOverrideApproved) {
            return calculateOriginalHours(timeIn, timeOut);
        }

        // Fallback (shouldn't reach here after approval)
        return calculateStrictScheduleHours(student, timeIn, timeOut);
    }

    private boolean isScheduleOverrideApproved(AttendanceRecord record) {
        if (record.getTasksCompleted() == null) {
            return false;
        }
        String tasks = record.getTasksCompleted();
        return tasks.contains("[ADMIN APPROVED SCHEDULE OVERRIDE]") ||
                tasks.contains("[ADMIN APPROVED: Early work hours counted") ||
                tasks.contains("Early work hours will be counted for this session");
    }

    private HoursCalculation calculateOriginalHours(LocalDateTime timeIn, LocalDateTime timeOut) {
        Duration duration = Duration.between(timeIn, timeOut);
        long totalMinutes = duration.toMinutes();

        HoursCalculation calculation = new HoursCalculation();
        calculation.setBreakDeducted(false);

        if (totalMinutes >= 300) { // 5 hours
            totalMinutes -= 60;
            calculation.setBreakDeducted(true);
        }

        double totalHours = convertMinutesToHoursWithRounding(totalMinutes);
        calculation.setTotalHours(totalHours);

        if (totalHours >= 8.0) {
            calculation.setRegularHours(8.0);
            calculation.setOvertimeHours(totalHours - 8.0);
            calculation.setUndertimeHours(0.0);
        } else {
            calculation.setRegularHours(totalHours);
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(8.0 - totalHours);
        }

        return calculation;
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

    private double convertMinutesToHoursWithRounding(long totalMinutes) {
        long wholeHours = totalMinutes / 60;
        long remainingMinutes = totalMinutes % 60;

        if (remainingMinutes >= 55) {
            wholeHours += 1;
        }

        return (double) wholeHours;
    }

    /**
     * Get all pending requests (for admin)
     */
    public List<ScheduleOverrideResponseDto> getAllPendingRequests() {
        return scheduleOverrideRepository.findAllPendingRequests()
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get student's requests by ID badge
     */
    public List<ScheduleOverrideResponseDto> getStudentRequests(String idBadge) {
        return scheduleOverrideRepository.findByStudentIdBadge(idBadge)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get student's pending requests
     */
    public List<ScheduleOverrideResponseDto> getStudentPendingRequests(String idBadge) {
        return scheduleOverrideRepository.findPendingByStudentIdBadge(idBadge)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * Get count of pending requests
     */
    public Long getPendingRequestsCount() {
        return scheduleOverrideRepository.countPendingRequests();
    }

    /**
     * Get specific request by ID
     */
    public ScheduleOverrideResponseDto getRequestById(Long requestId) {
        ScheduleOverrideEntity request = scheduleOverrideRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Schedule override request not found"));
        return convertToDto(request);
    }

    /**
     * Convert entity to DTO
     */
    private ScheduleOverrideResponseDto convertToDto(ScheduleOverrideEntity entity) {
        ScheduleOverrideResponseDto dto = new ScheduleOverrideResponseDto();
        dto.setId(entity.getId());
        dto.setStudentName(entity.getStudent().getFullName());
        dto.setIdBadge(entity.getStudent().getIdBadge());
        dto.setAttendanceRecordId(entity.getAttendanceRecord().getId());
        dto.setScheduledTime(entity.getScheduledTime());
        dto.setActualTime(entity.getActualTime());
        dto.setEarlyMinutes(entity.getEarlyMinutes());
        dto.setReason(entity.getReason());
        dto.setStatus(entity.getStatus().name());
        dto.setRequestedAt(entity.getRequestedAt());
        dto.setReviewedAt(entity.getReviewedAt());
        dto.setReviewedBy(entity.getReviewedBy());
        dto.setAdminResponse(entity.getAdminResponse());
        return dto;
    }

    @Transactional
    public void deleteOverrideRequestsByRecord(Long attendanceRecordId) {
        try {
            Optional<ScheduleOverrideEntity> request = scheduleOverrideRepository
                    .findByAttendanceRecordId(attendanceRecordId);

            if (request.isPresent()) {
                scheduleOverrideRepository.delete(request.get());
                System.out.println("Deleted schedule override request for record: " + attendanceRecordId);
            }
        } catch (Exception e) {
            System.err.println("Error deleting schedule override requests for record " +
                    attendanceRecordId + ": " + e.getMessage());
            // Don't throw exception - allow deletion to continue
        }
    }

    @Transactional
    public void deleteOverrideRequestsByStudent(Student student) {
        try {
            List<ScheduleOverrideEntity> requests = scheduleOverrideRepository
                    .findByStudentOrderByRequestedAtDesc(student);

            if (!requests.isEmpty()) {
                scheduleOverrideRepository.deleteAll(requests);
                System.out.println("Deleted " + requests.size() +
                        " schedule override requests for student: " + student.getFullName());
            }
        } catch (Exception e) {
            System.err.println("Error deleting schedule override requests for student " +
                    student.getFullName() + ": " + e.getMessage());
            // Don't throw exception - allow deletion to continue
        }
    }
}