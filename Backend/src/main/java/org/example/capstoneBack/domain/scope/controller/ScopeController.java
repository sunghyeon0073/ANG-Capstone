package org.example.capstoneBack.domain.scope.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.scope.dto.ScopeCreateRequest;
import org.example.capstoneBack.domain.scope.dto.ScopeDto;
import org.example.capstoneBack.domain.scope.service.ScopeService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/scopes")
@RequiredArgsConstructor
public class ScopeController {

    private final ScopeService scopeService;

    /** 전체 조직도 조회 (Common-01) */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getAllScopes() {
        return ResponseEntity.ok(ApiResponse.ok(scopeService.getAllScopes()));
    }

    @GetMapping("/{scopeId}")
    public ResponseEntity<ApiResponse<ScopeDto>> getScopeById(@PathVariable Long scopeId) {
        return ResponseEntity.ok(ApiResponse.ok(scopeService.getScopeById(scopeId)));
    }

    @GetMapping("/{scopeId}/children")
    public ResponseEntity<ApiResponse<List<ScopeDto>>> getChildScopes(@PathVariable Long scopeId) {
        return ResponseEntity.ok(ApiResponse.ok(scopeService.getChildScopes(scopeId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<ApiResponse<ScopeDto>> createScope(
            @Valid @RequestBody ScopeCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(scopeService.createScope(request)));
    }

    @PatchMapping("/{scopeId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERADMIN')")
    public ResponseEntity<ApiResponse<ScopeDto>> updateScope(
            @PathVariable Long scopeId, @RequestParam String name) {
        return ResponseEntity.ok(ApiResponse.ok(scopeService.updateScope(scopeId, name)));
    }

    @DeleteMapping("/{scopeId}")
    @PreAuthorize("hasRole('SUPERADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteScope(@PathVariable Long scopeId) {
        scopeService.deleteScope(scopeId);
        return ResponseEntity.ok(ApiResponse.ok("부서가 삭제되었습니다."));
    }
}
