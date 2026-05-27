package com.ang.Backend.domain.schedule.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.schedule.dto.ScheduleDto;
import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.schedule.repository.ScheduleRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;

    public List<ScheduleDto.Response> getSchedules(User owner, LocalDate startDate, LocalDate endDate) {
        List<Schedule> schedules;
        if (startDate != null && endDate != null) {
            schedules = scheduleRepository.findByOwnerAndDateRangeOverlap(owner, startDate, endDate);
        } else {
            schedules = scheduleRepository.findByOwnerOrderByStartDateAscStartTimeAsc(owner);
        }

        return schedules.stream()
                .map(ScheduleDto.Response::from)
                .toList();
    }

    public List<ScheduleDto.AiRecommendationResponse> getAiRecommendations(User owner, LocalDate startDate, LocalDate endDate) {
        LocalDate rangeStart = startDate != null ? startDate : LocalDate.now().minusDays(7);
        LocalDate rangeEnd = endDate != null ? endDate : LocalDate.now().plusDays(30);

        List<ScheduleDto.AiRecommendationResponse> recommendations = new ArrayList<>();
        recommendations.addAll(buildUpcomingReminders(owner, rangeStart, rangeEnd));
        recommendations.addAll(buildLastYearRecommendations(owner, rangeStart, rangeEnd));

        return recommendations.stream()
                .sorted(Comparator
                        .comparing(ScheduleDto.AiRecommendationResponse::getRecommendationDate)
                        .thenComparing(item -> item.getSourceStartTime() != null ? item.getSourceStartTime() : java.time.LocalTime.MIN)
                        .thenComparing(ScheduleDto.AiRecommendationResponse::getTitle))
                .toList();
    }

    private List<ScheduleDto.AiRecommendationResponse> buildUpcomingReminders(User owner, LocalDate rangeStart, LocalDate rangeEnd) {
        LocalDate sourceStart = rangeStart.plusDays(2);
        LocalDate sourceEnd = rangeEnd.plusDays(2);

        return scheduleRepository.findByOwnerAndStartDateBetweenOrderByStartDateAscStartTimeAsc(owner, sourceStart, sourceEnd)
                .stream()
                .map(schedule -> {
                    LocalDate reminderDate = schedule.getStartDate().minusDays(2);
                    long daysLeft = ChronoUnit.DAYS.between(reminderDate, schedule.getStartDate());
                    String message = "곧 " + schedule.getTitle() + " 일정이 다가와요!";
                    if (daysLeft == 2) {
                        message = "이틀 뒤 " + schedule.getTitle() + " 일정이 다가와요!";
                    }

                    return ScheduleDto.AiRecommendationResponse.builder()
                            .id("reminder-" + schedule.getScheduleId())
                            .type("upcoming")
                            .title("AI 알림")
                            .message(message)
                            .recommendationDate(reminderDate)
                            .sourceStartDate(schedule.getStartDate())
                            .sourceEndDate(schedule.getEndDate())
                            .sourceStartTime(schedule.getStartTime())
                            .sourceEndTime(schedule.getEndTime())
                            .sourceScheduleId(schedule.getScheduleId())
                            .sourceTitle(schedule.getTitle())
                            .build();
                })
                .toList();
    }

    private List<ScheduleDto.AiRecommendationResponse> buildLastYearRecommendations(User owner, LocalDate rangeStart, LocalDate rangeEnd) {
        LocalDate sourceStart = rangeStart.minusYears(1);
        LocalDate sourceEnd = rangeEnd.minusYears(1);

        return scheduleRepository.findByOwnerAndStartDateBetweenOrderByStartDateAscStartTimeAsc(owner, sourceStart, sourceEnd)
                .stream()
                .map(schedule -> {
                    LocalDate recommendationDate = schedule.getStartDate().plusYears(1);
                    return ScheduleDto.AiRecommendationResponse.builder()
                            .id("history-" + schedule.getScheduleId() + "-" + recommendationDate)
                            .type("last-year")
                            .title("AI 작년 기록")
                            .message("작년 이날에는 " + schedule.getTitle() + " 일정을 진행했었어요.")
                            .recommendationDate(recommendationDate)
                            .sourceStartDate(schedule.getStartDate())
                            .sourceEndDate(schedule.getEndDate())
                            .sourceStartTime(schedule.getStartTime())
                            .sourceEndTime(schedule.getEndTime())
                            .sourceScheduleId(schedule.getScheduleId())
                            .sourceTitle(schedule.getTitle())
                            .build();
                })
                .toList();
    }

    @Transactional
    public ScheduleDto.Response create(ScheduleDto.SaveRequest request, User owner) {
        Schedule schedule = Schedule.builder()
                .owner(owner)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .title(request.getTitle().trim())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .description(normalizeDescription(request.getDescription()))
                .build();

        return ScheduleDto.Response.from(scheduleRepository.save(schedule));
    }

    @Transactional
    public ScheduleDto.Response update(Long scheduleId, ScheduleDto.SaveRequest request, User owner) {
        Schedule schedule = getOwnedSchedule(scheduleId, owner);
        schedule.update(
                request.getStartDate(),
                request.getEndDate(),
                request.getTitle().trim(),
                request.getStartTime(),
                request.getEndTime(),
                normalizeDescription(request.getDescription())
        );
        return ScheduleDto.Response.from(schedule);
    }

    @Transactional
    public void delete(Long scheduleId, User owner) {
        Schedule schedule = getOwnedSchedule(scheduleId, owner);
        scheduleRepository.delete(schedule);
    }

    private Schedule getOwnedSchedule(Long scheduleId, User owner) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCHEDULE_NOT_FOUND));

        if (!schedule.getOwner().getUserId().equals(owner.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        return schedule;
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        return description.trim();
    }
}
