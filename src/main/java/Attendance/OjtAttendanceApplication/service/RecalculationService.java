package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.HoursCalculation;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

@Service
public class RecalculationService {

    private static final Logger logger = LoggerFactory.getLogger(RecalculationService.class);

    // Business rule constants
    private static final int BREAK_DEDUCTION_THRESHOLD_MINUTES = 300; // 5 hours
    private static final int BREAK_DEDUCTION_MINUTES = 60;
    private static final int ROUNDING_THRESHOLD_MINUTES = 55;
    private static final int REGULAR_HOURS_CAP = 8;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    /**
     * COMPLETE: Recalculate ALL attendance records
     * Handles: Regular, Auto Time-outs, Admin Corrected, and Approved Overrides
     */
    @Transactional
    public Map<String, Object> recalculateAllRecords() {
        logger.info("🔄 Starting COMPLETE recalculation of all attendance records...");

        long startTime = System.currentTimeMillis();

        // Detailed counters
        int totalRecords = 0;
        int regularTimeouts = 0;
        int autoTimeouts = 0;
        int adminCorrectedSkipped = 0;
        int adminCorrectedRecalculated = 0;
        int approvedOverrides = 0;
        int incompleteRecords = 0;
        int updatedRecords = 0;
        int errorRecords = 0;

        int totalStudents = 0;
        int updatedStudents = 0;

        List<String> errors = new ArrayList<>();
        Map<String, Map<String, Object>> studentChanges = new HashMap<>();

        try {
            List<Student> allStudents = studentRepository.findAll();
            totalStudents = allStudents.size();

            logger.info("📊 Processing {} students...", totalStudents);

            for (Student student : allStudents) {
                try {
                    logger.info("👤 Processing student: {} ({})", student.getFullName(), student.getIdBadge());

                    List<AttendanceRecord> studentRecords = attendanceRecordRepository
                            .findByStudentOrderByAttendanceDateDesc(student);

                    double oldTotal = student.getTotalAccumulatedHours() != null ?
                            student.getTotalAccumulatedHours() : 0.0;
                    double newTotal = 0.0;

                    List<Map<String, Object>> recordChanges = new ArrayList<>();

                    for (AttendanceRecord record : studentRecords) {
                        totalRecords++;

                        // SKIP incomplete records (still timed in)
                        if (record.getTimeOut() == null) {
                            incompleteRecords++;
                            logger.trace("⏭️ Skipping incomplete record {} (TIMED_IN)", record.getId());
                            continue;
                        }

                        try {
                            double oldHours = record.getTotalHours() != null ? record.getTotalHours() : 0.0;

                            // Determine record type and handle accordingly
                            RecordTypeInfo typeInfo = analyzeRecordType(record);

                            // Update counters
                            switch (typeInfo.type) {
                                case REGULAR_TIMEOUT:
                                    regularTimeouts++;
                                    break;
                                case AUTO_TIMEOUT:
                                    autoTimeouts++;
                                    break;
                                case ADMIN_CORRECTED_SKIP:
                                    adminCorrectedSkipped++;
                                    break;
                                case ADMIN_CORRECTED_RECALC:
                                    adminCorrectedRecalculated++;
                                    break;
                                case APPROVED_OVERRIDE:
                                    approvedOverrides++;
                                    break;
                            }

                            HoursCalculation newCalculation;

                            // Handle based on type
                            if (typeInfo.shouldSkip) {
                                logger.debug("⏭️ Skipping {} - {}", typeInfo.type, typeInfo.reason);
                                // Keep existing values
                                newCalculation = new HoursCalculation();
                                newCalculation.setTotalHours(oldHours);
                                newCalculation.setRegularHours(record.getRegularHours());
                                newCalculation.setOvertimeHours(record.getOvertimeHours());
                                newCalculation.setUndertimeHours(record.getUndertimeHours());
                                newCalculation.setBreakDeducted(record.getBreakDeducted());
                            } else {
                                // Recalculate using the same logic as AttendanceService
                                newCalculation = calculateScheduleAwareHours(record, student);
                                logger.debug("♻️ Recalculating {} - {}", typeInfo.type, typeInfo.reason);
                            }

                            // Check if hours changed
                            if (Math.abs(oldHours - newCalculation.getTotalHours()) > 0.01) {
                                // Update record
                                record.setTotalHours(newCalculation.getTotalHours());
                                record.setRegularHours(newCalculation.getRegularHours());
                                record.setOvertimeHours(newCalculation.getOvertimeHours());
                                record.setUndertimeHours(newCalculation.getUndertimeHours());
                                record.setBreakDeducted(newCalculation.isBreakDeducted());

                                attendanceRecordRepository.save(record);
                                updatedRecords++;

                                // Track the change
                                recordChanges.add(Map.of(
                                        "recordId", record.getId(),
                                        "date", record.getAttendanceDate().toString(),
                                        "status", record.getStatus().name(),
                                        "recordType", typeInfo.type.toString(),
                                        "oldHours", oldHours,
                                        "newHours", newCalculation.getTotalHours(),
                                        "difference", newCalculation.getTotalHours() - oldHours,
                                        "reason", typeInfo.reason
                                ));

                                logger.debug("✏️ Updated record {}: {} -> {} hours ({})",
                                        record.getId(), oldHours, newCalculation.getTotalHours(), typeInfo.type);
                            }

                            // Add to new total
                            newTotal += newCalculation.getTotalHours();

                        } catch (Exception e) {
                            errorRecords++;
                            String error = String.format("Record %d (%s): %s",
                                    record.getId(), student.getFullName(), e.getMessage());
                            errors.add(error);
                            logger.error("❌ Error processing record {}: {}", record.getId(), e.getMessage());

                            // Use old hours to continue
                            newTotal += (record.getTotalHours() != null ? record.getTotalHours() : 0.0);
                        }
                    }

                    // Update student's total if changed
                    if (Math.abs(oldTotal - newTotal) > 0.01) {
                        student.setTotalAccumulatedHours(newTotal);
                        studentRepository.save(student);
                        updatedStudents++;

                        studentChanges.put(student.getFullName() + " (" + student.getIdBadge() + ")",
                                Map.of(
                                        "oldTotal", oldTotal,
                                        "newTotal", newTotal,
                                        "difference", newTotal - oldTotal,
                                        "recordsUpdated", recordChanges.size(),
                                        "changes", recordChanges
                                ));

                        logger.info("✅ Updated student {}: {} -> {} hours (diff: {}, {} records changed)",
                                student.getFullName(), oldTotal, newTotal,
                                newTotal - oldTotal, recordChanges.size());
                    } else {
                        logger.info("✓ Student {} unchanged: {} hours", student.getFullName(), oldTotal);
                    }

                } catch (Exception e) {
                    String error = String.format("Student %s: %s", student.getFullName(), e.getMessage());
                    errors.add(error);
                    logger.error("❌ Error processing student {}: {}", student.getFullName(), e.getMessage(), e);
                }
            }

            long duration = System.currentTimeMillis() - startTime;

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("message", "Complete recalculation finished successfully");

            result.put("summary", Map.of(
                    "totalStudents", totalStudents,
                    "updatedStudents", updatedStudents,
                    "unchangedStudents", totalStudents - updatedStudents,
                    "totalRecords", totalRecords,
                    "updatedRecords", updatedRecords,
                    "durationMs", duration,
                    "durationSeconds", duration / 1000.0
            ));

            result.put("recordBreakdown", Map.of(
                    "regularTimeouts", regularTimeouts,
                    "autoTimeouts", autoTimeouts,
                    "approvedOverrides", approvedOverrides,
                    "adminCorrectedSkipped", adminCorrectedSkipped,
                    "adminCorrectedRecalculated", adminCorrectedRecalculated,
                    "incompleteRecords", incompleteRecords,
                    "errorRecords", errorRecords
            ));

            result.put("studentChanges", studentChanges);

            if (!errors.isEmpty()) {
                result.put("errors", errors);
                result.put("hasErrors", true);
            } else {
                result.put("hasErrors", false);
            }

            logger.info("✅ COMPLETE Recalculation finished: {} students, {} records processed, {} updated in {}ms",
                    totalStudents, totalRecords, updatedRecords, duration);
            logger.info("📊 Record Types: Regular={}, Auto={}, Approved={}, AdminSkip={}, AdminRecalc={}",
                    regularTimeouts, autoTimeouts, approvedOverrides, adminCorrectedSkipped, adminCorrectedRecalculated);

            return result;

        } catch (Exception e) {
            logger.error("💥 Fatal error during recalculation: {}", e.getMessage(), e);
            throw new RuntimeException("Recalculation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Analyze record type and determine how to handle it
     */
    private RecordTypeInfo analyzeRecordType(AttendanceRecord record) {
        RecordTypeInfo info = new RecordTypeInfo();

        String tasks = record.getTasksCompleted() != null ? record.getTasksCompleted() : "";
        AttendanceStatus status = record.getStatus();

        // CASE 1: Admin Corrected with explicit correction note
        if (status == AttendanceStatus.ADMIN_CORRECTED) {
            info.type = RecordType.ADMIN_CORRECTED_SKIP;
            info.shouldSkip = true;
            info.reason = "Admin manually corrected - preserving manual values";
            return info;
        }

        // CASE 2: Approved Schedule Override (count all hours)
        if (isScheduleOverrideApproved(record)) {
            info.type = RecordType.APPROVED_OVERRIDE;
            info.shouldSkip = false;
            info.reason = "Schedule override approved - recalculating with all hours";
            return info;
        }

        // CASE 3: Auto Time-Out (recalculate with schedule rules)
        if (status == AttendanceStatus.AUTO_TIMED_OUT) {
            info.type = RecordType.AUTO_TIMEOUT;
            info.shouldSkip = false;
            info.reason = "Auto time-out - recalculating with schedule enforcement";
            return info;
        }

        // CASE 4: Admin Corrected but NO explicit note (could be old format - recalculate)
        /*if (status == AttendanceStatus.ADMIN_CORRECTED) {
            info.type = RecordType.ADMIN_CORRECTED_RECALC;
            info.shouldSkip = false;
            info.reason = "Admin corrected without note - recalculating for consistency";
            return info;
        }*/

        // CASE 5: Regular Time-Out (standard recalculation)
        info.type = RecordType.REGULAR_TIMEOUT;
        info.shouldSkip = false;
        info.reason = "Regular time-out - applying schedule enforcement";
        return info;
    }

    /**
     * Check if schedule override was approved
     */
    private boolean isScheduleOverrideApproved(AttendanceRecord record) {
        if (record.getTasksCompleted() == null) {
            return false;
        }

        String tasks = record.getTasksCompleted();

        return tasks.contains("[ADMIN APPROVED SCHEDULE OVERRIDE]") ||
                tasks.contains("[ADMIN APPROVED: Early work hours counted") ||
                tasks.contains("Early work hours will be counted for this session");
    }

    /**
     * Recalculate specific student
     */
    @Transactional
    public Map<String, Object> recalculateStudentRecords(Long studentId) {
        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        logger.info("🔄 Recalculating records for student: {} ({})", student.getFullName(), student.getIdBadge());

        List<AttendanceRecord> records = attendanceRecordRepository
                .findByStudentOrderByAttendanceDateDesc(student);

        double oldTotal = student.getTotalAccumulatedHours() != null ?
                student.getTotalAccumulatedHours() : 0.0;
        double newTotal = 0.0;
        int updatedCount = 0;
        int skippedCount = 0;

        List<Map<String, Object>> recordChanges = new ArrayList<>();

        for (AttendanceRecord record : records) {
            if (record.getTimeOut() != null) {
                double oldHours = record.getTotalHours() != null ? record.getTotalHours() : 0.0;

                RecordTypeInfo typeInfo = analyzeRecordType(record);
                HoursCalculation newCalculation;

                if (typeInfo.shouldSkip) {
                    newCalculation = new HoursCalculation();
                    newCalculation.setTotalHours(oldHours);
                    newCalculation.setRegularHours(record.getRegularHours());
                    newCalculation.setOvertimeHours(record.getOvertimeHours());
                    newCalculation.setUndertimeHours(record.getUndertimeHours());
                    newCalculation.setBreakDeducted(record.getBreakDeducted());
                } else {
                    newCalculation = calculateScheduleAwareHours(record, student);
                }

                // Update record
                record.setTotalHours(newCalculation.getTotalHours());
                record.setRegularHours(newCalculation.getRegularHours());
                record.setOvertimeHours(newCalculation.getOvertimeHours());
                record.setUndertimeHours(newCalculation.getUndertimeHours());
                record.setBreakDeducted(newCalculation.isBreakDeducted());

                attendanceRecordRepository.save(record);

                newTotal += newCalculation.getTotalHours();

                if (Math.abs(oldHours - newCalculation.getTotalHours()) > 0.01) {
                    updatedCount++;
                    recordChanges.add(Map.ofEntries(
                            Map.entry("recordId", record.getId()),
                            Map.entry("date", record.getAttendanceDate().toString()),
                            Map.entry("status", record.getStatus().name()),
                            Map.entry("recordType", typeInfo.type.toString()),
                            Map.entry("timeIn", record.getTimeIn().toString()),
                            Map.entry("timeOut", record.getTimeOut().toString()),
                            Map.entry("oldHours", oldHours),
                            Map.entry("newHours", newCalculation.getTotalHours()),
                            Map.entry("difference", newCalculation.getTotalHours() - oldHours),
                            Map.entry("breakDeducted", newCalculation.isBreakDeducted()),
                            Map.entry("reason", typeInfo.reason)
                    ));
                }
            } else {
                skippedCount++;
            }
        }

        // Update student total
        student.setTotalAccumulatedHours(newTotal);
        studentRepository.save(student);

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("studentName", student.getFullName());
        result.put("idBadge", student.getIdBadge());
        result.put("oldTotal", oldTotal);
        result.put("newTotal", newTotal);
        result.put("difference", newTotal - oldTotal);
        result.put("totalRecords", records.size());
        result.put("updatedRecords", updatedCount);
        result.put("skippedRecords", skippedCount);
        result.put("recordChanges", recordChanges);

        logger.info("✅ Student recalculation completed: {} -> {} hours ({} records updated)",
                oldTotal, newTotal, updatedCount);

        return result;
    }

    /**
     * Recalculate specific record
     */
    @Transactional
    public Map<String, Object> recalculateAttendanceRecord(Long recordId) {
        AttendanceRecord record = attendanceRecordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("Attendance record not found"));

        if (record.getTimeOut() == null) {
            throw new RuntimeException("Cannot recalculate incomplete record (no time-out)");
        }

        Student student = record.getStudent();

        double oldTotal = record.getTotalHours() != null ? record.getTotalHours() : 0.0;
        RecordTypeInfo typeInfo = analyzeRecordType(record);

        HoursCalculation newCalculation;
        if (typeInfo.shouldSkip) {
            newCalculation = new HoursCalculation();
            newCalculation.setTotalHours(oldTotal);
            newCalculation.setRegularHours(record.getRegularHours());
            newCalculation.setOvertimeHours(record.getOvertimeHours());
            newCalculation.setUndertimeHours(record.getUndertimeHours());
            newCalculation.setBreakDeducted(record.getBreakDeducted());
        } else {
            newCalculation = calculateScheduleAwareHours(record, student);
        }

        // Update record
        record.setTotalHours(newCalculation.getTotalHours());
        record.setRegularHours(newCalculation.getRegularHours());
        record.setOvertimeHours(newCalculation.getOvertimeHours());
        record.setUndertimeHours(newCalculation.getUndertimeHours());
        record.setBreakDeducted(newCalculation.isBreakDeducted());

        attendanceRecordRepository.save(record);

        // Recalculate student's total
        Map<String, Object> studentRecalc = recalculateStudentRecords(student.getId());

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("recordId", recordId);
        result.put("studentName", student.getFullName());
        result.put("date", record.getAttendanceDate());
        result.put("status", record.getStatus().name());
        result.put("recordType", typeInfo.type.toString());
        result.put("wasSkipped", typeInfo.shouldSkip);
        result.put("reason", typeInfo.reason);
        result.put("oldHours", oldTotal);
        result.put("newHours", newCalculation.getTotalHours());
        result.put("difference", newCalculation.getTotalHours() - oldTotal);
        result.put("breakDeducted", newCalculation.isBreakDeducted());
        result.put("studentTotalUpdated", studentRecalc.get("newTotal"));

        return result;
    }

    /**
     * Preview recalculation
     */
    public Map<String, Object> previewRecalculation() {
        logger.info("🔍 Running COMPLETE recalculation preview...");

        List<Student> allStudents = studentRepository.findAll();
        List<Map<String, Object>> preview = new ArrayList<>();

        int totalChanges = 0;
        double totalHoursDifference = 0.0;
        int totalRecordsAffected = 0;

        Map<String, Integer> recordTypeCount = new HashMap<>();

        for (Student student : allStudents) {
            List<AttendanceRecord> records = attendanceRecordRepository
                    .findByStudentOrderByAttendanceDateDesc(student);

            double currentTotal = student.getTotalAccumulatedHours() != null ?
                    student.getTotalAccumulatedHours() : 0.0;
            double calculatedTotal = 0.0;
            int recordsWithChanges = 0;

            List<Map<String, Object>> recordChanges = new ArrayList<>();

            for (AttendanceRecord record : records) {
                if (record.getTimeOut() != null) {
                    double oldHours = record.getTotalHours() != null ? record.getTotalHours() : 0.0;

                    RecordTypeInfo typeInfo = analyzeRecordType(record);
                    recordTypeCount.merge(typeInfo.type.toString(), 1, Integer::sum);

                    HoursCalculation calc;
                    if (typeInfo.shouldSkip) {
                        calc = new HoursCalculation();
                        calc.setTotalHours(oldHours);
                    } else {
                        calc = calculateScheduleAwareHours(record, student);
                    }

                    calculatedTotal += calc.getTotalHours();

                    if (Math.abs(oldHours - calc.getTotalHours()) > 0.01) {
                        recordsWithChanges++;
                        recordChanges.add(Map.of(
                                "date", record.getAttendanceDate().toString(),
                                "status", record.getStatus().name(),
                                "recordType", typeInfo.type.toString(),
                                "oldHours", oldHours,
                                "newHours", calc.getTotalHours(),
                                "difference", calc.getTotalHours() - oldHours,
                                "reason", typeInfo.reason
                        ));
                    }
                }
            }

            if (Math.abs(currentTotal - calculatedTotal) > 0.01) {
                totalChanges++;
                double difference = calculatedTotal - currentTotal;
                totalHoursDifference += Math.abs(difference);
                totalRecordsAffected += recordsWithChanges;

                preview.add(Map.of(
                        "studentName", student.getFullName(),
                        "idBadge", student.getIdBadge(),
                        "currentTotal", currentTotal,
                        "calculatedTotal", calculatedTotal,
                        "difference", difference,
                        "percentageChange", currentTotal > 0 ? (difference / currentTotal) * 100 : 0,
                        "recordsAffected", recordsWithChanges,
                        "recordChanges", recordChanges.size() > 5 ? recordChanges.subList(0, 5) : recordChanges,
                        "hasMoreChanges", recordChanges.size() > 5
                ));
            }
        }

        // Sort by absolute difference
        preview.sort((a, b) -> {
            double diffA = Math.abs((Double) a.get("difference"));
            double diffB = Math.abs((Double) b.get("difference"));
            return Double.compare(diffB, diffA);
        });

        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Complete preview finished (no changes saved)");
        result.put("summary", Map.of(
                "totalStudents", allStudents.size(),
                "studentsWithChanges", totalChanges,
                "studentsUnchanged", allStudents.size() - totalChanges,
                "totalHoursDifference", Math.round(totalHoursDifference * 100.0) / 100.0,
                "totalRecordsAffected", totalRecordsAffected
        ));
        result.put("recordTypeBreakdown", recordTypeCount);
        result.put("preview", preview);
        result.put("note", "This is a preview only. No changes saved.");

        return result;
    }

    /**
     * Get statistics
     */
    public Map<String, Object> getRecalculationStats() {
        List<Student> allStudents = studentRepository.findAll();
        List<AttendanceRecord> allRecords = attendanceRecordRepository.findAll();

        long completedRecords = allRecords.stream()
                .filter(r -> r.getTimeOut() != null)
                .count();

        long incompleteRecords = allRecords.stream()
                .filter(r -> r.getTimeOut() == null)
                .count();

        long studentsWithSchedule = allStudents.stream()
                .filter(Student::hasActiveSchedule)
                .count();

        long autoTimeouts = allRecords.stream()
                .filter(r -> r.getStatus() == AttendanceStatus.AUTO_TIMED_OUT)
                .count();

        long adminCorrected = allRecords.stream()
                .filter(r -> r.getStatus() == AttendanceStatus.ADMIN_CORRECTED)
                .count();

        long approvedOverrides = allRecords.stream()
                .filter(this::isScheduleOverrideApproved)
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalStudents", allStudents.size());
        stats.put("totalRecords", allRecords.size());
        stats.put("completedRecords", completedRecords);
        stats.put("incompleteRecords", incompleteRecords);
        stats.put("studentsWithSchedule", studentsWithSchedule);
        stats.put("studentsWithoutSchedule", allStudents.size() - studentsWithSchedule);
        stats.put("autoTimeouts", autoTimeouts);
        stats.put("adminCorrected", adminCorrected);
        stats.put("approvedOverrides", approvedOverrides);
        stats.put("regularTimeouts", completedRecords - autoTimeouts - adminCorrected);

        return stats;
    }

    // ==================== CALCULATION METHODS ====================

    private HoursCalculation calculateScheduleAwareHours(AttendanceRecord record, Student student) {
        LocalDateTime timeIn = record.getTimeIn();
        LocalDateTime timeOut = record.getTimeOut();

        // Check for approved override
        if (isScheduleOverrideApproved(record)) {
            logger.debug("✅ Approved override - counting all hours for record {}", record.getId());
            return calculateOriginalHours(timeIn, timeOut);
        }

        // No schedule = standard calculation
        if (!student.hasActiveSchedule()) {
            return calculateOriginalHours(timeIn, timeOut);
        }

        // Strict schedule enforcement
        return calculateStrictScheduleHours(student, timeIn, timeOut);
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

        if (totalMinutes >= BREAK_DEDUCTION_THRESHOLD_MINUTES) {
            totalMinutes -= BREAK_DEDUCTION_MINUTES;
            calculation.setBreakDeducted(true);
        }

        double roundedHours = convertMinutesToHoursWithRounding(totalMinutes);
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

    private double convertMinutesToHoursWithRounding(long totalMinutes) {
        long wholeHours = totalMinutes / 60;
        long remainingMinutes = totalMinutes % 60;

        if (remainingMinutes >= ROUNDING_THRESHOLD_MINUTES) {
            wholeHours += 1;
        }

        return (double) wholeHours;
    }

    // ==================== ENUMS AND HELPER CLASSES ====================

    private enum RecordType {
        REGULAR_TIMEOUT,
        AUTO_TIMEOUT,
        APPROVED_OVERRIDE,
        ADMIN_CORRECTED_SKIP,
        ADMIN_CORRECTED_RECALC
    }

    private static class RecordTypeInfo {
        RecordType type;
        boolean shouldSkip;
        String reason;
    }
}