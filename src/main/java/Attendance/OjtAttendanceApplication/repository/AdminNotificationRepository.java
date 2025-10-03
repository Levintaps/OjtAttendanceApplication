package Attendance.OjtAttendanceApplication.repository;

import Attendance.OjtAttendanceApplication.entity.AdminNotification;
import Attendance.OjtAttendanceApplication.entity.AttendanceRecord;
import Attendance.OjtAttendanceApplication.entity.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AdminNotificationRepository extends JpaRepository<AdminNotification, Long> {

    List<AdminNotification> findByIsReadFalseOrderByCreatedAtDesc();

    List<AdminNotification> findAllByOrderByCreatedAtDesc();

    @Query("SELECT COUNT(an) FROM AdminNotification an WHERE an.isRead = false")
    Long countUnreadNotifications();

    Optional<AdminNotification> findByAttendanceRecordAndNotificationType(
            AttendanceRecord attendanceRecord, NotificationType notificationType);

    List<AdminNotification> findByAttendanceRecord(AttendanceRecord attendanceRecord);
}
