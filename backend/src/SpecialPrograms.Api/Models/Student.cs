namespace SpecialPrograms.Api.Models;

public class Student
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string LocalId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public string GradeLevel { get; set; } = string.Empty;
    public string Campus { get; set; } = string.Empty;
    public string GuardianContact { get; set; } = string.Empty;
    public string ProgramFocus { get; set; } = string.Empty;
    public DateTime EnrollmentDate { get; set; } = DateTime.UtcNow.Date;
    public DateTime? NextReviewDate { get; set; }
    public ICollection<NeedsAssessment> NeedsAssessments { get; set; } = new List<NeedsAssessment>();
    public ICollection<Goal> Goals { get; set; } = new List<Goal>();
}
