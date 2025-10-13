using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Models;

namespace SpecialPrograms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AssignmentsController(ApplicationDbContext db) : ControllerBase
{
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<IEnumerable<Assignment>>> GetForStudent(Guid studentId)
    {
        var items = await db.Assignments.Where(a => a.StudentId == studentId)
            .OrderBy(a => a.DueDate ?? DateTime.MaxValue)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Assignment>> Get(Guid id)
    {
        var entity = await db.Assignments.FindAsync(id);
        return entity is null ? NotFound() : Ok(entity);
    }

    public record CreateAssignmentDto(Guid StudentId, string Title, string? Description, DateTime? DueDate, string? AssignedTo);

    [HttpPost]
    public async Task<ActionResult<Assignment>> Create([FromBody] CreateAssignmentDto dto)
    {
        if (!await db.Students.AnyAsync(s => s.Id == dto.StudentId)) return BadRequest("Student not found");
        var entity = new Assignment
        {
            StudentId = dto.StudentId,
            Title = dto.Title,
            Description = dto.Description ?? string.Empty,
            DueDate = dto.DueDate,
            AssignedTo = dto.AssignedTo,
            Status = "Open"
        };
        db.Assignments.Add(entity);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = entity.Id }, entity);
    }

    public record UpdateAssignmentDto(string Title, string? Description, DateTime? DueDate, string Status, string? AssignedTo);

    [HttpPut("{id}")]
    public async Task<ActionResult<Assignment>> Update(Guid id, [FromBody] UpdateAssignmentDto dto)
    {
        var entity = await db.Assignments.FindAsync(id);
        if (entity is null) return NotFound();
        entity.Title = dto.Title;
        entity.Description = dto.Description ?? string.Empty;
        entity.DueDate = dto.DueDate;
        entity.Status = dto.Status;
        entity.AssignedTo = dto.AssignedTo;
        await db.SaveChangesAsync();
        return Ok(entity);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entity = await db.Assignments.FindAsync(id);
        if (entity is null) return NotFound();
        db.Assignments.Remove(entity);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
