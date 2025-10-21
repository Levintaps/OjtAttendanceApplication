package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.entity.AttendanceRecord;
import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.entity.TaskEntry;
import Attendance.OjtAttendanceApplication.repository.AttendanceRecordRepository;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import Attendance.OjtAttendanceApplication.repository.TaskEntryRepository;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.io.source.ByteArrayOutputStream;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WeeklyReportService {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private AttendanceRecordRepository attendanceRecordRepository;

    @Autowired
    private TaskEntryRepository taskEntryRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a");

    /**
     * Generate weekly report for specific week number (CALENDAR WEEKS: Monday-Sunday)
     */
    public byte[] generateWeeklyReportByWeekNumber(String idBadge, Integer weekNumber) {
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Get OJT start date
        LocalDate ojtStartDate = student.getEffectiveStartDate();

        // Calculate the Monday of the week containing the OJT start date
        LocalDate firstMonday = ojtStartDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // Calculate the target week's Monday and Sunday
        LocalDate weekStartDate = firstMonday.plusWeeks(weekNumber - 1);
        LocalDate weekEndDate = weekStartDate.plusDays(6); // Sunday

        // Check if week is in the future
        LocalDate today = LocalDate.now();
        if (weekStartDate.isAfter(today)) {
            throw new RuntimeException("Week " + weekNumber + " is not available yet");
        }

        return generateWeeklyReportPDF(idBadge, weekStartDate, weekEndDate, weekNumber);
    }

    /**
     * Generate weekly report PDF with custom date range
     */
    public byte[] generateWeeklyReportPDF(String idBadge, LocalDate startDate, LocalDate endDate) {
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Calculate week number based on OJT start date and calendar weeks
        Integer weekNumber = calculateCalendarWeekNumber(student.getEffectiveStartDate(), startDate);

        return generateWeeklyReportPDF(idBadge, startDate, endDate, weekNumber);
    }

    /**
     * Calculate week number based on calendar weeks (Monday-Sunday)
     *
     * Example: If student starts on Wednesday Oct 16:
     * - Week 1: Monday Oct 14 - Sunday Oct 20 (student joined Wed)
     * - Week 2: Monday Oct 21 - Sunday Oct 27
     * - Week 3: Monday Oct 28 - Sunday Nov 3
     */
    private Integer calculateCalendarWeekNumber(LocalDate ojtStartDate, LocalDate targetDate) {
        // Get the Monday of the week containing OJT start date
        LocalDate firstMonday = ojtStartDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // Get the Monday of the target week
        LocalDate targetMonday = targetDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // Calculate weeks between
        long weeksBetween = ChronoUnit.WEEKS.between(firstMonday, targetMonday);

        return (int) weeksBetween + 1;
    }

    /**
     * Calculate total available calendar weeks for a student
     */
    public Integer calculateTotalAvailableWeeks(LocalDate ojtStartDate) {
        LocalDate today = LocalDate.now();

        // Get Monday of OJT start week
        LocalDate firstMonday = ojtStartDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // Get Monday of current week
        LocalDate currentMonday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // Calculate weeks between
        long weeksBetween = ChronoUnit.WEEKS.between(firstMonday, currentMonday);

        return (int) weeksBetween + 1;
    }

    /**
     * Get date range for a specific week number
     */
    public Map<String, LocalDate> getWeekDateRange(LocalDate ojtStartDate, Integer weekNumber) {
        // Get Monday of first week
        LocalDate firstMonday = ojtStartDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // Calculate target week
        LocalDate weekStart = firstMonday.plusWeeks(weekNumber - 1);
        LocalDate weekEnd = weekStart.plusDays(6);

        Map<String, LocalDate> range = new HashMap<>();
        range.put("start", weekStart);
        range.put("end", weekEnd);
        range.put("firstMonday", firstMonday);

        return range;
    }

    /**
     * Main PDF generation method
     */
    private byte[] generateWeeklyReportPDF(String idBadge, LocalDate startDate, LocalDate endDate, Integer weekNumber) {
        // Get student
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Get attendance records for the week (only days with attendance)
        List<AttendanceRecord> records = attendanceRecordRepository
                .findByStudentAndDateRange(student, startDate, endDate);

        // Sort records by date (earliest first)
        records.sort(Comparator.comparing(AttendanceRecord::getAttendanceDate));

        // Group records by date and combine if multiple sessions per day
        Map<LocalDate, List<AttendanceRecord>> recordsByDate = records.stream()
                .collect(Collectors.groupingBy(AttendanceRecord::getAttendanceDate));

        // Calculate WEEKLY TOTAL (this week only)
        double weeklyTotal = records.stream()
                .mapToDouble(r -> r.getTotalHours() != null ? r.getTotalHours() : 0.0)
                .sum();

        // Calculate CUMULATIVE TOTAL up to and including this week
        LocalDate ojtStartDate = student.getEffectiveStartDate();
        LocalDate firstMonday = ojtStartDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate cumulativeEndDate = endDate; // End of current week

        List<AttendanceRecord> cumulativeRecords = attendanceRecordRepository
                .findByStudentAndDateRange(student, firstMonday, cumulativeEndDate);

        double totalCompletedUpToThisWeek = cumulativeRecords.stream()
                .mapToDouble(r -> r.getTotalHours() != null ? r.getTotalHours() : 0.0)
                .sum();

        // Calculate HOURS REMAINING based on cumulative total
        double hoursRemaining = student.getRequiredHours() != null
                ? Math.max(0, student.getRequiredHours() - totalCompletedUpToThisWeek)
                : 0;

        // Generate PDF
        return createPDF(student, recordsByDate, weeklyTotal, totalCompletedUpToThisWeek, hoursRemaining, startDate, endDate, weekNumber);
    }

    /**
     * Create the PDF document
     */
    private byte[] createPDF(Student student, Map<LocalDate, List<AttendanceRecord>> recordsByDate,
                             double weeklyTotal, double totalCompleted, double hoursRemaining,
                             LocalDate startDate, LocalDate endDate, Integer weekNumber) {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        try (PdfWriter writer = new PdfWriter(baos);
             PdfDocument pdf = new PdfDocument(writer);
             Document document = new Document(pdf)) {

            // Set document properties
            pdf.setDefaultPageSize(PageSize.LETTER);
            document.setMargins(36, 36, 36, 36);

            // Add logo
            addLogo(document);

            // Title
            Paragraph title = new Paragraph("WEEKLY REPORT SHEET")
                    .setTextAlignment(TextAlignment.CENTER)
                    .setFontSize(12)
                    .setBold()
                    .setMarginBottom(10);
            document.add(title);

            // Student Information
            document.add(new Paragraph("Name of Student: " + student.getFullName())
                    .setFontSize(11)
                    .setMarginBottom(3));

            document.add(new Paragraph("Department Assigned: IT")
                    .setFontSize(11)
                    .setMarginBottom(15));

            // Week number section
            Table weekTable = new Table(1);
            weekTable.setWidth(UnitValue.createPercentValue(100));
            Cell weekCell = new Cell()
                    .add(new Paragraph("Week No. " + weekNumber).setBold())
                    .setTextAlignment(TextAlignment.CENTER)
                    .setPadding(8)
                    .setBorder(new com.itextpdf.layout.borders.SolidBorder(1));
            weekTable.addCell(weekCell);
            document.add(weekTable);

            // Create attendance table
            Table table = new Table(new float[]{2, 2, 2, 1.5f, 5});
            table.setWidth(UnitValue.createPercentValue(100));
            table.setMarginTop(5);

            // Table headers
            addTableHeader(table, "Date");
            addTableHeader(table, "Time in");
            addTableHeader(table, "Time out");
            addTableHeader(table, "No. of\nHours");
            addTableHeader(table, "Task/Learning");

            // Add records (only days with attendance)
            List<LocalDate> sortedDates = new ArrayList<>(recordsByDate.keySet());
            sortedDates.sort(Comparator.naturalOrder());

            for (LocalDate date : sortedDates) {
                List<AttendanceRecord> dayRecords = recordsByDate.get(date);
                addDayRecords(table, date, dayRecords);
            }

            document.add(table);

            // Summary section with CUMULATIVE calculations
            document.add(new Paragraph("\n"));

            // Weekly Total: Hours worked THIS WEEK ONLY
            Paragraph weeklyTotalPara = new Paragraph("Weekly Total: " + String.format("%.0f hours", weeklyTotal))
                    .setFontSize(11)
                    .setBold()
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setMarginTop(10);
            document.add(weeklyTotalPara);

            // Total Hours Completed: CUMULATIVE from Week 1 to THIS WEEK
            Paragraph totalCompletedPara = new Paragraph("Total Hours Completed: " + String.format("%.0f hours", totalCompleted))
                    .setFontSize(11)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setMarginTop(3);
            document.add(totalCompletedPara);

            // Hours Remaining: Required Hours - Cumulative Total
            Paragraph hoursRemainingPara = new Paragraph("Hours Remaining: " + String.format("%.0f hours", hoursRemaining))
                    .setFontSize(11)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .setMarginTop(3);
            document.add(hoursRemainingPara);

            // Signature section
            document.add(new Paragraph("\n\n"));
            document.add(new Paragraph("Reviewed by:")
                    .setFontSize(11)
                    .setMarginTop(30));

            document.add(new Paragraph("__________________________")
                    .setMarginTop(20));

            document.add(new Paragraph("Mike Cercado")
                    .setBold()
                    .setFontSize(11));

            document.add(new Paragraph("Supervisor")
                    .setFontSize(10));

            document.add(new Paragraph("IT Operations")
                    .setFontSize(10));

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PDF: " + e.getMessage(), e);
        }

        return baos.toByteArray();
    }

    /**
     * Add logo to document
     */
    private void addLogo(Document document) {
        try {
            ClassPathResource imgFile = new ClassPathResource("static/images/concentrix-logo.png");

            // Check if resource exists
            if (!imgFile.exists()) {
                System.err.println("Logo file not found at: static/images/concentrix-logo.png");
                addTextLogo(document);
                return;
            }

            InputStream inputStream = imgFile.getInputStream();
            byte[] imageBytes = inputStream.readAllBytes();
            inputStream.close();

            // Create image from bytes
            Image logo = new Image(ImageDataFactory.create(imageBytes));
            logo.setWidth(200);
            logo.setAutoScale(true);
            logo.setHorizontalAlignment(HorizontalAlignment.CENTER);
            logo.setMarginBottom(15);

            document.add(logo);

        } catch (IOException e) {
            // File not found or read error
            System.err.println("Failed to load logo image: " + e.getMessage());
            addTextLogo(document);
        } catch (Exception e) {
            // Any other error (corrupt image, unsupported format, etc.)
            System.err.println("Failed to process logo image: " + e.getMessage());
            e.printStackTrace();
            addTextLogo(document);
        }
    }

    /**
     * Add text-based logo as fallback
     */
    private void addTextLogo(Document document) {
        document.add(new Paragraph("CONCENTRIX")
                .setTextAlignment(TextAlignment.CENTER)
                .setFontSize(40)
                .setBold()
                .setFontColor(new DeviceRgb(0, 51, 153))
                .setMarginBottom(5));
    }

    private void addTableHeader(Table table, String header) {
        Cell cell = new Cell()
                .add(new Paragraph(header).setBold().setFontSize(10))
                .setBackgroundColor(new DeviceRgb(230, 230, 230))
                .setTextAlignment(TextAlignment.CENTER)
                .setPadding(5);
        table.addHeaderCell(cell);
    }

    private void addDayRecords(Table table, LocalDate date, List<AttendanceRecord> dayRecords) {
        LocalDateTime firstTimeIn = dayRecords.stream()
                .map(AttendanceRecord::getTimeIn)
                .min(Comparator.naturalOrder())
                .orElse(null);

        LocalDateTime lastTimeOut = dayRecords.stream()
                .map(AttendanceRecord::getTimeOut)
                .filter(Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);

        double totalHours = dayRecords.stream()
                .mapToDouble(r -> r.getTotalHours() != null ? r.getTotalHours() : 0.0)
                .sum();

        List<TaskEntry> allTasks = new ArrayList<>();
        for (AttendanceRecord record : dayRecords) {
            List<TaskEntry> tasks = taskEntryRepository.findByAttendanceRecordOrderByCompletedAtAsc(record);
            allTasks.addAll(tasks);
        }

        allTasks.sort(Comparator.comparing(TaskEntry::getCompletedAt));

        table.addCell(new Cell().add(new Paragraph(formatDate(date))).setFontSize(9).setPadding(5));
        table.addCell(new Cell().add(new Paragraph(formatTime(firstTimeIn))).setFontSize(9).setPadding(5));
        table.addCell(new Cell().add(new Paragraph(formatTime(lastTimeOut))).setFontSize(9).setPadding(5));
        table.addCell(new Cell().add(new Paragraph(String.format("%.0f", totalHours))).setFontSize(9).setPadding(5).setTextAlignment(TextAlignment.CENTER));

        String tasksFormatted = formatTasksWithBullets(allTasks, dayRecords);
        table.addCell(new Cell().add(new Paragraph(tasksFormatted)).setFontSize(8).setPadding(5));
    }

    private String formatTasksWithBullets(List<TaskEntry> tasks, List<AttendanceRecord> records) {
        if (tasks.isEmpty()) {
            String legacyTasks = records.stream()
                    .map(AttendanceRecord::getTasksCompleted)
                    .filter(Objects::nonNull)
                    .filter(t -> !t.trim().isEmpty())
                    .collect(Collectors.joining("\n"));

            if (legacyTasks.isEmpty()) {
                return "• No tasks recorded";
            }

            String[] lines = legacyTasks.split("\n");
            StringBuilder formatted = new StringBuilder();
            for (String line : lines) {
                if (!line.trim().isEmpty() && !line.startsWith("•")) {
                    formatted.append("• ").append(line.trim()).append("\n");
                } else if (!line.trim().isEmpty()) {
                    formatted.append(line.trim()).append("\n");
                }
            }
            return formatted.toString().trim();
        }

        StringBuilder formatted = new StringBuilder();
        for (TaskEntry task : tasks) {
            formatted.append("• ").append(task.getTaskDescription().trim()).append("\n");
        }
        return formatted.toString().trim();
    }

    private String formatDate(LocalDate date) {
        return date.format(DATE_FORMATTER);
    }

    private String formatTime(LocalDateTime dateTime) {
        if (dateTime == null) return "-";
        return dateTime.format(TIME_FORMATTER);
    }
}