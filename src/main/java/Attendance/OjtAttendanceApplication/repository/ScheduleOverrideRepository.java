package Attendance.OjtAttendanceApplication.repository;

import Attendance.OjtAttendanceApplication.entity.ScheduleOverrideEntity;
import Attendance.OjtAttendanceApplication.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduleOverrideRepository extends JpaRepository<ScheduleOverrideEntity, Long> {

    // Find all pending requests for admin
    @Query("SELECT s FROM ScheduleOverrideEntity s WHERE s.status = 'PENDING' ORDER BY s.requestedAt DESC")
    List<ScheduleOverrideEntity> findAllPendingRequests();

    // Find requests by student (all statuses)
    List<ScheduleOverrideEntity> findByStudentOrderByRequestedAtDesc(Student student);

    // Find pending requests by student
    @Query("SELECT s FROM ScheduleOverrideEntity s WHERE s.student = :student AND s.status = 'PENDING' ORDER BY s.requestedAt DESC")
    List<ScheduleOverrideEntity> findPendingRequestsByStudent(@Param("student") Student student);

    // Find by ID badge (for API queries)
    @Query("SELECT s FROM ScheduleOverrideEntity s WHERE s.student.idBadge = :idBadge ORDER BY s.requestedAt DESC")
    List<ScheduleOverrideEntity> findByStudentIdBadge(@Param("idBadge") String idBadge);

    // Find pending by ID badge
    @Query("SELECT s FROM ScheduleOverrideEntity s WHERE s.student.idBadge = :idBadge AND s.status = 'PENDING' ORDER BY s.requestedAt DESC")
    List<ScheduleOverrideEntity> findPendingByStudentIdBadge(@Param("idBadge") String idBadge);

    // Count pending requests
    @Query("SELECT COUNT(s) FROM ScheduleOverrideEntity s WHERE s.status = 'PENDING'")
    Long countPendingRequests();

    // Find by attendance record
    @Query("SELECT s FROM ScheduleOverrideEntity s WHERE s.attendanceRecord.id = :recordId")
    Optional<ScheduleOverrideEntity> findByAttendanceRecordId(@Param("recordId") Long recordId);
}