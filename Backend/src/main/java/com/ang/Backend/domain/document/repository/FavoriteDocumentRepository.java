package com.ang.Backend.domain.document.repository;

import com.ang.Backend.domain.document.entity.FavoriteDocument;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface FavoriteDocumentRepository extends JpaRepository<FavoriteDocument, Long> {
    Optional<FavoriteDocument> findByUserAndDocument(User user, DocumentEntity document);
    List<FavoriteDocument> findByUser(User user);
    void deleteByUserAndDocument(User user, DocumentEntity document);
    boolean existsByUserAndDocument(User user, DocumentEntity document);

    Page<FavoriteDocument> findByUserAndDocument_DeletedAtIsNull(User user, Pageable pageable);
    
    void deleteByDocument(DocumentEntity document);
    
    List<FavoriteDocument> findByUserAndDocument_DocIdIn(User user, List<Long> documentIds);
}
