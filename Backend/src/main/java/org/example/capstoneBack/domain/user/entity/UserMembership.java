package org.example.capstoneBack.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.domain.scope.entity.Scope;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_memberships",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "scope_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class UserMembership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "membership_id")
    private Long membershipId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id", nullable = false)
    private Scope scope;

    @Column(name = "joined_at")
    @Builder.Default
    private LocalDateTime joinedAt = LocalDateTime.now();
}
