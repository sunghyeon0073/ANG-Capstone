package org.example.capstoneBack.domain.schedule.repository;

import org.example.capstoneBack.domain.schedule.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    // 개인 캘린더
    List<Schedule> findByUserUserIdAndScopeIsNull(Long userId);

    // 부서 공유 캘린더
    List<Schedule> findByScopeScopeId(Long scopeId);

    @Query("SELECT s FROM Schedule s WHERE s.user.userId = :userId AND s.startTime >= :start AND s.endTime <= :end")
    List<Schedule> findPersonalByDateRange(@Param("userId") Long userId,
                                           @Param("start") LocalDateTime start,
                                           @Param("end") LocalDateTime end);

    @Query("SELECT s FROM Schedule s WHERE s.scope.scopeId = :scopeId AND s.startTime >= :start AND s.endTime <= :end")
    List<Schedule> findSharedByDateRange(@Param("scopeId") Long scopeId,
                                         @Param("start") LocalDateTime start,
                                         @Param("end") LocalDateTime end);
}
