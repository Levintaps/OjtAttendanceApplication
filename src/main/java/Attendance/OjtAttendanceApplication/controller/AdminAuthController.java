package Attendance.OjtAttendanceApplication.controller;

import Attendance.OjtAttendanceApplication.service.AdminAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/auth")
@CrossOrigin(origins = "*")
public class AdminAuthController {

    @Autowired
    private AdminAuthService adminAuthService;

    /**
     * Admin login verification
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        try {
            String username = credentials.get("username");
            String password = credentials.get("password");

            if (username == null || password == null) {
                throw new RuntimeException("Username and password are required");
            }

            boolean isValid = adminAuthService.verifyLogin(username, password);

            if (isValid) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "Login successful");
                response.put("username", username);
                return ResponseEntity.ok(response);
            } else {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Invalid username or password");
                return ResponseEntity.status(401).body(response);
            }

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Change admin password
     */
    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String currentPassword = request.get("currentPassword");
            String newPassword = request.get("newPassword");

            if (username == null || currentPassword == null || newPassword == null) {
                throw new RuntimeException("All fields are required");
            }

            adminAuthService.changePassword(username, currentPassword, newPassword);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Password changed successfully");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Get password info (last changed date)
     */
    @GetMapping("/password-info/{username}")
    public ResponseEntity<?> getPasswordInfo(@PathVariable String username) {
        try {
            LocalDateTime lastChanged = adminAuthService.getPasswordLastChanged(username);

            Map<String, Object> response = new HashMap<>();
            response.put("username", username);
            response.put("lastChanged", lastChanged);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(createErrorResponse(e.getMessage()));
        }
    }

    /**
     * Generate secure password suggestion
     */
    @GetMapping("/generate-password")
    public ResponseEntity<?> generatePassword() {
        try {
            String password = adminAuthService.generateSecurePassword();

            Map<String, Object> response = new HashMap<>();
            response.put("password", password);
            response.put("message", "Secure password generated. Please save it securely.");
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