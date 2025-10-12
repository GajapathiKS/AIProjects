namespace SpecialPrograms.Api.Models;

public class NeedsAssessment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public string AcademicNeeds { get; set; } = string.Empty;
    public string SupportServices { get; set; } = string.Empty;
    public string InstructionalStrategies { get; set; } = string.Empty;
    public string AssessmentTools { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
