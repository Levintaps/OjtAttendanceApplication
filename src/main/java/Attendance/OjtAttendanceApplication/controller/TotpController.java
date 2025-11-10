package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.entity.AdminNotification;
import Attendance.OjtAttendanceApplication.entity.NotificationType;
import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.repository.AdminNotificationRepository;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import Attendance.OjtAttendanceApplication.service.TotpService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/totp")
@CrossOrigin(origins = "*")
public class TotpController {

    @Autowired
    private TotpService totpService;

    @Autowired
    private StudentRepository studentRepository;

    /**
     * Check TOTP status for a student by ID badge
     * Returns whether TOTP is enabled and if setup is required
     */
    @GetMapping("/status/{idBadge}")
    public ResponseEntity<?> getTotpStatus(@PathVariable String idBadge) {
        try {
            Student student = studentRepository.findByIdBadge(idBadge)
                    .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

            Map<String, Object> response = new HashMap<>();
            response.put("idBadge", student.getIdBadge());
            response.put("studentName", student.getFullName());
            response.put("totpEnabled", student.getTotpEnabled() != null && student.getTotpEnabled());
            response.put("requiresSetup", student.getTotpSecret() == null || student.getTotpSecret().isEmpty());

            if (student.getTotpEnabled() != null && student.getTotpEnabled()) {
                response.put("message", "TOTP is enabled. Enter your 6-digit code from Google Authenticator.");
            } else {
                response.put("message", "First time setup required. Please scan the QR code with Google Authenticator.");
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Generate or regenerate TOTP secret and QR code for a student
     * This should only be called during initial setup or when resetting TOTP
     */
    @PostMapping("/setup/{idBadge}")
    public ResponseEntity<?> setupTotp(@PathVariable String idBadge) {
        try {
            Student student = studentRepository.findByIdBadge(idBadge)
                    .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

            // Generate new secret
            String secret = totpService.generateSecret();

            // Generate QR code
            String qrCodeDataUrl = totpService.generateQrCodeDataUrl(
                    secret,
                    student.getFullName(),
                    student.getIdBadge()
            );

            // Save secret but don't enable TOTP yet (will enable after first successful validation)
            student.setTotpSecret(secret);
            student.setTotpEnabled(false);
            studentRepository.save(student);

            Map<String, Object> response = new HashMap<>();
            response.put("idBadge", student.getIdBadge());
            response.put("studentName", student.getFullName());
            response.put("qrCodeDataUrl", qrCodeDataUrl);
            response.put("secret", secret); // Show secret for manual entry if needed
            response.put("message", "Scan this QR code with Google Authenticator app. Then enter the 6-digit code to complete setup.");
            response.put("totpEnabled", false);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Verify TOTP code and enable TOTP for first-time setup
     */
    @PostMapping("/verify/{idBadge}")
    public ResponseEntity<?> verifyAndEnableTotp(@PathVariable String idBadge,
                                                 @RequestBody Map<String, String> request) {
        try {
            Student student = studentRepository.findByIdBadge(idBadge)
                    .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

            if (student.getTotpSecret() == null || student.getTotpSecret().isEmpty()) {
                throw new RuntimeException("TOTP not set up. Please scan QR code first.");
            }

            String code = request.get("totpCode");
            if (code == null || code.trim().isEmpty()) {
                throw new RuntimeException("TOTP code is required");
            }

            boolean isValid = totpService.verifyCode(student.getTotpSecret(), code);

            if (isValid) {
                // Enable TOTP on first successful verification
                student.setTotpEnabled(true);
                studentRepository.save(student);

                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "TOTP setup complete! You can now use your authenticator app for attendance.");
                response.put("totpEnabled", true);
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Invalid TOTP code. Please try again.");
                return ResponseEntity.badRequest().body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Admin endpoint to reset TOTP for a student
     */
    @PostMapping("/admin/reset/{idBadge}")
    public ResponseEntity<?> resetTotp(@PathVariable String idBadge) {
        try {
            Student student = studentRepository.findByIdBadge(idBadge)
                    .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

            student.setTotpSecret(null);
            student.setTotpEnabled(false);
            studentRepository.save(student);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "TOTP has been reset for student: " + student.getFullName());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    private ErrorResponse createErrorResponse(String message) {
        return new ErrorResponse() {
            @Override
            public HttpStatusCode getStatusCode() {
                return HttpStatusCode.valueOf(400);
            }

            @Override
            public ProblemDetail getBody() {
                return ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(400), message);
            }
        };
    }
}
