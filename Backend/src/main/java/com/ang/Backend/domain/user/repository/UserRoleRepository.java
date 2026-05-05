package com.ang.Backend.domain.user.repository;

import com.ang.Backend.domain.user.entity.Scope;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.entity.UserRole;
import com.ang.Backend.domain.user.entity.id.UserRoleId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRoleRepository extends JpaRepository<UserRole, UserRoleId> {
    List<UserRole> findByUser(User user);
    List<UserRole> findByUserAndScope(User user, Scope scope);

    @Query("SELECT ur FROM UserRole ur WHERE ur.user = :user ORDER BY ur.role.roleLevel DESC")
    List<UserRole> findByUserOrderByRoleLevelDesc(@Param("user") User user);
}
