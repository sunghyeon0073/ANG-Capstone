package org.example.capstoneBack.domain.role.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;

@Entity
@Table(name = "policy_required_tags")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@IdClass(PolicyRequiredTag.PolicyRequiredTagId.class)
public class PolicyRequiredTag {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "policy_id", nullable = false)
    private AccessPolicy policy;

    @Id
    @Column(name = "tag_name", nullable = false, length = 50)
    private String tagName;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class PolicyRequiredTagId implements Serializable {
        private Long policy;
        private String tagName;
    }
}
