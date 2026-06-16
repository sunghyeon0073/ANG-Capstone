package com.ang.Backend.domain.board.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.board.dto.BoardPostDto;
import com.ang.Backend.domain.board.service.BoardPostService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/board")
@RequiredArgsConstructor
public class BoardPostController {

    private final BoardPostService boardPostService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<BoardPostDto.Response>>> getPosts(
            @RequestParam(required = false) String type,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(boardPostService.getPosts(type, user)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BoardPostDto.Response>> createPost(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody BoardPostDto.CreateRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(boardPostService.createPost(user, request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BoardPostDto.Response>> updatePost(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody BoardPostDto.UpdateRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(boardPostService.updatePost(user, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deletePost(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User user = resolveUser(userDetails);
        boardPostService.deletePost(user, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/views")
    public ResponseEntity<ApiResponse<BoardPostDto.Response>> incrementViews(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(boardPostService.incrementViews(id)));
    }

    @PostMapping("/{id}/attachments")
    public ResponseEntity<ApiResponse<BoardPostDto.AttachmentInfo>> uploadAttachment(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.success(boardPostService.uploadAttachment(id, file, user)));
    }

    @GetMapping("/attachments/{attachmentId}/download")
    public ResponseEntity<byte[]> downloadAttachment(@PathVariable Long attachmentId) {
        return boardPostService.downloadAttachment(attachmentId);
    }

    @DeleteMapping("/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long attachmentId) {
        User user = resolveUser(userDetails);
        boardPostService.deleteAttachment(attachmentId, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private User resolveUser(UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
