namespace SpecialPrograms.Api.Models;

public class Goal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Student? Student { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = "Academic";
    public string Measurement { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public DateTime TargetDate { get; set; }
    public string Status { get; set; } = "Planned";
    public ICollection<ProgressUpdate> ProgressUpdates { get; set; } = new List<ProgressUpdate>();
}
