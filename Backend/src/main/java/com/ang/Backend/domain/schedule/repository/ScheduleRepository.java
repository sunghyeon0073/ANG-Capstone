package com.ang.Backend.domain.schedule.repository;

import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findByOwnerOrderByStartDateAscStartTimeAsc(User owner);

    @Query("SELECT s FROM Schedule s WHERE s.owner = :owner " +
           "AND s.startDate <= :endDate AND s.endDate >= :startDate " +
           "ORDER BY s.startDate ASC, s.startTime ASC")
    List<Schedule> findByOwnerAndDateRangeOverlap(
            @Param("owner") User owner,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate
    );
}
