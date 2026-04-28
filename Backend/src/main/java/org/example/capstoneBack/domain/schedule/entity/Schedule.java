package org.example.capstoneBack.domain.schedule.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.user.entity.User;

import java.time.LocalDateTime;

@Entity
@Table(name = "schedules")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Long scheduleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // NULL: 개인 캘린더, 값 존재: 부서 공유 캘린더
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private Scope scope;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    public void update(String title, LocalDateTime startTime, LocalDateTime endTime) {
        if (title != null) this.title = title;
        if (startTime != null) this.startTime = startTime;
        if (endTime != null) this.endTime = endTime;
    }
}
