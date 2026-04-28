package org.example.capstoneBack.domain.role.repository;

import org.example.capstoneBack.domain.role.entity.AccessPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccessPolicyRepository extends JpaRepository<AccessPolicy, Long> {

    Optional<AccessPolicy> findByTargetResource(String targetResource);

    List<AccessPolicy> findByMinRoleLevelLessThanEqualOrderByPriorityDesc(int roleLevel);
}
