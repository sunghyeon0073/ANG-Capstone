package com.ang.Backend.security;

import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String empNo) throws UsernameNotFoundException {
        User user = userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + empNo));

        return new org.springframework.security.core.userdetails.User(
                user.getEmpNo(),
                user.getPasswordHash(),
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }
}
