package org.example.capstoneBack.domain.task.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.task.dto.TaskCreateRequest;
import org.example.capstoneBack.domain.task.dto.TaskDto;
import org.example.capstoneBack.domain.task.entity.Task;
import org.example.capstoneBack.domain.task.repository.TaskRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.example.capstoneBack.common.enums.TaskStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;

    @Transactional(readOnly = true)
    public List<TaskDto> getTasksByScope(Long scopeId) {
        return taskRepository.findByScopeScopeId(scopeId)
                .stream().map(TaskDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TaskDto> getMyTasks(String empNo) {
        User user = findUserByEmpNo(empNo);
        return taskRepository.findByAssigneeUserId(user.getUserId())
                .stream().map(TaskDto::from).toList();
    }

    @Transactional
    public TaskDto createTask(String empNo, TaskCreateRequest request) {
        Scope scope = findScopeById(request.getScopeId());
        User assignee = null;
        if (request.getAssigneeId() != null) {
            assignee = findUserById(request.getAssigneeId());
        }
        Task task = Task.builder()
                .scope(scope).assignee(assignee)
                .title(request.getTitle())
                .description(request.getDescription())
                .status(request.getStatus() != null ? request.getStatus() : TaskStatus.TODO)
                .build();
        return TaskDto.from(taskRepository.save(task));
    }

    @Transactional
    public TaskDto updateTask(Long taskId, String empNo, String title,
                               String description, TaskStatus status, Long assigneeId) {
        Task task = findById(taskId);
        User assignee = assigneeId != null ? findUserById(assigneeId) : null;
        task.update(title, description, status, assignee);
        return TaskDto.from(task);
    }

    @Transactional
    public void deleteTask(Long taskId) {
        taskRepository.deleteById(taskId);
    }

    private Task findById(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private User findUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private Scope findScopeById(Long id) {
        return scopeRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
    }
}
