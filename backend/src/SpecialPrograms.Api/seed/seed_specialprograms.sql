-- seed_specialprograms.sql
-- SQL Server script to create SpecialProgramsDb schema and seed test data
-- Paste this into SSMS or run via sqlcmd. Adjust filepaths/owners as needed.

SET NOCOUNT ON;

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SpecialProgramsDb')
BEGIN
    PRINT 'Creating database SpecialProgramsDb';
    CREATE DATABASE [SpecialProgramsDb];
END
GO

USE [SpecialProgramsDb];
GO

-- Create Users table
IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY,
        Username NVARCHAR(450) NOT NULL,
        PasswordHash NVARCHAR(MAX) NOT NULL,
        Role NVARCHAR(MAX) NOT NULL
    );
    CREATE UNIQUE INDEX UX_Users_Username ON dbo.Users(Username);
END
GO

-- Create Students table
IF OBJECT_ID('dbo.Students', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Students (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Students PRIMARY KEY,
        LocalId NVARCHAR(450) NOT NULL,
        FirstName NVARCHAR(MAX) NOT NULL,
        LastName NVARCHAR(MAX) NOT NULL,
        DateOfBirth DATETIME2 NOT NULL,
        GradeLevel NVARCHAR(MAX) NOT NULL,
        Campus NVARCHAR(MAX) NOT NULL,
        GuardianContact NVARCHAR(MAX) NOT NULL,
        ProgramFocus NVARCHAR(MAX) NOT NULL,
        EnrollmentDate DATETIME2 NOT NULL,
        NextReviewDate DATETIME2 NULL
    );
    CREATE UNIQUE INDEX UX_Students_LocalId ON dbo.Students(LocalId);
END
GO

-- Create NeedsAssessments table
IF OBJECT_ID('dbo.NeedsAssessments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.NeedsAssessments (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_NeedsAssessments PRIMARY KEY,
        StudentId UNIQUEIDENTIFIER NOT NULL,
        AcademicNeeds NVARCHAR(MAX) NOT NULL,
        SupportServices NVARCHAR(MAX) NOT NULL,
        InstructionalStrategies NVARCHAR(MAX) NOT NULL,
        AssessmentTools NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 NOT NULL,
        CONSTRAINT FK_NeedsAssessments_Students FOREIGN KEY (StudentId) REFERENCES dbo.Students(Id) ON DELETE CASCADE
    );
END
GO

-- Create Goals table
IF OBJECT_ID('dbo.Goals', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Goals (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Goals PRIMARY KEY,
        StudentId UNIQUEIDENTIFIER NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        Category NVARCHAR(MAX) NOT NULL,
        Measurement NVARCHAR(MAX) NOT NULL,
        Owner NVARCHAR(MAX) NOT NULL,
        TargetDate DATETIME2 NOT NULL,
        Status NVARCHAR(MAX) NOT NULL,
        CONSTRAINT FK_Goals_Students FOREIGN KEY (StudentId) REFERENCES dbo.Students(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_Goals_StudentId ON dbo.Goals(StudentId);
END
GO

-- Create ProgressUpdates table
IF OBJECT_ID('dbo.ProgressUpdates', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProgressUpdates (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ProgressUpdates PRIMARY KEY,
        GoalId UNIQUEIDENTIFIER NOT NULL,
        Summary NVARCHAR(MAX) NOT NULL,
        Outcome NVARCHAR(MAX) NOT NULL,
        EvidenceUrl NVARCHAR(MAX) NOT NULL,
        NextAction NVARCHAR(MAX) NOT NULL,
        RecordedBy NVARCHAR(MAX) NOT NULL,
        RecordedAt DATETIME2 NOT NULL,
        CONSTRAINT FK_ProgressUpdates_Goals FOREIGN KEY (GoalId) REFERENCES dbo.Goals(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ProgressUpdates_GoalId ON dbo.ProgressUpdates(GoalId);
END
GO

-- Create __EFMigrationsHistory table (minimal) so EF won't try to reapply migrations if you later switch to migrations
IF OBJECT_ID('dbo.__EFMigrationsHistory', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.__EFMigrationsHistory (
        MigrationId NVARCHAR(150) NOT NULL CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY,
        ProductVersion NVARCHAR(32) NOT NULL
    );
END
GO

-- Insert sample data
PRINT 'Inserting sample data...';

DECLARE @adminId UNIQUEIDENTIFIER;
DECLARE @studentId UNIQUEIDENTIFIER;
DECLARE @needsId UNIQUEIDENTIFIER = NEWID();
DECLARE @goalId UNIQUEIDENTIFIER = NEWID();
DECLARE @progressId UNIQUEIDENTIFIER = NEWID();

-- Preserve existing admin/student IDs if already present to keep FK relationships stable
SELECT @adminId = Id FROM dbo.Users WHERE Username = N'admin';
IF @adminId IS NULL SET @adminId = NEWID();

SELECT @studentId = Id FROM dbo.Students WHERE LocalId = N'LOCAL-1001';
IF @studentId IS NULL SET @studentId = NEWID();

-- Store a bcrypt hash for the seeded admin so the app can authenticate with the
-- password specified in appsettings.json (ChangeMe123!).
-- Generated with BCrypt and matches the password: ChangeMe123!
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin')
BEGIN
    INSERT INTO dbo.Users (Id, Username, PasswordHash, Role)
    VALUES (@adminId, N'admin', N'$2a$11$.BIBMDlimg6F6BA3178wle6DEWtOagTxL2BeF6hItBD.hB3FO0oUq', N'Admin');
END

-- If an admin row exists but stores a plaintext password (or non-bcrypt value), upgrade it
IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'admin' AND (
    PasswordHash NOT LIKE '$2a$%' AND PasswordHash NOT LIKE '$2b$%' AND PasswordHash NOT LIKE '$2y$%'))
BEGIN
    PRINT 'Upgrading plaintext admin password to bcrypt hash';
    UPDATE dbo.Users
    SET PasswordHash = N'$2a$11$.BIBMDlimg6F6BA3178wle6DEWtOagTxL2BeF6hItBD.hB3FO0oUq'
    WHERE Username = N'admin';
END

IF NOT EXISTS (SELECT 1 FROM dbo.Students WHERE LocalId = N'LOCAL-1001')
BEGIN
    INSERT INTO dbo.Students (Id, LocalId, FirstName, LastName, DateOfBirth, GradeLevel, Campus, GuardianContact, ProgramFocus, EnrollmentDate, NextReviewDate)
    VALUES (@studentId, N'LOCAL-1001', N'Jane', N'Doe', '2010-05-12', N'5', N'Central Elementary', N'(555) 123-4567', N'Math Support', '2025-08-20', NULL);
END

IF NOT EXISTS (SELECT 1 FROM dbo.NeedsAssessments WHERE StudentId = @studentId AND AcademicNeeds = N'Needs extra math support')
BEGIN
    INSERT INTO dbo.NeedsAssessments (Id, StudentId, AcademicNeeds, SupportServices, InstructionalStrategies, AssessmentTools, CreatedAt)
    VALUES (@needsId, @studentId, N'Needs extra math support', N'Tutoring', N'Differentiated instruction', N'Formative quizzes', SYSUTCDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM dbo.Goals WHERE StudentId = @studentId AND Description = N'Improve math fluency')
BEGIN
    INSERT INTO dbo.Goals (Id, StudentId, Description, Category, Measurement, Owner, TargetDate, Status)
    VALUES (@goalId, @studentId, N'Improve math fluency', N'Academic', N'Mastery of grade-level standards', N'Mr. Smith', DATEADD(month, 6, SYSUTCDATETIME()), N'Planned');
END

-- If a goal already exists, use its Id for progress link
SELECT @goalId = Id FROM dbo.Goals WHERE StudentId = @studentId AND Description = N'Improve math fluency';
IF @goalId IS NULL SET @goalId = NEWID();

IF NOT EXISTS (SELECT 1 FROM dbo.ProgressUpdates WHERE GoalId = @goalId AND Summary = N'Initial goal created')
BEGIN
    INSERT INTO dbo.ProgressUpdates (Id, GoalId, Summary, Outcome, EvidenceUrl, NextAction, RecordedBy, RecordedAt)
    VALUES (@progressId, @goalId, N'Initial goal created', N'Not started', N'', N'Begin targeted instruction', N'admin', SYSUTCDATETIME());
END

-- Ensure @progressId references an existing progress if present
SELECT @progressId = Id FROM dbo.ProgressUpdates WHERE GoalId = @goalId AND Summary = N'Initial goal created';
IF @progressId IS NULL SET @progressId = NEWID();

-- Insert a migration history row matching the initial migration id and EF product version
-- Adjust the MigrationId if you want to reflect actual migration ids; using the project's initial migration id below
IF NOT EXISTS (SELECT 1 FROM dbo.__EFMigrationsHistory WHERE MigrationId = N'20251012163617_InitialCreate')
BEGIN
    INSERT INTO dbo.__EFMigrationsHistory (MigrationId, ProductVersion)
    VALUES (N'20251012163617_InitialCreate', N'8.0.3');
END
GO

PRINT 'Seed data applied successfully.';
 
/*
  Additional bulk test data for Playwright: multiple users, students, needs assessments, goals, and progress updates.
  All inserts are idempotent: they check for Username or LocalId or specific descriptions before inserting.
  Seeded user passwords use the same bcrypt hash as admin (ChangeMe123!).
*/

PRINT 'Inserting additional test users...';

DECLARE @hash NVARCHAR(MAX) = N'$2a$11$.BIBMDlimg6F6BA3178wle6DEWtOagTxL2BeF6hItBD.hB3FO0oUq';

-- Additional application users useful for Playwright flows
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'qa_tester')
    INSERT INTO dbo.Users (Id, Username, PasswordHash, Role)
    VALUES (NEWID(), N'qa_tester', @hash, N'QA');

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'teacher_sam')
    INSERT INTO dbo.Users (Id, Username, PasswordHash, Role)
    VALUES (NEWID(), N'teacher_sam', @hash, N'Teacher');

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'case_manager_amy')
    INSERT INTO dbo.Users (Id, Username, PasswordHash, Role)
    VALUES (NEWID(), N'case_manager_amy', @hash, N'CaseManager');

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'viewer_bob')
    INSERT INTO dbo.Users (Id, Username, PasswordHash, Role)
    VALUES (NEWID(), N'viewer_bob', @hash, N'Viewer');

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = N'dev_john')
    INSERT INTO dbo.Users (Id, Username, PasswordHash, Role)
    VALUES (NEWID(), N'dev_john', @hash, N'Developer');

PRINT 'Inserting bulk students and related records...';

-- Helper: convenience to insert a student and couple of associated records in an idempotent way

-- Student list (LocalId, FirstName, LastName, DOB, Grade, Campus, Focus)
DECLARE @Students TABLE (LocalId NVARCHAR(50), FirstName NVARCHAR(100), LastName NVARCHAR(100), DOB DATETIME2, Grade NVARCHAR(10), Campus NVARCHAR(200), Focus NVARCHAR(200), Enrollment DATETIME2);
INSERT INTO @Students (LocalId, FirstName, LastName, DOB, Grade, Campus, Focus, Enrollment)
VALUES
  (N'LOCAL-1002', N'Juan', N'Perez', '2012-03-04', N'3', N'North Elementary', N'Reading Intervention', '2024-09-01'),
  (N'LOCAL-1003', N'Aaliyah', N'Harris', '2011-07-19', N'4', N'East Elementary', N'English Learner Support', '2023-08-20'),
  (N'LOCAL-1004', N'Liam', N'Johnson', '2010-11-02', N'5', N'Central Elementary', N'Math Support', '2025-01-10'),
  (N'LOCAL-1005', N'Olivia', N'Garcia', '2013-02-14', N'2', N'South Elementary', N'Behavioral Support', '2024-01-05'),
  (N'LOCAL-1006', N'Noah', N'Martinez', '2009-06-30', N'6', N'West Middle', N'Study Skills', '2022-09-01'),
  (N'LOCAL-1007', N'Emma', N'Lee', '2014-12-08', N'1', N'North Elementary', N'Speech Therapy', '2025-03-12'),
  (N'LOCAL-1008', N'Mason', N'Clark', '2012-10-21', N'3', N'East Elementary', N'Reading Intervention', '2023-09-10'),
  (N'LOCAL-1009', N'Sophia', N'Walker', '2011-05-05', N'4', N'Central Elementary', N'Gifted Support', '2024-02-14'),
  (N'LOCAL-1010', N'Lucas', N'Wright', '2010-08-18', N'5', N'West Middle', N'Math Acceleration', '2023-11-01'),
  (N'LOCAL-1011', N'Mia', N'Lopez', '2013-04-22', N'2', N'South Elementary', N'Language Support', '2024-06-20');

DECLARE @sLocalId NVARCHAR(50), @sFirst NVARCHAR(100), @sLast NVARCHAR(100), @sDob DATETIME2, @sGrade NVARCHAR(10), @sCampus NVARCHAR(200), @sFocus NVARCHAR(200), @sEnroll DATETIME2;
DECLARE students_cursor CURSOR FOR SELECT LocalId, FirstName, LastName, DOB, Grade, Campus, Focus, Enrollment FROM @Students;
OPEN students_cursor;
FETCH NEXT FROM students_cursor INTO @sLocalId, @sFirst, @sLast, @sDob, @sGrade, @sCampus, @sFocus, @sEnroll;
WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @sid UNIQUEIDENTIFIER = (SELECT Id FROM dbo.Students WHERE LocalId = @sLocalId);
    IF @sid IS NULL
    BEGIN
        SET @sid = NEWID();
        INSERT INTO dbo.Students (Id, LocalId, FirstName, LastName, DateOfBirth, GradeLevel, Campus, GuardianContact, ProgramFocus, EnrollmentDate, NextReviewDate)
        VALUES (@sid, @sLocalId, @sFirst, @sLast, @sDob, @sGrade, @sCampus, N'(000) 000-0000', @sFocus, @sEnroll, DATEADD(month, 3, @sEnroll));
    END

    -- Add a needs assessment if not present
    IF NOT EXISTS (SELECT 1 FROM dbo.NeedsAssessments WHERE StudentId = @sid AND AcademicNeeds LIKE '%support%')
    BEGIN
        INSERT INTO dbo.NeedsAssessments (Id, StudentId, AcademicNeeds, SupportServices, InstructionalStrategies, AssessmentTools, CreatedAt)
        VALUES (NEWID(), @sid, CONCAT(N'General ', @sFocus), N'In-class support; small groups', N'Targeted interventions', N'Checklists; observations', SYSUTCDATETIME());
    END

    -- Add two goals per student if missing (one academic, one social/behavioral)
    IF NOT EXISTS (SELECT 1 FROM dbo.Goals WHERE StudentId = @sid AND Description = N'Increase reading comprehension by one grade level')
    BEGIN
        INSERT INTO dbo.Goals (Id, StudentId, Description, Category, Measurement, Owner, TargetDate, Status)
        VALUES (NEWID(), @sid, N'Increase reading comprehension by one grade level', N'Academic', N'Running records; comprehension tasks', N'teacher_sam', DATEADD(month, 6, SYSUTCDATETIME()), N'InProgress');
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Goals WHERE StudentId = @sid AND Description = N'Reduce disruptive incidents to fewer than 2/month')
    BEGIN
        INSERT INTO dbo.Goals (Id, StudentId, Description, Category, Measurement, Owner, TargetDate, Status)
        VALUES (NEWID(), @sid, N'Reduce disruptive incidents to fewer than 2/month', N'Behavior', N'Office referrals count', N'case_manager_amy', DATEADD(month, 3, SYSUTCDATETIME()), N'Planned');
    END

    -- Add one progress update for each goal
    DECLARE @gId UNIQUEIDENTIFIER;
    DECLARE goals_cursor CURSOR FOR SELECT Id FROM dbo.Goals WHERE StudentId = @sid;
    OPEN goals_cursor;
    FETCH NEXT FROM goals_cursor INTO @gId;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.ProgressUpdates WHERE GoalId = @gId AND RecordedBy = N'qa_tester')
        BEGIN
            INSERT INTO dbo.ProgressUpdates (Id, GoalId, Summary, Outcome, EvidenceUrl, NextAction, RecordedBy, RecordedAt)
            VALUES (NEWID(), @gId, N'Weekly check-in', N'Making progress', N'', N'Continue interventions', N'qa_tester', SYSUTCDATETIME());
        END
        FETCH NEXT FROM goals_cursor INTO @gId;
    END
    CLOSE goals_cursor;
    DEALLOCATE goals_cursor;

    FETCH NEXT FROM students_cursor INTO @sLocalId, @sFirst, @sLast, @sDob, @sGrade, @sCampus, @sFocus, @sEnroll;
