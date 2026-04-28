package org.example.capstoneBack.domain.scope.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.common.enums.ScopeType;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "scopes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Scope {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "scope_id")
    private Long scopeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false)
    private ScopeType scopeType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_scope_id")
    private Scope parentScope;

    @OneToMany(mappedBy = "parentScope", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Scope> childScopes = new ArrayList<>();

    @Column(name = "scope_code", unique = true, nullable = false, length = 50)
    private String scopeCode;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    public void update(String name) {
        this.name = name;
    }
}
