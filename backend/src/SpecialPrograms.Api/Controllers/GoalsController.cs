using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpecialPrograms.Api.Dtos;
using SpecialPrograms.Api.Services;

namespace SpecialPrograms.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GoalsController(IGoalService goals, IProgressService progress) : ControllerBase
{
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<IEnumerable<GoalDto>>> GetForStudent(Guid studentId)
    {
        var result = await goals.GetForStudentAsync(studentId);
        return Ok(result);
    }

    [HttpGet("{goalId}")]
    public async Task<ActionResult<GoalDto>> GetById(Guid goalId)
    {
        var goal = await goals.GetAsync(goalId);
        return goal is null ? NotFound() : Ok(goal);
    }

    [HttpPost]
    public async Task<ActionResult<GoalDto>> Post(GoalCreateDto dto)
    {
        var created = await goals.CreateAsync(dto);
        return CreatedAtAction(nameof(GetForStudent), new { studentId = created.StudentId }, created);
    }

    [HttpPut("{goalId}")]
    public async Task<ActionResult<GoalDto>> Put(Guid goalId, GoalUpdateDto dto)
    {
        var updated = await goals.UpdateAsync(goalId, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpPatch("{goalId}/status")]
    public async Task<IActionResult> UpdateStatus(Guid goalId, GoalStatusUpdateDto dto)
    {
        var updated = await goals.UpdateStatusAsync(goalId, dto.Status);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{goalId}")]
    public async Task<IActionResult> Delete(Guid goalId)
    {
        var deleted = await goals.DeleteAsync(goalId);
        return deleted ? NoContent() : NotFound();
    }

    [HttpGet("{goalId}/progress")]
    public async Task<ActionResult<IEnumerable<ProgressUpdateDto>>> GetProgress(Guid goalId)
    {
        var items = await progress.GetForGoalAsync(goalId);
        return Ok(items);
    }

    [HttpPost("{goalId}/progress")]
    public async Task<ActionResult<ProgressUpdateDto>> PostProgress(Guid goalId, ProgressUpdateCreateDto dto)
    {
        if (goalId != dto.GoalId)
        {
            return BadRequest("GoalId mismatch");
        }

        var created = await progress.CreateAsync(dto);
        return CreatedAtAction(nameof(GetProgress), new { goalId = created.GoalId }, created);
    }

    [HttpPut("{goalId}/progress/{progressId}")]
    public async Task<ActionResult<ProgressUpdateDto>> PutProgress(Guid goalId, Guid progressId, ProgressUpdateCreateDto dto)
    {
        if (goalId != dto.GoalId)
        {
            return BadRequest("GoalId mismatch");
        }

        var updated = await progress.UpdateAsync(progressId, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{goalId}/progress/{progressId}")]
    public async Task<IActionResult> DeleteProgress(Guid goalId, Guid progressId)
    {
        _ = goalId; // route coordination, validated in data layer
        var removed = await progress.DeleteAsync(progressId);
        return removed ? NoContent() : NotFound();
    }
}
