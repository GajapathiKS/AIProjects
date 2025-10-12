namespace SpecialPrograms.Api.Dtos;

public record GoalCreateDto(
    Guid StudentId,
    string Description,
    string Category,
    string Measurement,
    string Owner,
    DateTime TargetDate);

public record GoalUpdateDto(
    string Description,
    string Category,
    string Measurement,
    string Owner,
    DateTime TargetDate,
    string Status);

public record GoalDto(
    Guid Id,
    Guid StudentId,
    string Description,
    string Category,
    string Measurement,
    string Owner,
    DateTime TargetDate,
    string Status);

public record GoalDetailDto(
    Guid Id,
    Guid StudentId,
    string Description,
    string Category,
    string Measurement,
    string Owner,
    DateTime TargetDate,
    string Status,
    IEnumerable<ProgressUpdateDto> ProgressUpdates);

public record GoalStatusUpdateDto(string Status);

public record ProgressUpdateCreateDto(
    Guid GoalId,
    string Summary,
    string Outcome,
    string EvidenceUrl,
    string NextAction,
    string RecordedBy);

public record ProgressUpdateDto(
    Guid Id,
    Guid GoalId,
    string Summary,
    string Outcome,
    string EvidenceUrl,
    string NextAction,
    string RecordedBy,
    DateTime RecordedAt);
