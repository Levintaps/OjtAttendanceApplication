package Attendance.OjtAttendanceApplication.repository;

import Attendance.OjtAttendanceApplication.entity.AttendanceRecord;
import Attendance.OjtAttendanceApplication.entity.TaskEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TaskEntryRepository extends JpaRepository<TaskEntry, Long> {

    List<TaskEntry> findByAttendanceRecordOrderByCompletedAtAsc(AttendanceRecord attendanceRecord);

    @Query("SELECT te FROM TaskEntry te WHERE te.attendanceRecord.student.idBadge = :idBadge " +
            "AND DATE(te.attendanceRecord.attendanceDate) = :date ORDER BY te.completedAt ASC")
    List<TaskEntry> findByStudentIdBadgeAndDate(@Param("idBadge") String idBadge, @Param("date") LocalDate date);

    @Query("SELECT COUNT(te) FROM TaskEntry te WHERE te.attendanceRecord.student.idBadge = :idBadge " +
            "AND DATE(te.attendanceRecord.attendanceDate) = CURRENT_DATE")
    Integer countTasksForStudentToday(@Param("idBadge") String idBadge);

    @Query("SELECT CASE WHEN COUNT(te) > 0 THEN true ELSE false END FROM TaskEntry te " +
            "WHERE te.attendanceRecord.student.idBadge = :idBadge " +
            "AND DATE(te.attendanceRecord.attendanceDate) = CURRENT_DATE")
    Boolean existsTasksForStudentToday(@Param("idBadge") String idBadge);
}
