namespace SpecialPrograms.Api.Dtos;

public record StudentCreateDto(
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string GradeLevel,
    string Campus,
    string GuardianContact,
    string ProgramFocus,
    string LocalId,
    DateTime EnrollmentDate,
    DateTime? NextReviewDate);

public record StudentUpdateDto(
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string GradeLevel,
    string Campus,
    string GuardianContact,
    string ProgramFocus,
    string LocalId,
    DateTime EnrollmentDate,
    DateTime? NextReviewDate);

public record StudentSummaryDto(
    Guid Id,
    string LocalId,
    string FirstName,
    string LastName,
    string GradeLevel,
    string Campus,
    string ProgramFocus,
    DateTime EnrollmentDate,
    DateTime? NextReviewDate,
    int NeedsAssessments,
    int Goals,
    int ActiveGoals);

public record StudentDetailDto(
    Guid Id,
    string LocalId,
    string FirstName,
    string LastName,
    DateTime DateOfBirth,
    string GradeLevel,
    string Campus,
    string GuardianContact,
    string ProgramFocus,
    DateTime EnrollmentDate,
    DateTime? NextReviewDate,
    IEnumerable<NeedsAssessmentDto> NeedsAssessments,
    IEnumerable<GoalDetailDto> Goals);
