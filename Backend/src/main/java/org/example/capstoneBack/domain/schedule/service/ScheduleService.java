package org.example.capstoneBack.domain.schedule.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.schedule.dto.ScheduleCreateRequest;
import org.example.capstoneBack.domain.schedule.dto.ScheduleDto;
import org.example.capstoneBack.domain.schedule.entity.Schedule;
import org.example.capstoneBack.domain.schedule.repository.ScheduleRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;

    @Transactional(readOnly = true)
    public List<ScheduleDto> getPersonalSchedules(String empNo) {
        User user = findUserByEmpNo(empNo);
        return scheduleRepository.findByUserUserIdAndScopeIsNull(user.getUserId())
                .stream().map(ScheduleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ScheduleDto> getSharedSchedules(Long scopeId) {
        return scheduleRepository.findByScopeScopeId(scopeId)
                .stream().map(ScheduleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ScheduleDto> getPersonalSchedulesByRange(String empNo,
                                                          LocalDateTime start, LocalDateTime end) {
        User user = findUserByEmpNo(empNo);
        return scheduleRepository.findPersonalByDateRange(user.getUserId(), start, end)
                .stream().map(ScheduleDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ScheduleDto> getSharedSchedulesByRange(Long scopeId,
                                                        LocalDateTime start, LocalDateTime end) {
        return scheduleRepository.findSharedByDateRange(scopeId, start, end)
                .stream().map(ScheduleDto::from).toList();
    }

    @Transactional
    public ScheduleDto createSchedule(String empNo, ScheduleCreateRequest request) {
        User user = findUserByEmpNo(empNo);
        Scope scope = null;
        if (request.getScopeId() != null) {
            scope = scopeRepository.findById(request.getScopeId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }
        Schedule schedule = Schedule.builder()
                .user(user).scope(scope)
                .title(request.getTitle())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .build();
        return ScheduleDto.from(scheduleRepository.save(schedule));
    }

    @Transactional
    public ScheduleDto updateSchedule(Long scheduleId, String empNo,
                                       String title, LocalDateTime start, LocalDateTime end) {
        Schedule schedule = findById(scheduleId);
        validateOwner(schedule, empNo);
        schedule.update(title, start, end);
        return ScheduleDto.from(schedule);
    }

    @Transactional
    public void deleteSchedule(Long scheduleId, String empNo) {
        Schedule schedule = findById(scheduleId);
        validateOwner(schedule, empNo);
        scheduleRepository.delete(schedule);
    }

    private Schedule findById(Long id) {
        return scheduleRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.SCHEDULE_NOT_FOUND));
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private void validateOwner(Schedule schedule, String empNo) {
        if (!schedule.getUser().getEmpNo().equals(empNo)) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
    }
}
