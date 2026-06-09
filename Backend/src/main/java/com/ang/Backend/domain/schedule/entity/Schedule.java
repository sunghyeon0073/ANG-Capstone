package com.ang.Backend.domain.schedule.entity;

import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "schedules")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_id")
    private Long scheduleId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private com.ang.Backend.domain.scope.entity.Scope scope;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false)
    private ScheduleType type;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_todo", nullable = false)
    @Builder.Default
    private boolean isTodo = false;

    public void setIsTodo(boolean isTodo) {
        this.isTodo = isTodo;
    }

    @Column(name = "is_completed", nullable = false)
    @Builder.Default
    private boolean isCompleted = false;

    @Column(name = "parent_schedule_id")
    private Long parentScheduleId;

    @Column(name = "repeat_type", length = 20)
    private String repeatType;

    @Column(name = "repeat_end_date")
    private LocalDate repeatEndDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public void update(LocalDate startDate, LocalDate endDate, String title, LocalTime startTime, LocalTime endTime, String description, ScheduleType type, boolean isTodo, String repeatType, LocalDate repeatEndDate) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.title = title;
        this.startTime = startTime;
        this.endTime = endTime;
        this.description = description;
        this.type = type;
        this.isTodo = isTodo;
        this.repeatType = repeatType;
        this.repeatEndDate = repeatEndDate;
    }

    public void toggleComplete() {
        if (!this.isTodo) return;
        this.isCompleted = !this.isCompleted;
    }
}
