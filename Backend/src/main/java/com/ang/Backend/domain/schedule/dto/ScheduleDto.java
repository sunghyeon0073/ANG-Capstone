package com.ang.Backend.domain.schedule.dto;

import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.schedule.entity.ScheduleType;
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

        private ScheduleType type = ScheduleType.PERSONAL;

        private String description;

        @NotNull
        private ScheduleType type;
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
        private ScheduleType type;
        private String description;
        private ScheduleType type;
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
                    .type(schedule.getType())
                    .description(schedule.getDescription())
                    .type(schedule.getType())
                    .createdAt(schedule.getCreatedAt())
                    .updatedAt(schedule.getUpdatedAt())
                    .build();
        }
    }

    @Getter
    @Builder
    public static class AiRecommendationResponse {
        private String id;
        private String type;
        private String title;
        private String message;
        private LocalDate recommendationDate;
        private LocalDate sourceStartDate;
        private LocalDate sourceEndDate;
        private LocalTime sourceStartTime;
        private LocalTime sourceEndTime;
        private Long sourceScheduleId;
        private String sourceTitle;
        @Builder.Default
        private java.util.List<AssociatedItem> associatedItems = new java.util.ArrayList<>();
    }

    @Getter
    @Builder
    public static class AssociatedItem {
        private String type; // MEMO, FILE
        private Long id;
        private String title;
        private String content; // Optional, can be null
    }
}
