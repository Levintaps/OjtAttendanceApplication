package Attendance.OjtAttendanceApplication;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import jakarta.annotation.PostConstruct;

@SpringBootApplication
public class  OjtAttendanceApplication {

	public static void main(String[] args) {
		SpringApplication.run(OjtAttendanceApplication.class, args);
	}

}
