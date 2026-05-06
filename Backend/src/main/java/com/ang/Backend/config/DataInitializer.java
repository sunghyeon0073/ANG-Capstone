package com.ang.Backend.config;

import com.ang.Backend.domain.user.DAO.MemberRepository;
import com.ang.Backend.domain.user.entity.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final MemberRepository memberRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (memberRepository.count() > 0) return;

        memberRepository.save(Member.builder().name("김철수").email("kim@ang.lab").role("팀장").build());
        memberRepository.save(Member.builder().name("이영희").email("lee@ang.lab").role("팀원").build());
        memberRepository.save(Member.builder().name("박민준").email("park@ang.lab").role("팀원").build());
    }
}
