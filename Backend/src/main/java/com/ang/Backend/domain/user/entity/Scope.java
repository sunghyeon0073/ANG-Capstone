package com.ang.Backend.domain.user.entity;

import com.ang.Backend.common.enums.ScopeType;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "scopes")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Scope {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "scope_id")
    private Integer scopeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope_type", nullable = false)
    private ScopeType scopeType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_scope_id")
    private Scope parentScope;

    @Column(name = "scope_code", unique = true, nullable = false, length = 50)
    private String scopeCode;

    @Column(name = "name", nullable = false, length = 100)
    private String name;
}
