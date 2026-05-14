package com.ang.Backend.security;

import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String empNo) throws UsernameNotFoundException {
        User user = userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다: " + empNo));

        List<UserRole> userRoles = userRoleRepository.findByUser(user);
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        
        authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        
        int maxLevel = userRoles.stream()
                .mapToInt(ur -> ur.getRole().getRoleLevel())
                .max()
                .orElse(0);

        if (maxLevel >= 100) {
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
            authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        } else if (maxLevel >= 50) {
            authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        }

        return new org.springframework.security.core.userdetails.User(
                user.getEmpNo(),
                user.getPasswordHash(),
                authorities
        );
    }
}
