package com.ang.Backend.domain.user.Controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.user.DTO.MemberResponse;
import com.ang.Backend.domain.user.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public ApiResponse<List<MemberResponse>> getAllMembers() {
        return ApiResponse.ok(memberService.getAllMembers());
    }
}
