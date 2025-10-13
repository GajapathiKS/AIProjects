namespace SpecialPrograms.Api.Models;

public class Assignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public string Status { get; set; } = "Open";
    public string? AssignedTo { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Student? Student { get; set; }
}
