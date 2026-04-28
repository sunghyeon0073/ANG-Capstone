package org.example.capstoneBack.domain.role.repository;

import org.example.capstoneBack.domain.role.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PermissionRepository extends JpaRepository<Permission, Long> {

    Optional<Permission> findByActionName(String actionName);

    boolean existsByActionName(String actionName);
}
