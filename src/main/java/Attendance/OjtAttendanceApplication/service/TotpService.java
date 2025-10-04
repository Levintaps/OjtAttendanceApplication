package Attendance.OjtAttendanceApplication.service;

import dev.samstevens.totp.code.*;
import dev.samstevens.totp.exceptions.QrGenerationException;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import org.springframework.stereotype.Service;

import java.util.Base64;

@Service
public class TotpService {

    private final TimeProvider timeProvider = new SystemTimeProvider();
    private final CodeGenerator codeGenerator = new DefaultCodeGenerator();
    private final CodeVerifier verifier = new DefaultCodeVerifier(codeGenerator, timeProvider);
    private final QrGenerator qrGenerator = new ZxingPngQrGenerator();

    /**
     * Generate a new secret key for a student
     */
    public String generateSecret() {
        DefaultSecretGenerator secretGenerator = new DefaultSecretGenerator();
        return secretGenerator.generate();
    }

    /**
     * Generate QR code data URL for Google Authenticator
     * @param secret The TOTP secret
     * @param studentName The student's name for display in authenticator
     * @param idBadge The student's ID badge
     * @return Base64 encoded QR code image as data URL
     */
    public String generateQrCodeDataUrl(String secret, String studentName, String idBadge) {
        try {
            QrData data = new QrData.Builder()
                    .label(studentName + " (" + idBadge + ")")
                    .secret(secret)
                    .issuer("OJT Attendance System")
                    .algorithm(HashingAlgorithm.SHA1)
                    .digits(6)
                    .period(30)
                    .build();

            byte[] imageData = qrGenerator.generate(data);
            String base64Image = Base64.getEncoder().encodeToString(imageData);
            return "data:image/png;base64," + base64Image;

        } catch (QrGenerationException e) {
            throw new RuntimeException("Failed to generate QR code: " + e.getMessage(), e);
        }
    }

    /**
     * Verify a TOTP code against a secret
     * @param secret The student's TOTP secret
     * @param code The 6-digit code entered by the student
     * @return true if valid, false otherwise
     */
    public boolean verifyCode(String secret, String code) {
        if (secret == null || code == null) {
            return false;
        }

        // Remove any whitespace from the code
        code = code.trim();

        // Validate code format
        if (!code.matches("\\d{6}")) {
            return false;
        }

        return verifier.isValidCode(secret, code);
    }

    /**
     * Generate current TOTP code (for testing/debugging only)
     * In production, students should use their authenticator app
     */
    public String getCurrentCode(String secret) {
        try {
            long currentBucket = Math.floorDiv(timeProvider.getTime(), 15);
            return codeGenerator.generate(secret, currentBucket);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate code: " + e.getMessage(), e);
        }
    }
}
