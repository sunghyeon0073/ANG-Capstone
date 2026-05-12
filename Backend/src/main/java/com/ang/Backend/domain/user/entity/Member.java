package com.ang.Backend.domain.user.entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "members")
@Getter
@NoArgsConstructor
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, length = 20)
    private String empNo;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(length = 200)
    private String password;

    @Builder
    public Member(String empNo, String name, String email, String role, String password) {
        this.empNo = empNo;
        this.name = name;
        this.email = email;
        this.role = role;
        this.password = password;
    }

    public void updateCredentials(String empNo, String password) {
        this.empNo = empNo;
        this.password = password;
    }
}
