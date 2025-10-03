package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.HoursCalculation;
import Attendance.OjtAttendanceApplication.entity.AttendanceRecord;
import Attendance.OjtAttendanceApplication.entity.AttendanceStatus;
import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.entity.StudentStatus;
import Attendance.OjtAttendanceApplication.repository.AttendanceRecordRepository;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional
public class ScheduledTaskService {

    private static final Logger logger = LoggerFactory.getLogger(ScheduledTaskService.class);

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private NotificationService notificationService;

    // Run every hour to check for incomplete records
    @Scheduled(fixedRate = 3600000) // 1 hour
    public void checkForIncompleteRecords() {
        try {
            logger.info("Starting scheduled task: checkForIncompleteRecords");

            LocalDateTime now = LocalDateTime.now();
            // Use the new query that finds all TIMED_IN records regardless of date
            List<AttendanceRecord> timedInRecords = attendanceRecordRepository.findAllTimedInRecords();

            logger.info("Found {} records with TIMED_IN status", timedInRecords.size());

            int processedRecords = 0;
            int autoTimeOuts = 0;
            int longWorkNotifications = 0;
            int missingTimeOutNotifications = 0;

            for (AttendanceRecord record : timedInRecords) {
                try {
                    // Only process records for ACTIVE students
                    if (record.getStudent().getStatus() != StudentStatus.ACTIVE) {
                        logger.debug("Skipping record {} - student {} is not ACTIVE",
                                record.getId(), record.getStudent().getFullName());
                        continue;
                    }

                    Duration timeSinceTimeIn = Duration.between(record.getTimeIn(), now);
                    long hoursWorked = timeSinceTimeIn.toHours();

                    logger.debug("Processing record {} for student {} - hours worked: {}",
                            record.getId(), record.getStudent().getFullName(), hoursWorked);

                    // Auto time-out after 16 hours
                    if (hoursWorked >= 16) {
                        performAutoTimeOut(record);
                        autoTimeOuts++;
                        logger.info("Auto time-out performed for student {} after {} hours",
                                record.getStudent().getFullName(), hoursWorked);
                    }
                    // Notify admin for long work sessions (after 10 hours)
                    else if (hoursWorked >= 10) {
                        notificationService.createLongWorkSessionNotification(record.getStudent(), record);
                        longWorkNotifications++;
                    }
                    // Notify admin for missing time-out (after 8 hours)
                    else if (hoursWorked >= 8) {
                        notificationService.createMissingTimeOutNotification(record.getStudent(), record);
                        missingTimeOutNotifications++;
                    }

                    processedRecords++;
                } catch (Exception e) {
                    logger.error("Error processing attendance record {}: {}",
                            record.getId(), e.getMessage(), e);
                }
            }

            logger.info("Completed scheduled task: checkForIncompleteRecords - " +
                            "Processed: {}, Auto time-outs: {}, Long work: {}, Missing timeout: {}",
                    processedRecords, autoTimeOuts, longWorkNotifications, missingTimeOutNotifications);

        } catch (Exception e) {
            logger.error("Fatal error in checkForIncompleteRecords: {}", e.getMessage(), e);
        }
    }

    // New scheduled task to check for students ready for completion
    @Scheduled(fixedRate = 86400000) // Run daily (24 hours = 86400000 milliseconds)
    public void checkForStudentsReadyForCompletion() {
        try {
            logger.info("Starting scheduled task: checkForStudentsReadyForCompletion");

            List<Student> studentsReadyForCompletion = studentRepository.findActiveStudentsReadyForCompletion();

            logger.info("Found {} students ready for completion", studentsReadyForCompletion.size());

            int notificationsCreated = 0;

            for (Student student : studentsReadyForCompletion) {
                try {
                    // Create a special notification for students who have reached their required hours
                    notificationService.createCompletionReadyNotification(student);
                    notificationsCreated++;

                    logger.info("Completion notification created for student {} - {}/{} hours completed",
                            student.getFullName(), student.getTotalAccumulatedHours(), student.getRequiredHours());

                } catch (Exception e) {
                    logger.error("Error creating completion notification for student {}: {}",
                            student.getFullName(), e.getMessage(), e);
                }
            }

            logger.info("Completed scheduled task: checkForStudentsReadyForCompletion - {} notifications created",
                    notificationsCreated);

        } catch (Exception e) {
            logger.error("Fatal error in checkForStudentsReadyForCompletion scheduled task: {}", e.getMessage(), e);
        }
    }

    private void performAutoTimeOut(AttendanceRecord record) {
        try {
            LocalDateTime autoTimeOutTime = record.getTimeIn().plusHours(16);

            record.setTimeOut(autoTimeOutTime);
            record.setStatus(AttendanceStatus.AUTO_TIMED_OUT);
            record.setTasksCompleted("AUTO TIME-OUT: Student did not time out manually after 16 hours");

            // Calculate hours using the same logic as manual time-out
            LocalDateTime roundedTimeIn = roundToNearestHour(record.getTimeIn());
            LocalDateTime roundedTimeOut = roundToNearestHour(autoTimeOutTime);
            HoursCalculation calculation = calculateHours(roundedTimeIn, roundedTimeOut);

            record.setTotalHours(calculation.getTotalHours());
            record.setRegularHours(calculation.getRegularHours());
            record.setOvertimeHours(calculation.getOvertimeHours());
            record.setUndertimeHours(calculation.getUndertimeHours());
            record.setBreakDeducted(calculation.isBreakDeducted());

            // Update student's total accumulated hours
            Student student = record.getStudent();
            Double originalHours = student.getTotalAccumulatedHours();
            student.setTotalAccumulatedHours(originalHours + calculation.getTotalHours());

            attendanceRecordRepository.save(record);
            studentRepository.save(student);

            logger.info("Auto time-out completed for student {} - added {} hours (total: {} -> {})",
                    student.getFullName(), calculation.getTotalHours(), originalHours, student.getTotalAccumulatedHours());

            // Create notification for admin
            notificationService.createAutoTimeOutNotification(student, record);

        } catch (Exception e) {
            logger.error("Error performing auto time-out for record {}: {}", record.getId(), e.getMessage(), e);
            throw e;
        }
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

        // Ensure minimum of 0 hours
        calculation.setTotalHours(Math.max(0.0, Math.round(rawHours * 100.0) / 100.0));

        // Calculate regular, overtime, and undertime
        if (calculation.getTotalHours() >= 8.0) {
            calculation.setRegularHours(8.0);
            calculation.setOvertimeHours(calculation.getTotalHours() - 8.0);
            calculation.setUndertimeHours(0.0);
        } else {
            calculation.setRegularHours(calculation.getTotalHours());
            calculation.setOvertimeHours(0.0);
            calculation.setUndertimeHours(Math.max(0.0, 8.0 - calculation.getTotalHours()));
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
}