namespace SpecialPrograms.Api.Models;

public class ProgressUpdate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GoalId { get; set; }
    public Goal? Goal { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string Outcome { get; set; } = string.Empty;
    public string EvidenceUrl { get; set; } = string.Empty;
    public string NextAction { get; set; } = string.Empty;
    public string RecordedBy { get; set; } = string.Empty;
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}
