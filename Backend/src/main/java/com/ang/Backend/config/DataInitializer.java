package com.ang.Backend.config;

import com.ang.Backend.domain.user.DAO.MemberRepository;
import com.ang.Backend.domain.user.entity.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(ApplicationArguments args) {
        init("admin001", "김철수", "kim@ang.lab",  "팀장", "김철수");
        init("admin002", "이영희", "lee@ang.lab",  "팀원", "이영희");
        init("admin003", "박민준", "park@ang.lab", "팀원", "박민준");
        init("2401028",  "김성현", "2401028@ang.lab", "팀원", "2401028");
        init("1901153",  "성수찬", "1901153@ang.lab", "팀원", "1901153");
        init("2001330",  "김재우", "2001330@ang.lab", "팀원", "2001330");
        init("2301078",  "이상열", "2301078@ang.lab", "팀원", "2301078");
        init("2201073",  "임건수", "2201073@ang.lab", "팀원", "2201073");
        init("2201313",  "김광민", "2201313@ang.lab", "팀원", "2201313");
    }

    private void init(String empNo, String name, String email, String role, String rawPw) {
        if (memberRepository.existsByEmpNo(empNo)) return;

        Member member = memberRepository.findByEmail(email)
                .orElse(Member.builder().name(name).email(email).role(role).password("").build());
        member.updateCredentials(empNo, passwordEncoder.encode(rawPw));
        memberRepository.save(member);
    }
}
