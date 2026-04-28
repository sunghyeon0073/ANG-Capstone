package org.example.capstoneBack.domain.user.repository;

import org.example.capstoneBack.domain.user.entity.UserTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserTagRepository extends JpaRepository<UserTag, UserTag.UserTagId> {

    List<UserTag> findByUserUserId(Long userId);

    void deleteByUserUserId(Long userId);
}
