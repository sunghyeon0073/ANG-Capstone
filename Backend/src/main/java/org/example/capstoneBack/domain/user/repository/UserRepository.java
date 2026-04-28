package org.example.capstoneBack.domain.user.repository;

import org.example.capstoneBack.common.enums.UserStatus;
import org.example.capstoneBack.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmpNo(String empNo);

    boolean existsByEmpNo(String empNo);

    boolean existsByEmail(String email);

    List<User> findByStatus(UserStatus status);

    @Query("SELECT u FROM User u JOIN u.memberships m WHERE m.scope.scopeId = :scopeId")
    List<User> findByScopeId(@Param("scopeId") Long scopeId);
}
