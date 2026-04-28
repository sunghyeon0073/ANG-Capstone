package org.example.capstoneBack.domain.task.repository;

import org.example.capstoneBack.common.enums.TaskStatus;
import org.example.capstoneBack.domain.task.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByScopeScopeId(Long scopeId);

    List<Task> findByAssigneeUserId(Long userId);

    List<Task> findByScopeScopeIdAndStatus(Long scopeId, TaskStatus status);
}
