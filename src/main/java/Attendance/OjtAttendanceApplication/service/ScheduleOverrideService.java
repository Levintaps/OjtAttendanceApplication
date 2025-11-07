package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideRequestDto;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideResponseDto;
import Attendance.OjtAttendanceApplication.dto.ScheduleOverrideReviewDto;
import Attendance.OjtAttendanceApplication.entity.*;
import Attendance.OjtAttendanceApplication.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class ScheduleOverrideService {

    @Autowired
    private ScheduleOverrideRepository scheduleOverrideRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private AdminNotificationRepository adminNotificationRepository;

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
    public ScheduleOverrideResponseDto reviewRequest(Long requestId, ScheduleOverrideReviewDto review) {
        ScheduleOverrideEntity request = scheduleOverrideRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Schedule override request not found"));

        if (!request.getStatus().equals(OverrideRequestStatus.PENDING)) {
            throw new RuntimeException("This request has already been reviewed");
        }

        // Update request status
        if ("APPROVE".equalsIgnoreCase(review.getAction())) {
            request.setStatus(OverrideRequestStatus.APPROVED);

            // Apply approval to attendance record
            AttendanceRecord record = request.getAttendanceRecord();
            String currentTasks = record.getTasksCompleted() != null ? record.getTasksCompleted() : "";
            record.setTasksCompleted(currentTasks +
                    "\n[ADMIN APPROVED SCHEDULE OVERRIDE: Early work hours will be counted for this session]");
            attendanceRecordRepository.save(record);

        } else if ("REJECT".equalsIgnoreCase(review.getAction())) {
            request.setStatus(OverrideRequestStatus.REJECTED);

        } else {
            throw new RuntimeException("Invalid action. Must be APPROVE or REJECT");
        }

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