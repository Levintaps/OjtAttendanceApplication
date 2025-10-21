package Attendance.OjtAttendanceApplication.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "admin_credentials")
public class AdminCredentials {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", unique = true, nullable = false)
    private String username = "admin";

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "last_changed")
    private LocalDateTime lastChanged;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Constructors
    public AdminCredentials() {
        this.createdAt = LocalDateTime.now();
        this.lastChanged = LocalDateTime.now();
    }

    public AdminCredentials(String passwordHash) {
        this();
        this.passwordHash = passwordHash;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public LocalDateTime getLastChanged() { return lastChanged; }
    public void setLastChanged(LocalDateTime lastChanged) { this.lastChanged = lastChanged; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}