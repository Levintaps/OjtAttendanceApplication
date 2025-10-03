package Attendance.OjtAttendanceApplication.repository;

import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.entity.StudentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentRepository extends JpaRepository<Student, Long> {

    // Existing methods
    Optional<Student> findByIdBadge(String idBadge);
    boolean existsByIdBadge(String idBadge);

    // New methods for status management
    List<Student> findByStatus(StudentStatus status);

    List<Student> findByStatusOrderByFullNameAsc(StudentStatus status);

    // Check if badge is available (only check against ACTIVE students)
    @Query("SELECT COUNT(s) FROM Student s WHERE s.idBadge = :idBadge AND s.status = 'ACTIVE'")
    Long countActiveStudentsByIdBadge(@Param("idBadge") String idBadge);

    // Find students near completion (90% or more of required hours)
    @Query("SELECT s FROM Student s WHERE s.status = 'ACTIVE' AND s.requiredHours IS NOT NULL " +
            "AND (s.totalAccumulatedHours / s.requiredHours) >= 0.9")
    List<Student> findActiveStudentsNearCompletion();

    // Find students who have reached or exceeded required hours but are still active
    @Query("SELECT s FROM Student s WHERE s.status = 'ACTIVE' AND s.requiredHours IS NOT NULL " +
            "AND s.totalAccumulatedHours >= s.requiredHours")
    List<Student> findActiveStudentsReadyForCompletion();

    // Find active students with required hours set
    @Query("SELECT s FROM Student s WHERE s.status = 'ACTIVE' AND s.requiredHours IS NOT NULL " +
            "ORDER BY s.fullName ASC")
    List<Student> findActiveStudentsWithRequiredHours();
}