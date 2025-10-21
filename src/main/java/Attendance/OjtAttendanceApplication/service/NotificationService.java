package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.AdminNotificationDto;
import Attendance.OjtAttendanceApplication.entity.AdminNotification;
import Attendance.OjtAttendanceApplication.entity.AttendanceRecord;
import Attendance.OjtAttendanceApplication.entity.NotificationType;
import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.repository.AdminNotificationRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    @Autowired
    private AdminNotificationRepository adminNotificationRepository;

    public void createMissingTimeOutNotification(Student student, AttendanceRecord attendanceRecord) {
        // Check if notification already exists for this record
        Optional<AdminNotification> existingNotification = adminNotificationRepository
                .findByAttendanceRecordAndNotificationType(attendanceRecord, NotificationType.MISSING_TIME_OUT);

        if (existingNotification.isEmpty()) {
            Duration timeSinceTimeIn = Duration.between(attendanceRecord.getTimeIn(), LocalDateTime.now());
            String message = String.format("Student %s (ID: %s) has been timed in for %d hours without timing out.",
                    student.getFullName(), student.getIdBadge(), timeSinceTimeIn.toHours());

            AdminNotification notification = new AdminNotification(
                    student, attendanceRecord, NotificationType.MISSING_TIME_OUT, message
            );
            adminNotificationRepository.save(notification);
        }
    }

    public void createAutoTimeOutNotification(Student student, AttendanceRecord attendanceRecord) {
        String message = String.format("Student %s (ID: %s) has been automatically timed out after 16 hours. Please review and correct if necessary.",
                student.getFullName(), student.getIdBadge());

        AdminNotification notification = new AdminNotification(
                student, attendanceRecord, NotificationType.AUTO_TIME_OUT_OCCURRED, message
        );
        adminNotificationRepository.save(notification);
    }

    public void createLongWorkSessionNotification(Student student, AttendanceRecord attendanceRecord) {
        // Check if notification already exists for this record
        Optional<AdminNotification> existingNotification = adminNotificationRepository
                .findByAttendanceRecordAndNotificationType(attendanceRecord, NotificationType.LONG_WORK_SESSION);

        if (existingNotification.isEmpty()) {
            Duration timeSinceTimeIn = Duration.between(attendanceRecord.getTimeIn(), LocalDateTime.now());
            String message = String.format("Student %s (ID: %s) has been working for %d hours. Please check on their wellbeing.",
                    student.getFullName(), student.getIdBadge(), timeSinceTimeIn.toHours());

            AdminNotification notification = new AdminNotification(
                    student, attendanceRecord, NotificationType.LONG_WORK_SESSION, message
            );
            adminNotificationRepository.save(notification);
        }
    }

    // New method for completion ready notification
    public void createCompletionReadyNotification(Student student) {
        // Since this is not tied to a specific attendance record, we'll need a different approach
        // For now, we'll use the student's most recent attendance record
        if (student.getAttendanceRecords() != null && !student.getAttendanceRecords().isEmpty()) {
            AttendanceRecord latestRecord = student.getAttendanceRecords().get(0); // Assuming sorted by date desc

            String message = String.format("Student %s (ID: %s) has completed their required hours (%s/%s hours). Ready for completion.",
                    student.getFullName(),
                    student.getIdBadge() != null ? student.getIdBadge() : "COMPLETED",
                    student.getTotalAccumulatedHours(),
                    student.getRequiredHours());

            // We can reuse LONG_WORK_SESSION or create a new notification type
            // For now, let's create a generic notification with a completion message
            AdminNotification notification = new AdminNotification(
                    student, latestRecord, NotificationType.LONG_WORK_SESSION, message
            );
            adminNotificationRepository.save(notification);
        }
    }

    public List<AdminNotificationDto> getUnreadNotifications() {
        List<AdminNotification> notifications = adminNotificationRepository.findByIsReadFalseOrderByCreatedAtDesc();
        return notifications.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<AdminNotificationDto> getAllNotifications() {
        List<AdminNotification> notifications = adminNotificationRepository.findAllByOrderByCreatedAtDesc();
        return notifications.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public Long getUnreadNotificationCount() {
        return adminNotificationRepository.countUnreadNotifications();
    }

    public void markNotificationAsRead(Long notificationId) {
        Optional<AdminNotification> notification = adminNotificationRepository.findById(notificationId);
        if (notification.isPresent()) {
            notification.get().setIsRead(true);
            adminNotificationRepository.save(notification.get());
        }
    }

    public void markAllNotificationsAsRead() {
        List<AdminNotification> unreadNotifications = adminNotificationRepository.findByIsReadFalseOrderByCreatedAtDesc();
        for (AdminNotification notification : unreadNotifications) {
            notification.setIsRead(true);
        }
        adminNotificationRepository.saveAll(unreadNotifications);
    }

    private AdminNotificationDto convertToDto(AdminNotification notification) {
        AdminNotificationDto dto = new AdminNotificationDto();
        dto.setId(notification.getId());
        dto.setStudentName(notification.getStudent().getFullName());
        dto.setIdBadge(notification.getStudent().getIdBadge());
        dto.setNotificationType(notification.getNotificationType().name());
        dto.setMessage(notification.getMessage());
        dto.setIsRead(notification.getIsRead());
        dto.setCreatedAt(notification.getCreatedAt());
        dto.setReadAt(notification.getReadAt());
        dto.setAttendanceRecordId(notification.getAttendanceRecord().getId());
        return dto;
    }

    @Transactional
    public void deleteNotificationsForRecord(AttendanceRecord record) {
        List<AdminNotification> notifications = adminNotificationRepository
                .findByAttendanceRecord(record);
        adminNotificationRepository.deleteAll(notifications);
    }

    @Transactional
    public void deleteNotification(Long notificationId) {
        AdminNotification notification = adminNotificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        adminNotificationRepository.delete(notification);
    }

    @Transactional
    public int deleteNotifications(List<Long> notificationIds) {
        List<AdminNotification> notifications = adminNotificationRepository.findAllById(notificationIds);
        int count = notifications.size();
        adminNotificationRepository.deleteAll(notifications);
        return count;
    }

    @Transactional
    public int clearReadNotifications() {
        List<AdminNotification> readNotifications = adminNotificationRepository
                .findByIsReadTrue();
        int count = readNotifications.size();
        adminNotificationRepository.deleteAll(readNotifications);
        return count;
    }

    @Transactional
    public int clearAllNotifications() {
        List<AdminNotification> allNotifications = adminNotificationRepository.findAll();
        int count = allNotifications.size();
        adminNotificationRepository.deleteAll(allNotifications);
        return count;
    }

    @Transactional
    public int cleanupOldNotifications(Integer daysOld) {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(daysOld);
        List<AdminNotification> oldNotifications = adminNotificationRepository
                .findByCreatedAtBeforeAndIsReadTrue(cutoffDate);
        int count = oldNotifications.size();
        adminNotificationRepository.deleteAll(oldNotifications);
        return count;
    }

}