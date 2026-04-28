package org.example.capstoneBack.domain.task.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.TaskStatus;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.task.dto.TaskCreateRequest;
import org.example.capstoneBack.domain.task.dto.TaskDto;
import org.example.capstoneBack.domain.task.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping("/scope/{scopeId}")
    public ResponseEntity<ApiResponse<List<TaskDto>>> getTasksByScope(@PathVariable Long scopeId) {
        return ResponseEntity.ok(ApiResponse.ok(taskService.getTasksByScope(scopeId)));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<TaskDto>>> getMyTasks(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(taskService.getMyTasks(userDetails.getUsername())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TaskDto>> createTask(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody TaskCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(taskService.createTask(userDetails.getUsername(), request)));
    }

    @PatchMapping("/{taskId}")
    public ResponseEntity<ApiResponse<TaskDto>> updateTask(
            @PathVariable Long taskId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Long assigneeId) {
        return ResponseEntity.ok(ApiResponse.ok(
                taskService.updateTask(taskId, userDetails.getUsername(), title, description, status, assigneeId)));
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<ApiResponse<Void>> deleteTask(@PathVariable Long taskId) {
        taskService.deleteTask(taskId);
        return ResponseEntity.ok(ApiResponse.ok("업무가 삭제되었습니다."));
    }
}
