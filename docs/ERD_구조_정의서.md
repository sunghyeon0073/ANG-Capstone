# 📊 ANG 시스템 ERD 구조 정의서

## 1. 개요
본 문서는 ANG(Admin Next Generation) 시스템의 데이터베이스 구조를 정의합니다. JPA 엔티티 분석을 바탕으로 작성되었습니다.

---

## 2. 테이블 상세 정보

### 👤 2.1 사용자 및 권한 (User & Auth)
#### [users] - 사용자 기본 정보
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| user_id | INT (PK) | 고유 식별자 |
| emp_no | VARCHAR(50) | 사번 (Unique) |
| password_hash | VARCHAR | 비밀번호 해시 |
| name | VARCHAR(50) | 성명 |
| email | VARCHAR(100) | 이메일 |
| phone | VARCHAR(20) | 연락처 |
| birthdate | DATE | 생년월일 |
| profile_image_url | VARCHAR | 프로필 이미지 경로 |
| position | VARCHAR(50) | 대표 직급 |
| status | ENUM | 계정 상태 (PENDING, ACTIVE, REJECTED) |
| created_at | DATETIME | 가입 신청일 |
| deleted_at | DATETIME | 퇴사/삭제일 |

#### [roles] - 시스템 권한 정의
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| role_id | INT (PK) | 권한 식별자 |
| name | VARCHAR(50) | 권한명 (ROLE_USER, ROLE_ADMIN 등) |
| role_level | INT | 권한 레벨 (1, 50, 100) |
| description | VARCHAR | 권한 설명 |

---

### 🏢 2.2 조직 체계 (Organization)
#### [scopes] - 조직(부서/팀) 정보
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| scope_id | INT (PK) | 조직 식별자 |
| scope_type | ENUM | 조직 타입 (COMPANY, DEPT, TEAM) |
| parent_scope_id | INT (FK) | 상위 조직 ID (Self-reference) |
| scope_code | VARCHAR(50) | 부서 고유 코드 |
| name | VARCHAR(100) | 부서명 |

#### [user_memberships] - 사용자 소속 정보 (다중 소속)
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| membership_id | INT (PK) | 소속 식별자 |
| user_id | INT (FK) | 사용자 ID |
| scope_id | INT (FK) | 부서 ID |
| position | VARCHAR(50) | 해당 부서에서의 직급 |
| joined_at | DATETIME | 부서 배치일 |

---

### 📂 2.3 문서 및 파일 (Document & File)
#### [documents] - 문서 메타데이터
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| doc_id | BIGINT (PK) | 문서 식별자 |
| title | VARCHAR | 문서 제목 |
| original_content | LONGTEXT | 웹 뷰어용 텍스트 컨텐츠 |
| ai_summary | TEXT | AI 요약 결과 |
| status | ENUM | 문서 상태 (DRAFT, PUBLISHED) |
| file_id | BIGINT (FK) | 원본 파일 식별자 |
| preview_file_id | BIGINT (FK) | 미리보기용 PDF 식별자 |
| owner_id | INT (FK) | 작성자 ID |
| scope_id | INT (FK) | 소속 부서 ID (공유 범위) |
| is_ai_generated | BOOLEAN | AI 생성 여부 |

#### [file_items] - 물리 파일 정보
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| id | BIGINT (PK) | 파일 식별자 |
| file_name | VARCHAR | 원본 파일명 |
| file_path | VARCHAR | S3 또는 로컬 저장 경로 |
| file_size | BIGINT | 파일 크기 |
| file_type | VARCHAR | MIME 타입 |

---

### 📧 2.4 협업 도구 (Collaboration)
#### [mails] - 메일 기본 정보
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| mail_id | BIGINT (PK) | 메일 식별자 |
| sender_id | INT (FK) | 발신자 ID |
| title | VARCHAR(200) | 제목 |
| body | LONGTEXT | 본문 내용 |
| status | ENUM | 상태 (DRAFT, SENT, CANCELLED) |
| sent_at | DATETIME | 발송 시각 |

#### [schedules] - 일정 관리
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| schedule_id | BIGINT (PK) | 일정 식별자 |
| owner_id | INT (FK) | 소유자 ID |
| start_date | DATE | 시작일 |
| end_date | DATE | 종료일 |
| title | VARCHAR(200) | 일정명 |
| start_time | TIME | 시작 시간 |
| end_time | TIME | 종료 시간 |
| description | TEXT | 상세 설명 |

#### [chat_messages] - 채팅 메시지
| 컬럼명 | 타입 | 설명 |
| :--- | :--- | :--- |
| id | BIGINT (PK) | 메시지 식별자 |
| room_id | BIGINT (FK) | 채팅방 ID |
| sender_id | INT (FK) | 발신자 ID |
| content | TEXT | 메시지 내용 |
| message_type | ENUM | 타입 (TEXT, FILE, IMAGE) |
| sent_at | DATETIME | 전송 시각 |

---

## 3. 핵심 관계 요약
1. **User - Scope**: `UserMembership`을 통한 M:N 관계 (한 사용자가 여러 부서에 소속 가능).
2. **Scope - Scope**: `parent_scope_id`를 통한 트리 구조 계층 관리.
3. **Document - FileItem**: 1:1 관계 (문서 하나에 하나의 물리 파일 대응).
4. **Mail - User**: 발신자(`sender_id`)와 수신자(`mail_recipients`)를 통한 관계 형성.
