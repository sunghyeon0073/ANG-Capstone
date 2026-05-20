package com.ang.Backend.domain.schedule.dto;

import com.ang.Backend.domain.schedule.entity.Schedule;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public class ScheduleDto {

    @Getter
    @Setter
    @NoArgsConstructor
    public static class SaveRequest {
        @NotNull
        private LocalDate startDate;

        @NotNull
        private LocalDate endDate;

        @NotBlank
        private String title;

        @NotNull
        private LocalTime startTime;

        @NotNull
        private LocalTime endTime;

        private String description;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private LocalDate startDate;
        private LocalDate endDate;
        private String title;
        private LocalTime startTime;
        private LocalTime endTime;
        private String description;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public static Response from(Schedule schedule) {
            return Response.builder()
                    .id(schedule.getScheduleId())
                    .startDate(schedule.getStartDate())
                    .endDate(schedule.getEndDate())
                    .title(schedule.getTitle())
                    .startTime(schedule.getStartTime())
                    .endTime(schedule.getEndTime())
                    .description(schedule.getDescription())
                    .createdAt(schedule.getCreatedAt())
                    .updatedAt(schedule.getUpdatedAt())
                    .build();
        }
    }
}
