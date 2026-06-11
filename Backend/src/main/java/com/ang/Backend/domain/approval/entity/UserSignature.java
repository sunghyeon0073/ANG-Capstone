package com.ang.Backend.domain.approval.entity;

import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_signatures")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSignature {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "image_url", nullable = false, length = 1000)
    private String imageUrl;

    @Column(name = "label", length = 100)
    private String label;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
