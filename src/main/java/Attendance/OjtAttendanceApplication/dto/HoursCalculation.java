package Attendance.OjtAttendanceApplication.dto;

public class HoursCalculation {
    private Double totalHours;
    private Double regularHours;
    private Double overtimeHours;
    private Double undertimeHours;
    private boolean breakDeducted;

    public HoursCalculation() {}

    // Getters and Setters
    public Double getTotalHours() { return totalHours; }
    public void setTotalHours(Double totalHours) { this.totalHours = totalHours; }
    public Double getRegularHours() { return regularHours; }
    public void setRegularHours(Double regularHours) { this.regularHours = regularHours; }
    public Double getOvertimeHours() { return overtimeHours; }
    public void setOvertimeHours(Double overtimeHours) { this.overtimeHours = overtimeHours; }
    public Double getUndertimeHours() { return undertimeHours; }
    public void setUndertimeHours(Double undertimeHours) { this.undertimeHours = undertimeHours; }
    public boolean isBreakDeducted() { return breakDeducted; }
    public void setBreakDeducted(boolean breakDeducted) { this.breakDeducted = breakDeducted; }
}
