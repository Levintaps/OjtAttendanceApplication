package Attendance.OjtAttendanceApplication.dto;

import java.time.LocalDate;
import java.util.List;

public class ScheduleAnalyticsDto {
    private LocalDate date;
    private Integer totalStudentsWithSchedule;
    private Integer onTimeArrivals;
    private Integer lateArrivals;
    private Integer earlyArrivals;
    private Integer absentStudents;
    private Double averageLateMinutes;
    private List<LateArrivalDto> lateArrivalDetails;

    public ScheduleAnalyticsDto() {}

    // Getters and Setters
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public Integer getTotalStudentsWithSchedule() { return totalStudentsWithSchedule; }
    public void setTotalStudentsWithSchedule(Integer totalStudentsWithSchedule) { this.totalStudentsWithSchedule = totalStudentsWithSchedule; }

    public Integer getOnTimeArrivals() { return onTimeArrivals; }
    public void setOnTimeArrivals(Integer onTimeArrivals) { this.onTimeArrivals = onTimeArrivals; }

    public Integer getLateArrivals() { return lateArrivals; }
    public void setLateArrivals(Integer lateArrivals) { this.lateArrivals = lateArrivals; }

    public Integer getEarlyArrivals() { return earlyArrivals; }
    public void setEarlyArrivals(Integer earlyArrivals) { this.earlyArrivals = earlyArrivals; }

    public Integer getAbsentStudents() { return absentStudents; }
    public void setAbsentStudents(Integer absentStudents) { this.absentStudents = absentStudents; }

    public Double getAverageLateMinutes() { return averageLateMinutes; }
    public void setAverageLateMinutes(Double averageLateMinutes) { this.averageLateMinutes = averageLateMinutes; }

    public List<LateArrivalDto> getLateArrivalDetails() { return lateArrivalDetails; }
    public void setLateArrivalDetails(List<LateArrivalDto> lateArrivalDetails) { this.lateArrivalDetails = lateArrivalDetails; }
}
