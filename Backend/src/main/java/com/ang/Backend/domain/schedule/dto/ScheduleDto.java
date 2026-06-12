package com.ang.Backend.domain.schedule.dto;

import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.schedule.entity.ScheduleType;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public class ScheduleDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
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

        @NotNull
        private ScheduleType type;

        private boolean isTodo;
        
        @JsonProperty("isTodo")
        public boolean isTodo() {
            return isTodo;
        }

        @JsonProperty("isTodo")
        public void setTodo(boolean isTodo) {
            this.isTodo = isTodo;
        }
        
        @Builder.Default
        private String repeatType = "NONE"; // NONE, DAILY, WEEKLY, MONTHLY, YEARLY
        
        private LocalDate repeatEndDate;
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
        private ScheduleType type;

        @JsonProperty("isTodo")
        private boolean isTodo;

        @JsonProperty("isCompleted")
        private boolean isCompleted;

        private Long parentScheduleId;
        private String repeatType;
        private LocalDate repeatEndDate;
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
                    .isTodo(schedule.isTodo())
                    .isCompleted(schedule.isCompleted())
                    .parentScheduleId(schedule.getParentScheduleId())
                    .repeatType(schedule.getRepeatType())
                    .repeatEndDate(schedule.getRepeatEndDate())
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
