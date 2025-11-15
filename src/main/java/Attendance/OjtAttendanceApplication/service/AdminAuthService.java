package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.entity.AdminCredentials;
import Attendance.OjtAttendanceApplication.repository.AdminCredentialsRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

@Service
@Transactional
public class AdminAuthService {

    @Autowired
    private AdminCredentialsRepository adminCredentialsRepository;

    private static final String DEFAULT_PASSWORD = "Happy@Concentrix@2025!";

    /**
     * Initialize default admin credentials if not exists
     */
    @PostConstruct
    public void initializeDefaultAdmin() {
        Optional<AdminCredentials> existingAdmin = adminCredentialsRepository.findByUsername("admin");

        if (existingAdmin.isEmpty()) {
            String hashedPassword = hashPassword(DEFAULT_PASSWORD);
            AdminCredentials admin = new AdminCredentials(hashedPassword);
            adminCredentialsRepository.save(admin);
            System.out.println("✅ Default admin credentials initialized");
        }
    }

    /**
     * Verify admin login credentials
     */
    public boolean verifyLogin(String username, String password) {
        Optional<AdminCredentials> adminOpt = adminCredentialsRepository.findByUsername(username);

        if (adminOpt.isEmpty()) {
            return false;
        }

        AdminCredentials admin = adminOpt.get();
        String hashedInput = hashPassword(password);

        return hashedInput.equals(admin.getPasswordHash());
    }

    /**
     * Change admin password
     */
    public boolean changePassword(String username, String currentPassword, String newPassword) {
        // Verify current password first
        if (!verifyLogin(username, currentPassword)) {
            throw new RuntimeException("Current password is incorrect");
        }

        // Validate new password
        if (newPassword == null || newPassword.length() < 8) {
            throw new RuntimeException("New password must be at least 8 characters long");
        }

        Optional<AdminCredentials> adminOpt = adminCredentialsRepository.findByUsername(username);

        if (adminOpt.isEmpty()) {
            throw new RuntimeException("Admin user not found");
        }

        AdminCredentials admin = adminOpt.get();
        admin.setPasswordHash(hashPassword(newPassword));
        admin.setLastChanged(LocalDateTime.now());

        adminCredentialsRepository.save(admin);
        return true;
    }

    /**
     * Reset admin password (for emergency/admin use only)
     */
    public boolean resetPassword(String username, String newPassword) {
        Optional<AdminCredentials> adminOpt = adminCredentialsRepository.findByUsername(username);

        if (adminOpt.isEmpty()) {
            throw new RuntimeException("Admin user not found");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new RuntimeException("New password must be at least 8 characters long");
        }

        AdminCredentials admin = adminOpt.get();
        admin.setPasswordHash(hashPassword(newPassword));
        admin.setLastChanged(LocalDateTime.now());

        adminCredentialsRepository.save(admin);
        return true;
    }

    /**
     * Get password last changed date
     */
    public LocalDateTime getPasswordLastChanged(String username) {
        Optional<AdminCredentials> adminOpt = adminCredentialsRepository.findByUsername(username);
        return adminOpt.map(AdminCredentials::getLastChanged).orElse(null);
    }

    /**
     * Hash password using SHA-256
     */
    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Failed to hash password", e);
        }
    }

    /**
     * Generate secure random password
     */
    public String generateSecurePassword() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
        SecureRandom random = new SecureRandom();
        StringBuilder password = new StringBuilder();

        for (int i = 0; i < 16; i++) {
            password.append(chars.charAt(random.nextInt(chars.length())));
        }

        return password.toString();
    }

    public void resetToDefaultPassword(String username) {
        Optional<AdminCredentials> adminOpt = adminCredentialsRepository.findByUsername(username);

        if (adminOpt.isEmpty()) {
            throw new RuntimeException("Admin user not found");
        }

        AdminCredentials admin = adminOpt.get();
        admin.setPasswordHash(hashPassword(DEFAULT_PASSWORD));
        admin.setLastChanged(LocalDateTime.now());

        adminCredentialsRepository.save(admin);
    }
}