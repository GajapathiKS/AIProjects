namespace SpecialPrograms.Api.Dtos;

public record NeedsAssessmentCreateDto(
    Guid StudentId,
    string AcademicNeeds,
    string SupportServices,
    string InstructionalStrategies,
    string AssessmentTools);

public record NeedsAssessmentUpdateDto(
    string AcademicNeeds,
    string SupportServices,
    string InstructionalStrategies,
    string AssessmentTools);

public record NeedsAssessmentDto(
    Guid Id,
    Guid StudentId,
    string AcademicNeeds,
    string SupportServices,
    string InstructionalStrategies,
    string AssessmentTools,
    DateTime CreatedAt);
