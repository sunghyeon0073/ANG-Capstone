package org.example.capstoneBack.domain.schedule.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.domain.schedule.entity.Schedule;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class ScheduleDto {

    private Long scheduleId;
    private Long userId;
    private Long scopeId;
    private String title;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime createdAt;
    private boolean isShared;

    public static ScheduleDto from(Schedule schedule) {
        return ScheduleDto.builder()
                .scheduleId(schedule.getScheduleId())
                .userId(schedule.getUser().getUserId())
                .scopeId(schedule.getScope() != null ? schedule.getScope().getScopeId() : null)
                .title(schedule.getTitle())
                .startTime(schedule.getStartTime())
                .endTime(schedule.getEndTime())
                .createdAt(schedule.getCreatedAt())
                .isShared(schedule.getScope() != null)
                .build();
    }
}
