package org.example.capstoneBack.domain.user.repository;

import org.example.capstoneBack.domain.user.entity.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRole.UserRoleId> {

    List<UserRole> findByUserUserId(Long userId);

    List<UserRole> findByUserUserIdAndScopeScopeId(Long userId, Long scopeId);

    @Query("SELECT MAX(ur.role.roleLevel) FROM UserRole ur WHERE ur.user.userId = :userId")
    Integer findMaxRoleLevelByUserId(@Param("userId") Long userId);

    void deleteByUserUserIdAndScopeScopeId(Long userId, Long scopeId);
}
