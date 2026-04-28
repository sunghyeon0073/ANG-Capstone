package org.example.capstoneBack.domain.user.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@NoArgsConstructor
public class UserUpdateRequest {

    private String name;
    private String email;
    private String phone;
    private LocalDate birthdate;
    private String profileImageUrl;
}
