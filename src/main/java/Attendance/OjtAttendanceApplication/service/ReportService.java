package Attendance.OjtAttendanceApplication.service;

import Attendance.OjtAttendanceApplication.dto.AttendanceRecordDto;
import Attendance.OjtAttendanceApplication.entity.Student;
import Attendance.OjtAttendanceApplication.repository.StudentRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ReportService {

    @Autowired
    private AttendanceService attendanceService;

    @Autowired
    private StudentRepository studentRepository;

    public String generateCSVReport(LocalDate startDate, LocalDate endDate) throws IOException {
        List<AttendanceRecordDto> records = attendanceService.getAttendanceRecordsByDateRange(startDate, endDate);

        StringWriter out = new StringWriter();
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader("ID Badge", "Student Name", "School", "Date", "Time In", "Time Out",
                        "Total Hours", "Regular Hours", "Overtime Hours", "Undertime Hours",
                        "Break Deducted", "Tasks Completed", "Status")
                .build();

        try (CSVPrinter printer = new CSVPrinter(out, format)) {
            for (AttendanceRecordDto record : records) {
                // Get student to access school information
                Student student = studentRepository.findByIdBadge(record.getIdBadge()).orElse(null);
                String school = student != null ? student.getSchool() : "";

                printer.printRecord(
                        record.getIdBadge(),
                        record.getStudentName(),
                        school,
                        record.getAttendanceDate(),
                        record.getTimeIn() != null ? record.getTimeIn().format(DateTimeFormatter.ofPattern("HH:mm:ss")) : "",
                        record.getTimeOut() != null ? record.getTimeOut().format(DateTimeFormatter.ofPattern("HH:mm:ss")) : "",
                        record.getTotalHours(),
                        record.getRegularHours(),
                        record.getOvertimeHours(),
                        record.getUndertimeHours(),
                        record.getBreakDeducted() ? "Yes" : "No",
                        record.getTasksCompleted() != null ? record.getTasksCompleted() : "",
                        record.getStatus()
                );
            }
        }

        return out.toString();
    }

    public byte[] generateExcelReport(LocalDate startDate, LocalDate endDate) throws IOException {
        List<AttendanceRecordDto> records = attendanceService.getAttendanceRecordsByDateRange(startDate, endDate);

        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("Attendance Report");

            // Create header row
            Row headerRow = sheet.createRow(0);
            String[] headers = {"ID Badge", "Student Name", "School", "Date", "Time In", "Time Out",
                    "Total Hours", "Regular Hours", "Overtime Hours", "Undertime Hours",
                    "Break Deducted", "Tasks Completed", "Status"};

            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);

                // Style header
                CellStyle headerStyle = workbook.createCellStyle();
                Font font = workbook.createFont();
                font.setBold(true);
                headerStyle.setFont(font);
                cell.setCellStyle(headerStyle);
            }

            // Fill data rows
            int rowNum = 1;
            for (AttendanceRecordDto record : records) {
                Row row = sheet.createRow(rowNum++);

                // Get student to access school information
                Student student = studentRepository.findByIdBadge(record.getIdBadge()).orElse(null);
                String school = student != null ? student.getSchool() : "";

                row.createCell(0).setCellValue(record.getIdBadge());
                row.createCell(1).setCellValue(record.getStudentName());
                row.createCell(2).setCellValue(school);
                row.createCell(3).setCellValue(record.getAttendanceDate().toString());
                row.createCell(4).setCellValue(record.getTimeIn() != null ?
                        record.getTimeIn().format(DateTimeFormatter.ofPattern("HH:mm:ss")) : "");
                row.createCell(5).setCellValue(record.getTimeOut() != null ?
                        record.getTimeOut().format(DateTimeFormatter.ofPattern("HH:mm:ss")) : "");
                row.createCell(6).setCellValue(record.getTotalHours());
                row.createCell(7).setCellValue(record.getRegularHours());
                row.createCell(8).setCellValue(record.getOvertimeHours());
                row.createCell(9).setCellValue(record.getUndertimeHours());
                row.createCell(10).setCellValue(record.getBreakDeducted() ? "Yes" : "No");
                row.createCell(11).setCellValue(record.getTasksCompleted() != null ? record.getTasksCompleted() : "");
                row.createCell(12).setCellValue(record.getStatus());
            }

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    public String generateStudentCSVReport(String idBadge, LocalDate startDate, LocalDate endDate) throws IOException {
        Student student = studentRepository.findByIdBadge(idBadge)
                .orElseThrow(() -> new RuntimeException("Student not found with ID badge: " + idBadge));

        List<AttendanceRecordDto> records = attendanceService.getAttendanceRecordsByDateRange(startDate, endDate)
                .stream()
                .filter(record -> record.getIdBadge().equals(idBadge))
                .toList();

        StringWriter out = new StringWriter();
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader("Student Name", "School", "Date", "Time In", "Time Out", "Total Hours", "Regular Hours",
                        "Overtime Hours", "Undertime Hours", "Break Deducted", "Tasks Completed", "Status")
                .build();

        try (CSVPrinter printer = new CSVPrinter(out, format)) {
            for (AttendanceRecordDto record : records) {
                printer.printRecord(
                        record.getStudentName(),
                        student.getSchool(),
                        record.getAttendanceDate(),
                        record.getTimeIn() != null ? record.getTimeIn().format(DateTimeFormatter.ofPattern("HH:mm:ss")) : "",
                        record.getTimeOut() != null ? record.getTimeOut().format(DateTimeFormatter.ofPattern("HH:mm:ss")) : "",
                        record.getTotalHours(),
                        record.getRegularHours(),
                        record.getOvertimeHours(),
                        record.getUndertimeHours(),
                        record.getBreakDeducted() ? "Yes" : "No",
                        record.getTasksCompleted() != null ? record.getTasksCompleted() : "",
                        record.getStatus()
                );
            }
        }

        return out.toString();
    }
}