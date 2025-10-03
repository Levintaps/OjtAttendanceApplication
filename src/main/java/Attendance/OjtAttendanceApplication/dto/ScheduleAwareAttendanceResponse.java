package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalTime;

public class ScheduleAwareAttendanceResponse extends AttendanceResponse {
    private String scheduleStatus;
    private LocalTime expectedEndTime;
    private Integer lateMinutes;
    private Boolean withinGracePeriod;

    public ScheduleAwareAttendanceResponse() {
        super();
    }

    public String getScheduleStatus() { return scheduleStatus; }
    public void setScheduleStatus(String scheduleStatus) { this.scheduleStatus = scheduleStatus; }

    public LocalTime getExpectedEndTime() { return expectedEndTime; }
    public void setExpectedEndTime(LocalTime expectedEndTime) { this.expectedEndTime = expectedEndTime; }

    public Integer getLateMinutes() { return lateMinutes; }
    public void setLateMinutes(Integer lateMinutes) { this.lateMinutes = lateMinutes; }

    public Boolean getWithinGracePeriod() { return withinGracePeriod; }
    public void setWithinGracePeriod(Boolean withinGracePeriod) { this.withinGracePeriod = withinGracePeriod; }
}
