package com.ang.Backend.domain.user.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.user.dto.UserDto;
import com.ang.Backend.domain.user.dto.UserUpdateRequest;
import com.ang.Backend.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<UserDto>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userService.getAllUsers()));
    }

    // 이름 또는 사번으로 사용자 검색 (메일 수신자 선택용)
    // GET /api/users/search?q=김  or  ?q=EMP001
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<UserDto.RecipientSearchResult>>> searchUsers(
            @RequestParam String q) {
        return ResponseEntity.ok(ApiResponse.ok(userService.searchUsers(q)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<UserDto>> getUser(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(userService.getUser(id)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(@PathVariable Integer id,
                                                           @RequestBody UserUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(userService.updateUser(id, req)));
    }

    @GetMapping("/{id}/profile-image")
    public ResponseEntity<byte[]> getProfileImage(@PathVariable Integer id) {
        UserService.ProfileImageResult result = userService.getProfileImage(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, result.contentType())
                .body(result.bytes());
    }

    @DeleteMapping("/{id}/profile-image")
    public ResponseEntity<ApiResponse<UserDto>> deleteProfileImage(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.ok(userService.deleteProfileImage(id)));
    }

    @PostMapping(value = "/{id}/profile-image", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<UserDto>> uploadProfileImage(
            @PathVariable Integer id,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.ok(userService.uploadProfileImage(id, file)));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approveUser(
            @PathVariable Integer id,
            @RequestBody com.ang.Backend.domain.user.dto.UserApproveRequest req) {
        userService.approveUser(id, req.getRoleLevel(), req.getPosition());
        return ResponseEntity.ok(ApiResponse.ok("사용자 가입이 승인되었습니다."));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(@PathVariable Integer id) {
        userService.anonymize(id);
        return ResponseEntity.ok(ApiResponse.ok("회원 탈퇴 처리되었습니다."));
    }
}
