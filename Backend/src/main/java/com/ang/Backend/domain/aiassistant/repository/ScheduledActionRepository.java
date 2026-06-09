package com.ang.Backend.domain.aiassistant.repository;

import com.ang.Backend.domain.aiassistant.entity.ScheduledAction;
import com.ang.Backend.domain.aiassistant.entity.ScheduledActionStatus;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduledActionRepository extends JpaRepository<ScheduledAction, Long> {

    @Modifying
    @Query("UPDATE ScheduledAction a SET a.status = com.ang.Backend.domain.aiassistant.entity.ScheduledActionStatus.PROCESSING " +
           "WHERE a.status = com.ang.Backend.domain.aiassistant.entity.ScheduledActionStatus.PENDING " +
           "AND a.scheduledAt <= :now")
    int claimDueActions(@Param("now") LocalDateTime now);

    List<ScheduledAction> findTop50ByStatusOrderByScheduledAtAsc(ScheduledActionStatus status);

    List<ScheduledAction> findByRequesterOrderByScheduledAtDesc(User requester);
}
