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
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;

    public List<ScheduleDto.Response> getSchedules(User owner, LocalDate startDate, LocalDate endDate) {
        List<Schedule> schedules;
        if (startDate != null && endDate != null) {
            schedules = scheduleRepository.findByOwnerAndScheduleDateBetweenOrderByScheduleDateAscStartTimeAsc(
                    owner,
                    startDate,
                    endDate
            );
        } else {
            schedules = scheduleRepository.findByOwnerOrderByScheduleDateAscStartTimeAsc(owner);
        }

        return schedules.stream()
                .map(ScheduleDto.Response::from)
                .toList();
    }

    @Transactional
    public ScheduleDto.Response create(ScheduleDto.SaveRequest request, User owner) {
        Schedule schedule = Schedule.builder()
                .owner(owner)
                .scheduleDate(request.getDate())
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
                request.getDate(),
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
