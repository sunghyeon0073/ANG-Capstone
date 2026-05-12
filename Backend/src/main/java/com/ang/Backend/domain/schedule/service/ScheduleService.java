package com.ang.Backend.domain.schedule.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.schedule.dto.ScheduleCreateRequest;
import com.ang.Backend.domain.schedule.dto.ScheduleDto;
import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.schedule.repository.ScheduleRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;
    private final UserMembershipRepository userMembershipRepository;

    @Transactional(readOnly = true)
    public List<ScheduleDto> getMySchedules(String empNo) {
        User user = findUser(empNo);
        List<ScheduleDto> result = new ArrayList<>(
                scheduleRepository.findByUserAndScopeIsNullOrderByStartTimeAsc(user)
                        .stream().map(ScheduleDto::from).toList());

        userMembershipRepository.findByUser(user).stream()
                .flatMap(m -> scheduleRepository.findByScopeOrderByStartTimeAsc(m.getScope()).stream())
                .map(ScheduleDto::from)
                .forEach(result::add);

        result.sort(Comparator.comparing(ScheduleDto::getStartTime));
        return result;
    }

    @Transactional(readOnly = true)
    public List<ScheduleDto> getPersonalSchedules(String empNo) {
        User user = findUser(empNo);
        return scheduleRepository.findByUserAndScopeIsNullOrderByStartTimeAsc(user)
                .stream().map(ScheduleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ScheduleDto> getSharedSchedules(String empNo) {
        User user = findUser(empNo);
        return userMembershipRepository.findByUser(user).stream()
                .flatMap(m -> scheduleRepository.findByScopeOrderByStartTimeAsc(m.getScope()).stream())
                .map(ScheduleDto::from)
                .sorted(Comparator.comparing(ScheduleDto::getStartTime))
                .toList();
    }

    @Transactional
    public ScheduleDto createSchedule(String empNo, ScheduleCreateRequest req) {
        User user = findUser(empNo);
        Scope scope = resolveScope(req.getScopeId());

        Schedule schedule = Schedule.builder()
                .user(user)
                .scope(scope)
                .title(req.getTitle())
                .startTime(req.getStartTime())
                .endTime(req.getEndTime())
                .build();
        return ScheduleDto.from(scheduleRepository.save(schedule));
    }

    @Transactional
    public ScheduleDto updateSchedule(String empNo, Integer scheduleId, ScheduleCreateRequest req) {
        User user = findUser(empNo);
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCHEDULE_NOT_FOUND));

        if (!schedule.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }

        schedule.setTitle(req.getTitle());
        schedule.setStartTime(req.getStartTime());
        schedule.setEndTime(req.getEndTime());
        schedule.setScope(resolveScope(req.getScopeId()));
        return ScheduleDto.from(schedule);
    }

    @Transactional
    public void deleteSchedule(String empNo, Integer scheduleId) {
        User user = findUser(empNo);
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCHEDULE_NOT_FOUND));

        if (!schedule.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        scheduleRepository.delete(schedule);
    }

    public List<Schedule> getRecentSchedules(User user) {
        return scheduleRepository.findByUserOrderByStartTimeAsc(user);
    }

    private User findUser(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private Scope resolveScope(Integer scopeId) {
        if (scopeId == null) return null;
        return scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
    }
}
