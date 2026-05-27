package com.ang.Backend.domain.memo.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.memo.dto.MemoDto;
import com.ang.Backend.domain.memo.service.MemoService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/memos")
@RequiredArgsConstructor
public class MemoController {

    private final MemoService memoService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MemoDto.Response>>> getMemos(@AuthenticationPrincipal UserDetails userDetails) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(memoService.getMemos(user)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MemoDto.Response>> createMemo(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody MemoDto.SaveRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(memoService.createMemo(user, request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MemoDto.Response>> updateMemo(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody MemoDto.SaveRequest request) {
        User user = resolveUser(userDetails);
        return ResponseEntity.ok(ApiResponse.ok(memoService.updateMemo(user, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMemo(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User user = resolveUser(userDetails);
        memoService.deleteMemo(user, id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    private User resolveUser(UserDetails userDetails) {
        if (userDetails == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
