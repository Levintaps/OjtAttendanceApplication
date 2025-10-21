package Attendance.OjtAttendanceApplication.repository;

import Attendance.OjtAttendanceApplication.entity.AttendanceRecord;
import Attendance.OjtAttendanceApplication.entity.AttendanceStatus;
import Attendance.OjtAttendanceApplication.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {

    Optional<AttendanceRecord> findByStudentAndAttendanceDateAndStatus(
            Student student, LocalDate date, AttendanceStatus status);

    List<AttendanceRecord> findByStudentOrderByAttendanceDateDesc(Student student);

    List<AttendanceRecord> findByStudentAndAttendanceDate(Student student, LocalDate date);


    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.attendanceDate BETWEEN :startDate AND :endDate ORDER BY ar.attendanceDate DESC, ar.timeIn ASC")
    List<AttendanceRecord> findByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.student = :student AND ar.attendanceDate BETWEEN :startDate AND :endDate ORDER BY ar.attendanceDate DESC")
    List<AttendanceRecord> findByStudentAndDateRange(@Param("student") Student student, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    // New methods for notification system
    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.status = 'TIMED_IN' AND ar.timeIn < :cutoffTime")
    List<AttendanceRecord> findIncompleteRecordsOlderThan(@Param("cutoffTime") LocalDateTime cutoffTime);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.status = 'TIMED_IN'")
    List<AttendanceRecord> findAllTimedInRecords();

    List<AttendanceRecord> findByStatusIn(List<AttendanceStatus> statuses);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.status IN ('TIMED_IN', 'AUTO_TIMED_OUT', 'INCOMPLETE') ORDER BY ar.attendanceDate DESC")
    List<AttendanceRecord> findRecordsNeedingCorrection();

    @Query("SELECT ar FROM AttendanceRecord ar WHERE " +
            "(ar.status = 'TIMED_IN' AND ar.timeIn < :twelveHoursAgo) OR " +
            "(ar.status = 'AUTO_TIMED_OUT') OR " +
            "(ar.status = 'INCOMPLETE') " +
            "ORDER BY ar.attendanceDate DESC, ar.timeIn DESC")
    List<AttendanceRecord> findRecordsNeedingAdminReview(@Param("twelveHoursAgo") LocalDateTime twelveHoursAgo);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.student = :student " +
            "AND ar.workDate = :workDate ORDER BY ar.timeIn DESC")
    List<AttendanceRecord> findByStudentAndWorkDate(@Param("student") Student student,
                                                    @Param("workDate") LocalDate workDate);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.student = :student " +
            "AND ar.status = 'TIMED_IN' ORDER BY ar.timeIn DESC")
    Optional<AttendanceRecord> findActiveSessionByStudent(@Param("student") Student student);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.workDate = :workDate " +
            "ORDER BY ar.timeIn ASC")
    List<AttendanceRecord> findByWorkDateOrderByTimeInAsc(@Param("workDate") LocalDate workDate);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.workDate BETWEEN :startDate AND :endDate " +
            "ORDER BY ar.workDate DESC, ar.timeIn ASC")
    List<AttendanceRecord> findByWorkDateRange(@Param("startDate") LocalDate startDate,
                                               @Param("endDate") LocalDate endDate);

    @Query("SELECT ar FROM AttendanceRecord ar WHERE ar.attendanceDate = :date " +
            "ORDER BY ar.timeIn ASC")
    List<AttendanceRecord> findByAttendanceDateOrderByTimeInAsc(@Param("date") LocalDate date);
}
