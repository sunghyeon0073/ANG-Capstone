package org.example.capstoneBack.domain.role.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.common.enums.EffectType;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "access_policies")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AccessPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id")
    private Long policyId;

    @Column(name = "target_resource", nullable = false, length = 255)
    private String targetResource;

    @Enumerated(EnumType.STRING)
    @Column(name = "effect", nullable = false)
    private EffectType effect;

    @Column(name = "min_role_level")
    private Integer minRoleLevel;

    @Column(name = "priority")
    @Builder.Default
    private int priority = 0;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "policy", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PolicyRequiredTag> requiredTags = new ArrayList<>();
}
