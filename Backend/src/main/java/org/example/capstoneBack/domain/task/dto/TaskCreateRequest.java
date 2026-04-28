package org.example.capstoneBack.domain.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.example.capstoneBack.common.enums.TaskStatus;

@Getter
@NoArgsConstructor
public class TaskCreateRequest {

    @NotBlank(message = "제목을 입력하세요.")
    private String title;

    private String description;

    @NotNull(message = "부서를 선택하세요.")
    private Long scopeId;

    private Long assigneeId;

    private TaskStatus status;
}
