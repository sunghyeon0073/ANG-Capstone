package com.ang.Backend.domain.document.repository;

import com.ang.Backend.domain.document.entity.Document;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Integer> {
    List<Document> findByOwnerOrderByCreatedAtDesc(User owner);
}
