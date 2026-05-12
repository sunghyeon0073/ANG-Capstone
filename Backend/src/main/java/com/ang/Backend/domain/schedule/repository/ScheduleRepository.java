package com.ang.Backend.domain.schedule.repository;

import com.ang.Backend.domain.schedule.entity.Schedule;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Integer> {

    List<Schedule> findByUserOrderByStartTimeAsc(User user);

    List<Schedule> findByUserAndScopeIsNullOrderByStartTimeAsc(User user);

    List<Schedule> findByScopeOrderByStartTimeAsc(Scope scope);
}
