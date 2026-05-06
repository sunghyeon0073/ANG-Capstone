package com.ang.Backend.domain.user.service;

import com.ang.Backend.domain.user.DAO.MemberRepository;
import com.ang.Backend.domain.user.DTO.MemberResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final MemberRepository memberRepository;

    public List<MemberResponse> getAllMembers() {
        return memberRepository.findAll().stream()
                .map(MemberResponse::new)
                .toList();
    }
}
