package com.ang.Backend.domain.user.repository;

import com.ang.Backend.domain.user.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Integer> {
    Optional<Role> findByRoleLevel(int roleLevel);
}
