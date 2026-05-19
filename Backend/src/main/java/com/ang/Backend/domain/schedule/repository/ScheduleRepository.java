package com.ang.Backend.domain.schedule.repository;

import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findByOwnerOrderByScheduleDateAscStartTimeAsc(User owner);

    List<Schedule> findByOwnerAndScheduleDateBetweenOrderByScheduleDateAscStartTimeAsc(
            User owner,
            LocalDate startDate,
            LocalDate endDate
    );
}
