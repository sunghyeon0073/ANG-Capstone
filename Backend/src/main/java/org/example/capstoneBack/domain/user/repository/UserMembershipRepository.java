package org.example.capstoneBack.domain.user.repository;

import org.example.capstoneBack.domain.user.entity.UserMembership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserMembershipRepository extends JpaRepository<UserMembership, Long> {

    List<UserMembership> findByUserUserId(Long userId);

    List<UserMembership> findByScopeScopeId(Long scopeId);

    Optional<UserMembership> findByUserUserIdAndScopeScopeId(Long userId, Long scopeId);

    boolean existsByUserUserIdAndScopeScopeId(Long userId, Long scopeId);
}
