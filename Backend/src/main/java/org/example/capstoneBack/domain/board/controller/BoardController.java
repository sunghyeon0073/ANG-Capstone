package org.example.capstoneBack.domain.board.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.BoardType;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.board.dto.BoardCreateRequest;
import org.example.capstoneBack.domain.board.dto.BoardDto;
import org.example.capstoneBack.domain.board.dto.CommentDto;
import org.example.capstoneBack.domain.board.service.BoardService;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.example.capstoneBack.domain.user.repository.UserRoleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/boards")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    /** Common-04-1: 게시글 목록 조회 + 통합검색/필터 (Search-01) */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<BoardDto>>> getBoards(
            @RequestParam Long scopeId,
            @RequestParam(required = false) BoardType boardType,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.ok(
                boardService.getBoards(scopeId, boardType, keyword, pageable)));
    }

    /** 게시글 단건 조회 */
    @GetMapping("/{postId}")
    public ResponseEntity<ApiResponse<BoardDto>> getBoard(@PathVariable Long postId) {
        return ResponseEntity.ok(ApiResponse.ok(boardService.getBoard(postId)));
    }

    /** Common-04-2: 게시글 작성 */
    @PostMapping
    public ResponseEntity<ApiResponse<BoardDto>> createBoard(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody BoardCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(boardService.createBoard(userDetails.getUsername(), request)));
    }

    /** Common-04-3: 게시글 수정 (본인 또는 관리자) */
    @PatchMapping("/{postId}")
    public ResponseEntity<ApiResponse<BoardDto>> updateBoard(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String content) {
        int roleLevel = getRoleLevel(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok(
                boardService.updateBoard(postId, userDetails.getUsername(), title, content, roleLevel)));
    }

    /** Common-04-4: 게시글 삭제 (본인 또는 관리자) */
    @DeleteMapping("/{postId}")
    public ResponseEntity<ApiResponse<Void>> deleteBoard(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails) {
        int roleLevel = getRoleLevel(userDetails.getUsername());
        boardService.deleteBoard(postId, userDetails.getUsername(), roleLevel);
        return ResponseEntity.ok(ApiResponse.ok("게시글이 삭제되었습니다."));
    }

    // ──────────────── 댓글 ────────────────

    @GetMapping("/{postId}/comments")
    public ResponseEntity<ApiResponse<List<CommentDto>>> getComments(@PathVariable Long postId) {
        return ResponseEntity.ok(ApiResponse.ok(boardService.getComments(postId)));
    }

    @PostMapping("/{postId}/comments")
    public ResponseEntity<ApiResponse<CommentDto>> createComment(
            @PathVariable Long postId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam String content) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(boardService.createComment(postId, userDetails.getUsername(), content)));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @PathVariable Long commentId,
            @AuthenticationPrincipal UserDetails userDetails) {
        int roleLevel = getRoleLevel(userDetails.getUsername());
        boardService.deleteComment(commentId, userDetails.getUsername(), roleLevel);
        return ResponseEntity.ok(ApiResponse.ok("댓글이 삭제되었습니다."));
    }

    private int getRoleLevel(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .map(u -> {
                    Integer level = userRoleRepository.findMaxRoleLevelByUserId(u.getUserId());
                    return level != null ? level : 0;
                }).orElse(0);
    }
}
