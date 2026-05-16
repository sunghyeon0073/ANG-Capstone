package com.ang.Backend.domain.role.repository;

import com.ang.Backend.domain.role.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Integer> {
    Optional<Role> findByRoleLevel(int roleLevel);
}
