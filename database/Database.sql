--DROP TABLE IF EXISTS course_views;
--DROP TABLE IF EXISTS payment_logs;
--DROP TABLE IF EXISTS payments;
--DROP TABLE IF EXISTS notifications;
--DROP TABLE IF EXISTS ai_responses;
--DROP TABLE IF EXISTS ai_requests;
--DROP TABLE IF EXISTS quiz_attempts;
--DROP TABLE IF EXISTS answers;
--DROP TABLE IF EXISTS questions;
--DROP TABLE IF EXISTS quizzes;
--DROP TABLE IF EXISTS enrollments;
--DROP TABLE IF EXISTS lessons;
--DROP TABLE IF EXISTS courses;
--DROP TABLE IF EXISTS refresh_tokens;
--DROP TABLE IF EXISTS users;
--DROP TABLE IF EXISTS roles;
-- =========================
-- ROLES
-- =========================
CREATE TABLE roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(50) NOT NULL
);

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(255),
    role_id INT,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- =========================
-- REFRESH TOKENS
-- =========================
CREATE TABLE refresh_tokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    token NVARCHAR(500),
    expires_at DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================
-- COURSES (ADD SLOT + VERSION)
-- =========================
CREATE TABLE courses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(255),
    description NVARCHAR(MAX),
    instructor_id INT,
    price DECIMAL(10,2) DEFAULT 0,
    status NVARCHAR(50) DEFAULT 'draft',
    available_slots INT DEFAULT 100,
    version INT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (instructor_id) REFERENCES users(id)
);

-- =========================
-- LESSONS
-- =========================
CREATE TABLE lessons (
    id INT IDENTITY(1,1) PRIMARY KEY,
    course_id INT,
    title NVARCHAR(255),
    content NVARCHAR(MAX),
    order_index INT,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- =========================
-- ENROLLMENTS (ANTI DUPLICATE)
-- =========================
CREATE TABLE enrollments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    course_id INT,
    enrolled_at DATETIME DEFAULT GETDATE(),
    progress INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    CONSTRAINT unique_user_course UNIQUE (user_id, course_id)
);

-- =========================
-- QUIZZES
-- =========================
CREATE TABLE quizzes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    course_id INT,
    lesson_id INT,
    title NVARCHAR(255),
    created_by NVARCHAR(50),
    created_by_type NVARCHAR(50), -- AI / instructor
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

-- =========================
-- QUESTIONS
-- =========================
CREATE TABLE questions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    quiz_id INT,
    content NVARCHAR(MAX),
    type NVARCHAR(50),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

-- =========================
-- ANSWERS
-- =========================
CREATE TABLE answers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    question_id INT,
    content NVARCHAR(MAX),
    is_correct BIT,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- =========================
-- QUIZ ATTEMPTS
-- =========================
CREATE TABLE quiz_attempts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    quiz_id INT,
    score INT,
    submitted_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

-- =========================
-- AI REQUESTS (ADD STATUS)
-- =========================
CREATE TABLE ai_requests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    type NVARCHAR(50),
    input_text NVARCHAR(MAX),
    status NVARCHAR(50) DEFAULT 'pending',
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================
-- AI RESPONSES
-- =========================
CREATE TABLE ai_responses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    request_id INT,
    response_text NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (request_id) REFERENCES ai_requests(id)
);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE notifications (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    title NVARCHAR(255),
    content NVARCHAR(MAX),
    type NVARCHAR(50),
    is_read BIT DEFAULT 0,
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- =========================
-- PAYMENTS (CORE)
-- =========================
CREATE TABLE payments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    amount DECIMAL(10,2),
    status NVARCHAR(50), -- pending, success, failed
    payment_method NVARCHAR(50),
    transaction_id NVARCHAR(255) UNIQUE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- =========================
-- PAYMENT LOGS
-- =========================
CREATE TABLE payment_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    payment_id INT,
    status NVARCHAR(50),
    message NVARCHAR(MAX),
    created_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (payment_id) REFERENCES payments(id)
);

-- =========================
-- ANALYTICS
-- =========================
CREATE TABLE course_views (
    id INT IDENTITY(1,1) PRIMARY KEY,
    course_id INT,
    views_count INT DEFAULT 0,
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- =========================
-- INDEX (PERFORMANCE)
-- =========================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_courses_instructor ON courses(instructor_id);
CREATE INDEX idx_lessons_course ON lessons(course_id);
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_quiz_lesson ON quizzes(lesson_id);