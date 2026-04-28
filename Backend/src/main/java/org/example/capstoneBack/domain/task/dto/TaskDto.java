package org.example.capstoneBack.domain.task.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.TaskStatus;
import org.example.capstoneBack.domain.task.entity.Task;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class TaskDto {

    private Long taskId;
    private Long scopeId;
    private Long assigneeId;
    private String assigneeName;
    private String title;
    private String description;
    private TaskStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static TaskDto from(Task task) {
        return TaskDto.builder()
                .taskId(task.getTaskId())
                .scopeId(task.getScope().getScopeId())
                .assigneeId(task.getAssignee() != null ? task.getAssignee().getUserId() : null)
                .assigneeName(task.getAssignee() != null ? task.getAssignee().getName() : null)
                .title(task.getTitle())
                .description(task.getDescription())
                .status(task.getStatus())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }
}
