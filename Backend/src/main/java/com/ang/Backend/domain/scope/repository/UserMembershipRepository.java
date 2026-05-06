package com.ang.Backend.domain.scope.repository;

import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserMembershipRepository extends JpaRepository<UserMembership, Integer> {
    List<UserMembership> findByUser(User user);
    List<UserMembership> findByScope(Scope scope);
    Optional<UserMembership> findByUserAndScope(User user, Scope scope);
}
