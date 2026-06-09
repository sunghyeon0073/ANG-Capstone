package com.ang.Backend.domain.schedule.service;

import org.springframework.jdbc.core.JdbcTemplate;
import jakarta.annotation.PostConstruct;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.schedule.dto.ScheduleDto;
import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.schedule.entity.ScheduleType;
import com.ang.Backend.domain.schedule.repository.ScheduleRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final com.ang.Backend.domain.memo.repository.MemoRepository memoRepository;
    private final com.ang.Backend.domain.file.repository.FileItemRepository fileItemRepository;
    private final com.ang.Backend.domain.scope.repository.UserMembershipRepository userMembershipRepository;
    private final JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void fixLegacyDbSchema() {
        try {
            // 과거 버전의 엔티티에서 생성된 NOT NULL 컬럼을 제거하거나 NULL 허용으로 변경
            jdbcTemplate.execute("ALTER TABLE schedules MODIFY COLUMN schedule_date DATE NULL");
            log.info("Successfully modified legacy schedule_date column to be nullable.");
        } catch (Exception e) {
            log.warn("Legacy schedule_date column might not exist or already modified. - {}", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE schedules ADD COLUMN schedule_type VARCHAR(20) DEFAULT 'PERSONAL' NOT NULL");
            log.info("Successfully added schedule_type column.");
        } catch (Exception e) {
            log.warn("schedule_type column might already exist. - {}", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE schedules ADD COLUMN scope_id INT NULL");
            log.info("Successfully added scope_id column.");
        } catch (Exception e) {
            log.warn("scope_id column might already exist. - {}", e.getMessage());
        }

        // 할 일(Todo) 및 반복 일정 관련 컬럼 추가
        String[] columnsToAdd = {
            "ALTER TABLE schedules ADD COLUMN is_todo BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE schedules ADD COLUMN is_completed BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE schedules ADD COLUMN parent_schedule_id BIGINT NULL",
            "ALTER TABLE schedules ADD COLUMN repeat_type VARCHAR(20) NULL",
            "ALTER TABLE schedules ADD COLUMN repeat_end_date DATE NULL"
        };

        for (String sql : columnsToAdd) {
            try {
                jdbcTemplate.execute(sql);
                log.info("Successfully executed: {}", sql);
            } catch (Exception e) {
                log.warn("Column might already exist or failed to add: {} - {}", sql, e.getMessage());
            }
        }
    }

    private Integer getDepartmentScopeId(User user) {
        return userMembershipRepository.findByUser(user).stream()
                .map(com.ang.Backend.domain.scope.entity.UserMembership::getScope)
                .filter(s -> s.getScopeType() == com.ang.Backend.common.enums.ScopeType.DEPARTMENT || s.getScopeType() == com.ang.Backend.common.enums.ScopeType.TEAM)
                .map(s -> {
                    // 상위로 올라가며 DEPARTMENT 레벨의 ID를 찾음 (없으면 자신의 TEAM ID 사용)
                    com.ang.Backend.domain.scope.entity.Scope current = s;
                    while (current != null && current.getScopeType() != com.ang.Backend.common.enums.ScopeType.DEPARTMENT) {
                        current = current.getParentScope();
                    }
                    return (current != null) ? current.getScopeId() : s.getScopeId();
                })
                .findFirst()
                .orElse(null);
    }

    private com.ang.Backend.domain.scope.entity.Scope getScopeEntity(Integer scopeId) {
        if (scopeId == null) return null;
        return com.ang.Backend.domain.scope.entity.Scope.builder().scopeId(scopeId).build();
    }

    public List<ScheduleDto.Response> getSchedules(User owner, LocalDate startDate, LocalDate endDate) {
        Integer scopeId = getDepartmentScopeId(owner);
        List<Schedule> schedules;
        if (startDate != null && endDate != null) {
            schedules = scheduleRepository.findByOwnerOrScopeAndDateRangeOverlap(owner, scopeId, startDate, endDate);
        } else {
            // 기본값으로 현재 달 정도만이라도 가져오거나 전체를 가져오되 부서 필터 포함
            schedules = scheduleRepository.findByOwnerOrScopeAndDateRangeOverlap(owner, scopeId, LocalDate.now().minusMonths(6), LocalDate.now().plusMonths(6));
        }

        return schedules.stream()
                .map(ScheduleDto.Response::from)
                .toList();
    }

    public List<ScheduleDto.AiRecommendationResponse> getAiRecommendations(User owner, LocalDate startDate, LocalDate endDate) {
        LocalDate rangeStart = startDate != null ? startDate : LocalDate.now().minusDays(7);
        LocalDate rangeEnd = endDate != null ? endDate : LocalDate.now().plusDays(30);
        Integer scopeId = getDepartmentScopeId(owner);

        List<ScheduleDto.AiRecommendationResponse> recommendations = new ArrayList<>();
        recommendations.addAll(buildLastYearRecommendations(owner, scopeId, rangeStart, rangeEnd));
        recommendations.addAll(buildPatternRecommendations(owner, scopeId, rangeStart, rangeEnd));

        // 각 추천 항목에 대해 연관 문서/메모 탐색
        recommendations.forEach(rec -> rec.getAssociatedItems().addAll(findAssociatedItems(owner, rec.getSourceTitle())));

        return recommendations.stream()
                .sorted(Comparator
                        .comparing(ScheduleDto.AiRecommendationResponse::getRecommendationDate)
                        .thenComparing(item -> item.getSourceStartTime() != null ? item.getSourceStartTime() : java.time.LocalTime.MIN)
                        .thenComparing(ScheduleDto.AiRecommendationResponse::getTitle))
                .toList();
    }

    private List<ScheduleDto.AiRecommendationResponse> buildPatternRecommendations(User owner, Integer scopeId, LocalDate rangeStart, LocalDate rangeEnd) {
        // 최근 6개월간의 일정을 분석 (패턴 파악용, 부서 일정 포함)
        LocalDate analysisStart = LocalDate.now().minusMonths(6);
        List<Schedule> pastSchedules = scheduleRepository.findByOwnerOrScopeAndStartDateBetween(owner, scopeId, analysisStart, LocalDate.now());

        if (pastSchedules.isEmpty()) return List.of();

        // 제목별로 일정 그룹화
        java.util.Map<String, List<Schedule>> groups = pastSchedules.stream()
                .collect(java.util.stream.Collectors.groupingBy(s -> s.getTitle().trim()));

        List<ScheduleDto.AiRecommendationResponse> results = new ArrayList<>();

        groups.forEach((title, schedules) -> {
            if (schedules.size() >= 3) {
                // 패턴 분석 (주기성)
                long avgInterval = calculateAverageInterval(schedules);
                if (avgInterval >= 6 && avgInterval <= 35) { // 주간 또는 월간 패턴인 경우
                    Schedule last = schedules.get(schedules.size() - 1);
                    LocalDate nextDate = last.getStartDate().plusDays(avgInterval);
                    
                    // 예측된 날짜가 요청 범위 내에 있는지 확인
                    if (!nextDate.isBefore(rangeStart) && !nextDate.isAfter(rangeEnd)) {
                        results.add(ScheduleDto.AiRecommendationResponse.builder()
                                .id("pattern-" + title.hashCode() + "-" + nextDate)
                                .type("pattern")
                                .title("AI 패턴 추천")
                                .message("자주 하시는 [" + title + "] 일정이 돌아왔어요. 등록할까요?")
                                .recommendationDate(nextDate)
                                .sourceStartDate(nextDate)
                                .sourceEndDate(nextDate)
                                .sourceStartTime(last.getStartTime())
                                .sourceEndTime(last.getEndTime())
                                .sourceTitle(title)
                                .build());
                    }
                }
            }
        });

        return results;
    }

    private long calculateAverageInterval(List<Schedule> schedules) {
        if (schedules.size() < 2) return 0;
        long totalDays = 0;
        for (int i = 1; i < schedules.size(); i++) {
            totalDays += ChronoUnit.DAYS.between(schedules.get(i-1).getStartDate(), schedules.get(i).getStartDate());
        }
        return totalDays / (schedules.size() - 1);
    }

    private List<ScheduleDto.AssociatedItem> findAssociatedItems(User owner, String keyword) {
        if (keyword == null || keyword.isBlank() || keyword.length() < 2) return new ArrayList<>();
        
        // 검색용 핵심 키워드 추출 (단순히 첫 2단어 혹은 공백 제거 등)
        String searchKey = keyword.split(" ")[0]; 
        
        List<ScheduleDto.AssociatedItem> items = new ArrayList<>();
        
        // 메모 검색
        memoRepository.findByUserAndKeyword(owner, searchKey).stream()
                .limit(2)
                .forEach(memo -> items.add(ScheduleDto.AssociatedItem.builder()
                        .type("MEMO")
                        .id(memo.getMemoId())
                        .title(memo.getTitle())
                        .content(memo.getContent())
                        .build()));
        
        // 파일 검색
        fileItemRepository.findByUserAndKeyword(owner.getUserId().intValue(), searchKey).stream()
                .limit(2)
                .forEach(file -> items.add(ScheduleDto.AssociatedItem.builder()
                        .type("FILE")
                        .id(file.getFileId())
                        .title(file.getOriginalFileName())
                        .build()));
        
        return items;
    }

    private List<ScheduleDto.AiRecommendationResponse> buildLastYearRecommendations(User owner, Integer scopeId, LocalDate rangeStart, LocalDate rangeEnd) {
        LocalDate sourceStart = rangeStart.minusYears(1);
        LocalDate sourceEnd = rangeEnd.minusYears(1);

        return scheduleRepository.findByOwnerOrScopeAndStartDateBetween(owner, scopeId, sourceStart, sourceEnd)
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
    public List<ScheduleDto.Response> create(ScheduleDto.SaveRequest request, User owner) {
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "종료일은 시작일보다 앞설 수 없습니다.");
        }

        List<Schedule> createdSchedules = new ArrayList<>();
        com.ang.Backend.domain.scope.entity.Scope scope = null;
        if (request.getType() == ScheduleType.DEPARTMENT) {
            scope = getScopeEntity(getDepartmentScopeId(owner));
        }

        Schedule rootSchedule = Schedule.builder()
                .owner(owner)
                .scope(scope)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .title(request.getTitle().trim())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .description(normalizeDescription(request.getDescription()))
                .type(request.getType() != null ? request.getType() : ScheduleType.PERSONAL)
                .isTodo(request.isTodo())
                .repeatType(request.getRepeatType())
                .repeatEndDate(request.getRepeatEndDate())
                .build();
        
        // Ensure isTodo is set correctly (sometimes builder needs extra help with boolean naming)
        rootSchedule.setIsTodo(request.isTodo());

        createdSchedules.add(scheduleRepository.save(rootSchedule));

        // Generate recurring schedules if needed
        if (!"NONE".equalsIgnoreCase(request.getRepeatType()) && request.getRepeatEndDate() != null) {
            LocalDate currentStart = request.getStartDate();
            LocalDate currentEnd = request.getEndDate();
            int durationDays = (int) ChronoUnit.DAYS.between(currentStart, currentEnd);

            while (true) {
                currentStart = getNextRepeatDate(currentStart, request.getRepeatType());
                if (currentStart == null || currentStart.isAfter(request.getRepeatEndDate())) {
                    break;
                }
                currentEnd = currentStart.plusDays(durationDays);

                Schedule repeatedSchedule = Schedule.builder()
                    .owner(owner)
                    .scope(scope)
                    .startDate(currentStart)
                    .endDate(currentEnd)
                    .title(request.getTitle().trim())
                    .startTime(request.getStartTime())
                    .endTime(request.getEndTime())
                    .description(normalizeDescription(request.getDescription()))
                    .type(request.getType() != null ? request.getType() : ScheduleType.PERSONAL)
                    .isTodo(request.isTodo())
                    .parentScheduleId(rootSchedule.getScheduleId())
                    .repeatType(request.getRepeatType())
                    .repeatEndDate(request.getRepeatEndDate())
                    .build();
                
                repeatedSchedule.setIsTodo(request.isTodo());

                createdSchedules.add(scheduleRepository.save(repeatedSchedule));
            }
        }

        return createdSchedules.stream().map(ScheduleDto.Response::from).toList();
    }

    private LocalDate getNextRepeatDate(LocalDate currentDate, String repeatType) {
        if ("DAILY".equalsIgnoreCase(repeatType)) return currentDate.plusDays(1);
        if ("WEEKLY".equalsIgnoreCase(repeatType)) return currentDate.plusWeeks(1);
        if ("MONTHLY".equalsIgnoreCase(repeatType)) return currentDate.plusMonths(1);
        if ("YEARLY".equalsIgnoreCase(repeatType)) return currentDate.plusYears(1);
        return null;
    }

    @Transactional
    public ScheduleDto.Response update(Long scheduleId, ScheduleDto.SaveRequest request, User owner) {
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "종료일은 시작일보다 앞설 수 없습니다.");
        }

        Schedule schedule = getAuthorizedSchedule(scheduleId, owner);
        
        com.ang.Backend.domain.scope.entity.Scope scope = null;
        if (request.getType() == ScheduleType.DEPARTMENT) {
            scope = getScopeEntity(getDepartmentScopeId(owner));
        }

        schedule.update(
                request.getStartDate(),
                request.getEndDate(),
                request.getTitle().trim(),
                request.getStartTime(),
                request.getEndTime(),
                normalizeDescription(request.getDescription()),
                request.getType() != null ? request.getType() : schedule.getType(),
                request.isTodo(),
                request.getRepeatType(),
                request.getRepeatEndDate()
        );
        schedule.setScope(scope);
        
        return ScheduleDto.Response.from(schedule);
    }

    @Transactional
    public ScheduleDto.Response toggleComplete(Long scheduleId, User owner) {
        Schedule schedule = getAuthorizedSchedule(scheduleId, owner);
        schedule.toggleComplete();
        return ScheduleDto.Response.from(schedule);
    }

    @Transactional
    public void delete(Long scheduleId, User owner) {
        Schedule schedule = getAuthorizedSchedule(scheduleId, owner);
        scheduleRepository.delete(schedule);
    }

    private Schedule getAuthorizedSchedule(Long scheduleId, User owner) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCHEDULE_NOT_FOUND));

        // 본인 것이거나, 부서 일정인 경우 같은 부서원이면 허용
        boolean isOwner = schedule.getOwner().getUserId().equals(owner.getUserId());
        boolean isSameDept = false;
        
        if (schedule.getType() == ScheduleType.DEPARTMENT && schedule.getScope() != null) {
            Integer userDeptId = getDepartmentScopeId(owner);
            if (userDeptId != null && userDeptId.equals(schedule.getScope().getScopeId())) {
                isSameDept = true;
            }
        }

        if (!isOwner && !isSameDept) {
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