END
CLOSE students_cursor;
DEALLOCATE students_cursor;

PRINT 'Bulk seed completed.';

-- Create Assignments table
IF OBJECT_ID('dbo.Assignments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Assignments (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Assignments PRIMARY KEY,
        StudentId UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(MAX) NOT NULL,
        Description NVARCHAR(MAX) NOT NULL,
        DueDate DATETIME2 NULL,
        Status NVARCHAR(64) NOT NULL,
        AssignedTo NVARCHAR(256) NULL,
        CreatedAt DATETIME2 NOT NULL,
        CONSTRAINT FK_Assignments_Students FOREIGN KEY (StudentId) REFERENCES dbo.Students(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_Assignments_StudentId ON dbo.Assignments(StudentId);
END
GO

PRINT 'Seeding assignments for selected students...';

-- Seed 3 assignments for student LOCAL-1003 (example: Aaliyah Harris)
DECLARE @s3 UNIQUEIDENTIFIER = (SELECT TOP 1 Id FROM dbo.Students WHERE LocalId = N'LOCAL-1003');
IF @s3 IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.Assignments WHERE StudentId = @s3 AND Title = N'Reading Log Week 1')
        INSERT INTO dbo.Assignments (Id, StudentId, Title, Description, DueDate, Status, AssignedTo, CreatedAt)
        VALUES (NEWID(), @s3, N'Reading Log Week 1', N'Read 20 minutes each day and log summary.', DATEADD(day, 7, SYSUTCDATETIME()), N'Open', N'teacher_sam', SYSUTCDATETIME());
    IF NOT EXISTS (SELECT 1 FROM dbo.Assignments WHERE StudentId = @s3 AND Title = N'Vocabulary Practice')
        INSERT INTO dbo.Assignments (Id, StudentId, Title, Description, DueDate, Status, AssignedTo, CreatedAt)
        VALUES (NEWID(), @s3, N'Vocabulary Practice', N'Practice 10 new words; use in sentences.', DATEADD(day, 10, SYSUTCDATETIME()), N'Open', N'teacher_sam', SYSUTCDATETIME());
    IF NOT EXISTS (SELECT 1 FROM dbo.Assignments WHERE StudentId = @s3 AND Title = N'Listening Exercise')
        INSERT INTO dbo.Assignments (Id, StudentId, Title, Description, DueDate, Status, AssignedTo, CreatedAt)
        VALUES (NEWID(), @s3, N'Listening Exercise', N'Complete listening comprehension practice.', DATEADD(day, 5, SYSUTCDATETIME()), N'Open', N'case_manager_amy', SYSUTCDATETIME());
END
GO

PRINT 'Generating 1,000 MCP test students and related records...';

-- Generate 1,000 students with LocalId MCP-0001 .. MCP-1000
;WITH nums AS (
    SELECT TOP (1000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
    FROM sys.all_objects a CROSS JOIN sys.all_columns b
), toInsert AS (
    SELECT
        n,
        'MCP-' + RIGHT('0000' + CAST(n AS varchar(4)), 4) AS LocalId,
        'TestFirst' + CAST(n AS varchar(10)) AS FirstName,
        'TestLast' + CAST(n AS varchar(10)) AS LastName,
        DATEADD(day, - (365 * 8) - n, SYSUTCDATETIME()) AS DateOfBirth,
        CAST((n % 12) + 1 AS nvarchar(10)) AS GradeLevel,
        'MCP Campus ' + CAST((n % 50) + 1 AS nvarchar(10)) AS Campus,
        CONVERT(datetime2, DATEADD(day, - (n % 1000), SYSUTCDATETIME())) AS EnrollmentDate
    FROM nums
)
-- Insert only students that don't already exist by LocalId
INSERT INTO dbo.Students (Id, LocalId, FirstName, LastName, DateOfBirth, GradeLevel, Campus, GuardianContact, ProgramFocus, EnrollmentDate, NextReviewDate)
SELECT NEWID(), t.LocalId, t.FirstName, t.LastName, t.DateOfBirth, t.GradeLevel, t.Campus, N'(000) 000-0000', N'General MCP Support', t.EnrollmentDate, DATEADD(month, 3, t.EnrollmentDate)
FROM toInsert t
LEFT JOIN dbo.Students s ON s.LocalId = t.LocalId
WHERE s.Id IS NULL;

-- Add NeedsAssessments for MCP students if missing
INSERT INTO dbo.NeedsAssessments (Id, StudentId, AcademicNeeds, SupportServices, InstructionalStrategies, AssessmentTools, CreatedAt)
SELECT NEWID(), s.Id, CONCAT(N'MCP support: ', s.LocalId), N'In-class small groups; tutoring', N'Targeted instruction', N'Observations; benchmarks', SYSUTCDATETIME()
FROM dbo.Students s
LEFT JOIN dbo.NeedsAssessments na ON na.StudentId = s.Id
WHERE s.LocalId LIKE N'MCP-%' AND na.StudentId IS NULL;

-- Add a standard MCP goal per student if missing
INSERT INTO dbo.Goals (Id, StudentId, Description, Category, Measurement, Owner, TargetDate, Status)
SELECT NEWID(), s.Id, N'MCP Goal: Improve foundational skills', N'Academic', N'Grade-level benchmarks', N'teacher_sam', DATEADD(month, 6, SYSUTCDATETIME()), N'Planned'
FROM dbo.Students s
LEFT JOIN dbo.Goals g ON g.StudentId = s.Id AND g.Description = N'MCP Goal: Improve foundational skills'
WHERE s.LocalId LIKE N'MCP-%' AND g.Id IS NULL;

-- Add one progress update per MCP goal if missing
INSERT INTO dbo.ProgressUpdates (Id, GoalId, Summary, Outcome, EvidenceUrl, NextAction, RecordedBy, RecordedAt)
SELECT NEWID(), g.Id, N'MCP initial progress', N'Baseline established', N'', N'Start interventions', N'qa_tester', SYSUTCDATETIME()
FROM dbo.Goals g
LEFT JOIN dbo.ProgressUpdates p ON p.GoalId = g.Id AND p.RecordedBy = N'qa_tester'
WHERE g.Description = N'MCP Goal: Improve foundational skills' AND p.Id IS NULL;

PRINT '1,000 MCP test students generation complete.';
